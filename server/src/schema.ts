import { z } from "zod";

/**
 * The single source of truth for every shape that crosses an LLM boundary.
 *
 * Design rule for v2: the LLM is only ever allowed to RETURN data that matches
 * one of these schemas. It never decides control flow. If the model returns
 * something off-shape, `generateObject` throws here — in code — instead of the
 * mistake leaking into the product.
 */

export const Difficulty = z.enum(["beginner", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof Difficulty>;

/** One learning objective. `id` is assigned in code, not by the model. */
export const ObjectiveSchema = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: Difficulty,
  focus: z.string().describe("One sentence on what this objective covers."),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

/** What the planning LLM call returns (no ids — code adds those). */
export const PlanDraftSchema = z.object({
  objectives: z
    .array(ObjectiveSchema.omit({ id: true }))
    .min(3)
    .max(3)
    .describe("Exactly three objectives, ordered easiest to hardest."),
});
export type PlanDraft = z.infer<typeof PlanDraftSchema>;

/** A single multiple-choice question. */
export const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  correctIndex: z.number().int().min(0),
  explanation: z.string().describe("Why the correct answer is correct."),
  hint: z
    .string()
    .describe("A nudge toward the answer that does NOT reveal which option it is."),
});
export type Question = z.infer<typeof QuestionSchema>;

/** What the quiz-generation LLM call returns for one objective. */
export const QuizSchema = z.object({
  questions: z.array(QuestionSchema).min(2).max(3),
});
export type Quiz = z.infer<typeof QuizSchema>;

/** Score for one objective, computed in code from the user's first attempts. */
export const ResultSchema = z.object({
  objectiveId: z.string(),
  objectiveTitle: z.string(),
  score: z.number().int(),
  total: z.number().int(),
});
export type Result = z.infer<typeof ResultSchema>;

/** What the summary LLM call returns at the end of the lesson. */
export const SummarySchema = z.object({
  overall: z.string().describe("Two or three sentences on overall performance."),
  perObjective: z.array(
    z.object({
      title: z.string(),
      comment: z.string(),
    }),
  ),
  studyTips: z.array(z.string()).min(2).describe("Specific tips for weak areas."),
});
export type Summary = z.infer<typeof SummarySchema>;

/** The lesson status enum — the states of our finite state machine. */
export type LessonStatus = "awaiting_approval" | "quizzing" | "complete";

/** The read model the frontend renders. Assembled by the controller. */
export type LessonView = {
  id: string;
  status: LessonStatus;
  plan?: { objectives: Objective[] }; // shown during awaiting_approval
  objectives?: Objective[];
  objectiveIndex?: number;
  objectivesCount?: number;
  currentObjective?: Objective;
  quiz?: Quiz; // questions for the current objective
  results?: Result[];
  summary?: Summary;
};
