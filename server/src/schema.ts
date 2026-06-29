import { z } from "zod";

// schemas for everything the LLM returns, plus the view the frontend reads

export const Difficulty = z.enum(["beginner", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const ObjectiveSchema = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: Difficulty,
  focus: z.string().describe("One sentence on what this objective covers."),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

// planLesson output — no id, we add that in code
export const PlanDraftSchema = z.object({
  objectives: z
    .array(ObjectiveSchema.omit({ id: true }))
    .min(3)
    .max(3)
    .describe("Exactly three objectives, ordered easiest to hardest."),
});
export type PlanDraft = z.infer<typeof PlanDraftSchema>;

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

export const QuizSchema = z.object({
  questions: z.array(QuestionSchema).min(1).max(12), // exact count set per lesson
});
export type Quiz = z.infer<typeof QuizSchema>;

export const ResultSchema = z.object({
  objectiveId: z.string(),
  objectiveTitle: z.string(),
  score: z.number().int(),
  total: z.number().int(),
});
export type Result = z.infer<typeof ResultSchema>;

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

export type LessonStatus = "awaiting_approval" | "quizzing" | "complete";

export type LessonView = {
  id: string;
  status: LessonStatus;
  plan?: { objectives: Objective[] };
  objectives?: Objective[];
  objectiveIndex?: number;
  objectivesCount?: number;
  currentObjective?: Objective;
  quiz?: Quiz;
  results?: Result[];
  summary?: Summary;
};
