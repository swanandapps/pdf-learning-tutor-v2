import { pool, ensureTables, getDocText } from "./db";
import { generateQuiz, summarize, answerQuestion } from "./llm";
import { DRAFT_PLAN_STEP } from "./mastra/workflows/plan-workflow";
import type { LessonView, Objective, Quiz, Result, Summary } from "./schema";

/**
 * The orchestrator — in code, not in a prompt.
 *
 * A learning session is a finite state machine:
 *
 *     start ──▶ awaiting_approval ──approve──▶ quizzing(0) ──submit──▶ quizzing(1)
 *                     │                            ▲   │                    │
 *                  (HITL gate,                     └───┘  (loop, in code)   │
 *                   a Mastra workflow)                                      ▼
 *                                                              ──submit──▶ complete
 *
 * Each transition is a method here. The LLM is called inside these methods as a
 * pure function (generateQuiz / summarize / answerQuestion) and never decides
 * which transition happens — this code does. The `lessons` table is the single
 * source of truth the frontend reads.
 *
 * The plan-approval gate is delegated to the Mastra `planWorkflow` via the small
 * structural handle below, so this file never imports Mastra's types directly.
 */

type WorkflowRun = {
  runId: string;
  start(args: { inputData: { docId: string } }): Promise<any>;
  resume(args: { resumeData: unknown; step?: string }): Promise<any>;
};
export type PlanWorkflowHandle = {
  createRun(opts?: { runId?: string }): Promise<WorkflowRun>;
};

type LessonRow = {
  id: string;
  doc_id: string;
  status: LessonView["status"];
  plan: { objectives: Objective[] } | null;
  objectives: Objective[] | null;
  objective_index: number;
  results: Result[];
  current_quiz: Quiz | null;
  summary: Summary | null;
};

async function loadRow(lessonId: string): Promise<LessonRow> {
  await ensureTables();
  const res = await pool.query("select * from lessons where id = $1", [lessonId]);
  if (!res.rows[0]) throw new Error(`lesson not found: ${lessonId}`);
  return res.rows[0] as LessonRow;
}

/** Assemble the read model the frontend renders from a stored row. */
function toView(row: LessonRow): LessonView {
  const view: LessonView = { id: row.id, status: row.status };
  if (row.status === "awaiting_approval" && row.plan) view.plan = row.plan;
  if (row.objectives) {
    view.objectives = row.objectives;
    view.objectiveIndex = row.objective_index;
    view.objectivesCount = row.objectives.length;
    view.currentObjective = row.objectives[row.objective_index];
    view.quiz = row.current_quiz ?? undefined;
  }
  view.results = row.results ?? [];
  if (row.summary) view.summary = row.summary;
  return view;
}

/** State 0 -> awaiting_approval. Runs the plan workflow until it suspends. */
export async function startLesson(
  wf: PlanWorkflowHandle,
  docId: string,
): Promise<LessonView> {
  await ensureTables();
  const run = await wf.createRun();
  const res = await run.start({ inputData: { docId } });
  if (res.status !== "suspended") {
    throw new Error(`plan workflow did not suspend (status: ${res.status})`);
  }
  // Mastra namespaces the workflow-level suspend payload by step id, so the
  // payload our step passed to suspend({ plan }) lives under the step's key.
  const plan = res.suspendPayload[DRAFT_PLAN_STEP].plan as {
    objectives: Objective[];
  };

  await pool.query(
    `insert into lessons (id, doc_id, status, plan)
     values ($1, $2, 'awaiting_approval', $3)`,
    [run.runId, docId, JSON.stringify(plan)],
  );
  return toView(await loadRow(run.runId));
}

/** awaiting_approval -> quizzing(0). Resumes the workflow with the human's choices. */
export async function approvePlan(
  wf: PlanWorkflowHandle,
  lessonId: string,
  objectives: Objective[],
): Promise<LessonView> {
  const run = await wf.createRun({ runId: lessonId });
  const res = await run.resume({
    resumeData: { objectives },
    step: DRAFT_PLAN_STEP,
  });
  if (res.status !== "success") {
    throw new Error(`plan approval did not complete (status: ${res.status})`);
  }
  const approved = res.result.objectives as Objective[];

  const row = await loadRow(lessonId);
  const pdf = await getDocText(row.doc_id);
  const quiz = await generateQuiz(approved[0], pdf);

  await pool.query(
    `update lessons
        set status = 'quizzing', objectives = $2, objective_index = 0,
            results = '[]', current_quiz = $3, plan = null, updated_at = now()
      where id = $1`,
    [lessonId, JSON.stringify(approved), JSON.stringify(quiz)],
  );
  return toView(await loadRow(lessonId));
}

/** quizzing(i) -> quizzing(i+1) or -> complete. The loop, in code. */
export async function submitResult(
  lessonId: string,
  score: number,
  total: number,
): Promise<LessonView> {
  const row = await loadRow(lessonId);
  // Ignore stale/duplicate submits (e.g. after completion): only an active
  // quizzing lesson has a current objective to score against.
  if (row.status !== "quizzing") return toView(row);

  const objectives = row.objectives ?? [];
  const idx = row.objective_index;
  const current = objectives[idx];

  const results: Result[] = [
    ...row.results,
    {
      objectiveId: current.id,
      objectiveTitle: current.title,
      score,
      total,
    },
  ];
  const nextIdx = idx + 1;

  if (nextIdx < objectives.length) {
    // More objectives: generate the next quiz and advance.
    const pdf = await getDocText(row.doc_id);
    const quiz = await generateQuiz(objectives[nextIdx], pdf);
    await pool.query(
      `update lessons
          set objective_index = $2, results = $3, current_quiz = $4, updated_at = now()
        where id = $1`,
      [lessonId, nextIdx, JSON.stringify(results), JSON.stringify(quiz)],
    );
  } else {
    // Last objective done: summarize and finish.
    const summary = await summarize(objectives, results);
    await pool.query(
      `update lessons
          set status = 'complete', objective_index = $2, results = $3,
              summary = $4, current_quiz = null, updated_at = now()
        where id = $1`,
      [lessonId, nextIdx, JSON.stringify(results), JSON.stringify(summary)],
    );
  }
  return toView(await loadRow(lessonId));
}

/** The open-ended tutor reply. Guardrailed: never given the answer. */
export async function askTutor(
  lessonId: string,
  question: string,
): Promise<{ answer: string }> {
  const row = await loadRow(lessonId);
  const objectives = row.objectives ?? [];
  const idx = Math.min(row.objective_index, Math.max(objectives.length - 1, 0));
  const objective = objectives[idx];
  if (!objective) throw new Error("no active objective to tutor on");
  const pdf = await getDocText(row.doc_id);
  const answer = await answerQuestion(objective, pdf, question);
  return { answer };
}

/** Read model for the frontend (also used to restore state on page reload). */
export async function getLesson(lessonId: string): Promise<LessonView> {
  return toView(await loadRow(lessonId));
}
