import { pool, ensureTables, getDocText } from "./db";
import { generateQuiz, summarize, answerQuestion } from "./llm";
import { DRAFT_PLAN_STEP } from "./mastra/workflows/plan-workflow";
import type { LessonView, Objective, Quiz, Result, Summary } from "./schema";

// the lesson runs as a state machine: awaiting_approval -> quizzing -> complete.
// each exported function is one transition; the lessons table holds the state.

// just the bits of the workflow run we use, so we don't import Mastra's types here
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
  questions_per_quiz: number;
};

async function loadRow(lessonId: string): Promise<LessonRow> {
  await ensureTables();
  const res = await pool.query("select * from lessons where id = $1", [lessonId]);
  if (!res.rows[0]) throw new Error(`lesson not found: ${lessonId}`);
  return res.rows[0] as LessonRow;
}

// turn a db row into the view the frontend renders
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

// upload -> draft a plan and suspend, waiting for approval
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
  // the suspend payload is keyed by step id
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

// resume the workflow with the chosen objectives, then make the first quiz
export async function approvePlan(
  wf: PlanWorkflowHandle,
  lessonId: string,
  objectives: Objective[],
  questionsPerQuiz: number,
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
  const quiz = await generateQuiz(approved[0], pdf, questionsPerQuiz);

  await pool.query(
    `update lessons
        set status = 'quizzing', objectives = $2, objective_index = 0,
            results = '[]', current_quiz = $3, plan = null,
            questions_per_quiz = $4, updated_at = now()
      where id = $1`,
    [lessonId, JSON.stringify(approved), JSON.stringify(quiz), questionsPerQuiz],
  );
  return toView(await loadRow(lessonId));
}

// record the score, then either make the next quiz or finish with a summary
export async function submitResult(
  lessonId: string,
  score: number,
  total: number,
): Promise<LessonView> {
  const row = await loadRow(lessonId);
  if (row.status !== "quizzing") return toView(row); // ignore stale/duplicate submits

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
    // more objectives left -> next quiz
    const pdf = await getDocText(row.doc_id);
    const quiz = await generateQuiz(objectives[nextIdx], pdf, row.questions_per_quiz);
    await pool.query(
      `update lessons
          set objective_index = $2, results = $3, current_quiz = $4, updated_at = now()
        where id = $1`,
      [lessonId, nextIdx, JSON.stringify(results), JSON.stringify(quiz)],
    );
  } else {
    // that was the last one -> summary
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

export async function getLesson(lessonId: string): Promise<LessonView> {
  return toView(await loadRow(lessonId));
}
