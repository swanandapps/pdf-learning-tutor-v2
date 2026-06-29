// typed client for the backend. these types mirror server/src/schema.ts,
// and every call returns the same LessonView the UI renders.

export const MASTRA_URL =
  process.env.NEXT_PUBLIC_MASTRA_URL || "http://localhost:4111";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Objective = {
  id: string;
  title: string;
  difficulty: Difficulty;
  focus: string;
};

export type Question = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
};

export type Quiz = { questions: Question[] };

export type Result = {
  objectiveId: string;
  objectiveTitle: string;
  score: number;
  total: number;
};

export type Summary = {
  overall: string;
  perObjective: { title: string; comment: string }[];
  studyTips: string[];
};

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

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  return (await res.json()) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${MASTRA_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => asJson<T>(r));
}

export const api = {
  async upload(file: File): Promise<{ docId: string; chars: number }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${MASTRA_URL}/upload`, {
      method: "POST",
      body: form,
    });
    return asJson(res);
  },

  start(docId: string): Promise<LessonView> {
    return post("/lessons", { docId });
  },

  get(id: string): Promise<LessonView> {
    return fetch(`${MASTRA_URL}/lessons/${id}`).then((r) =>
      asJson<LessonView>(r),
    );
  },

  approve(
    id: string,
    objectives: Objective[],
    questionsPerQuiz: number,
  ): Promise<LessonView> {
    return post(`/lessons/${id}/approve`, { objectives, questionsPerQuiz });
  },

  submit(id: string, score: number, total: number): Promise<LessonView> {
    return post(`/lessons/${id}/submit`, { score, total });
  },

  ask(id: string, question: string): Promise<{ answer: string }> {
    return post(`/lessons/${id}/ask`, { question });
  },
};
