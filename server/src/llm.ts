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

// the only place we call the model. one small agent per job, same model under all.
const model = openai("gpt-4o");

const agent = (id: string, instructions: string) =>
  new Agent({ id, name: id, instructions, model });

export async function planLesson(pdfText: string): Promise<PlanDraft> {
  const res = await agent("planner", planSystem()).generate(planUser(pdfText), {
    structuredOutput: { schema: PlanDraftSchema },
  });
  return res.object;
}

export async function generateQuiz(
  objective: Objective,
  pdfText: string,
  count: number,
): Promise<Quiz> {
  const res = await agent("quiz-writer", quizSystem(count)).generate(
    quizUser(objective, pdfText),
    { structuredOutput: { schema: QuizSchema } },
  );
  const quiz = res.object;
  // don't let a bad correctIndex reach the UI
  quiz.questions.forEach((q) => {
    if (q.correctIndex >= q.options.length) q.correctIndex = 0;
  });
  quiz.questions = quiz.questions.slice(0, count); // honor the requested count
  return quiz;
}

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

// never receives the quiz or the answer, so it can't give it away
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
