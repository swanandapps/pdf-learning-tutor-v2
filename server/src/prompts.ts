import type { Objective } from "./schema";

export const MAX_PDF_CHARS = 12_000; // cap so token use stays predictable

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

// guardrail: don't reveal which option is correct (and answerQuestion never gets it)
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
