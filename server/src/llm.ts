import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

import {
  PlanDraftSchema,
  QuizSchema,
  SummarySchema,
  type Objective,
  type PlanDraft,
  type Quiz,
  type Result,
  type Summary,
} from "./schema";
import {
  planSystem,
  planUser,
  quizSystem,
  quizUser,
  summarySystem,
  summaryUser,
  tutorSystem,
} from "./prompts";

/**
 * The LLM, as four pure functions.
 *
 * This file is the *entire* surface where the model is involved. Every function
 * here is `input -> typed output`. There is no state, no looping, no "what
 * should happen next" — that all lives in the controller and the workflow.
 *
 * Each function is a single-purpose Mastra `Agent` whose instructions are the
 * task's system prompt. Three of the four request `structuredOutput`, so Mastra
 * validates the model's reply against a Zod schema before it can return — an
 * off-shape reply throws here, in code, instead of leaking into the product.
 */

const model = openai("gpt-4o");

const agent = (id: string, instructions: string) =>
  new Agent({ id, name: id, instructions, model });

/** PDF text -> a 3-objective learning plan. */
export async function planLesson(pdfText: string): Promise<PlanDraft> {
  const res = await agent("planner", planSystem()).generate(planUser(pdfText), {
    structuredOutput: { schema: PlanDraftSchema },
  });
  return res.object;
}

/** One objective (+ source text) -> 2-3 MCQs. */
export async function generateQuiz(
  objective: Objective,
  pdfText: string,
): Promise<Quiz> {
  const res = await agent("quiz-writer", quizSystem()).generate(
    quizUser(objective, pdfText),
    { structuredOutput: { schema: QuizSchema } },
  );
  const quiz = res.object;
  // Defensive clamp: never let an out-of-range correctIndex reach the UI.
  quiz.questions.forEach((q) => {
    if (q.correctIndex >= q.options.length) q.correctIndex = 0;
  });
  return quiz;
}

/** Objectives + scores -> an end-of-lesson report. */
export async function summarize(
  objectives: Objective[],
  results: Result[],
): Promise<Summary> {
  const res = await agent("summarizer", summarySystem()).generate(
    summaryUser(objectives, results),
    { structuredOutput: { schema: SummarySchema } },
  );
  return res.object;
}

/**
 * A student question -> a tutoring reply.
 *
 * Note the signature: it takes the objective and the source text, but NOT the
 * quiz or the correct answer. The model literally cannot reveal the answer
 * because it was never given it. The prompt guardrail is the second layer.
 */
export async function answerQuestion(
  objective: Objective,
  pdfText: string,
  question: string,
): Promise<string> {
  const res = await agent("tutor", tutorSystem(objective)).generate(
    [
      `Source material:\n"""\n${pdfText.slice(0, 8_000)}\n"""`,
      "",
      `Student asks: ${question}`,
    ].join("\n"),
  );
  return res.text;
}
