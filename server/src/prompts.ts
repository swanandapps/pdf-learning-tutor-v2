import type { Objective } from "./schema";

/**
 * Prompts live here, separated from the code that calls them.
 *
 * Notice what these prompts do NOT contain: no "STEP 1 / STEP 2", no "call this
 * tool next", no "never do X". Each prompt asks the model for exactly one
 * artifact. Orchestration is the workflow's job (see lesson-controller.ts and
 * mastra/workflows/plan-workflow.ts), not the prompt's.
 */

/** Keep token usage predictable — trimming the PDF is a code concern. */
export const MAX_PDF_CHARS = 12_000;

export function planSystem(): string {
  return [
    "You are a curriculum designer.",
    "Given the text of a document, produce a short learning plan: exactly three",
    "objectives that build from easiest to hardest. Each objective has a title,",
    "a difficulty, and a one-sentence focus. Base everything strictly on the",
    "document — do not invent topics it does not cover.",
  ].join(" ");
}

export function planUser(pdfText: string): string {
  return `Document:\n"""\n${pdfText.slice(0, MAX_PDF_CHARS)}\n"""`;
}

export function quizSystem(): string {
  return [
    "You are an assessment writer.",
    "Write 2-3 multiple-choice questions that test ONE specific objective,",
    "drawn strictly from the document. Each question has 2-4 options, exactly one",
    "correct option (give its 0-based index), a short explanation of why it is",
    "correct, and a hint that points the learner toward the answer WITHOUT",
    "revealing which option it is.",
  ].join(" ");
}

export function quizUser(objective: Objective, pdfText: string): string {
  return [
    `Objective: ${objective.title} (${objective.difficulty})`,
    `Focus: ${objective.focus}`,
    "",
    `Document:\n"""\n${pdfText.slice(0, MAX_PDF_CHARS)}\n"""`,
  ].join("\n");
}

export function summarySystem(): string {
  return [
    "You are an encouraging tutor writing a short end-of-lesson report.",
    "Given per-objective scores, summarize overall performance, give one comment",
    "per objective, and provide at least two concrete study tips targeting the",
    "weakest areas. Do not repeat the quiz questions.",
  ].join(" ");
}

export function summaryUser(
  objectives: Objective[],
  results: { objectiveTitle: string; score: number; total: number }[],
): string {
  const lines = results.map(
    (r) => `- ${r.objectiveTitle}: ${r.score}/${r.total} on first try`,
  );
  return `Scores:\n${lines.join("\n")}`;
}

/**
 * The tutor Q&A guardrail. This is the ONE open-ended LLM call in the app
 * (a student asking "explain this" / "give me a hint"). The guardrail is twofold:
 *   1. Code never passes it the correct answer (see llm.answerQuestion).
 *   2. This prompt forbids revealing the answer and steers back to the quiz.
 */
export function tutorSystem(objective: Objective): string {
  return [
    "You are a patient tutor helping a student with the current learning",
    `objective: "${objective.title}" (focus: ${objective.focus}).`,
    "Answer the student's question or give a hint based on the source material.",
    "Hard rules: never state or reveal which multiple-choice option is correct;",
    "never give the literal answer to a quiz question; keep replies under 80",
    "words; and always end by encouraging them to give the question a try.",
  ].join(" ");
}
