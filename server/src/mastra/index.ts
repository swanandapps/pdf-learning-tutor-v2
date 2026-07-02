import { Mastra } from "@mastra/core/mastra";
import { registerApiRoute } from "@mastra/core/server";
import { PinoLogger } from "@mastra/loggers";
import { PostgresStore } from "@mastra/pg";
import { PDFParse } from "pdf-parse";

import { pool, ensureTables } from "../db";
import { planWorkflow } from "./workflows/plan-workflow";
import {
  startLesson,
  approvePlan,
  submitResult,
  askTutor,
  getLesson,
  type PlanWorkflowHandle,
} from "../lesson-controller";

// grab the workflow at request time so it's wired to the configured storage
function planHandle(): PlanWorkflowHandle {
  return mastra.getWorkflow("planWorkflow") as unknown as PlanWorkflowHandle;
}

async function readJson<T>(c: any): Promise<T> {
  return (await c.req.json()) as T;
}

export const mastra = new Mastra({
  workflows: { planWorkflow },

  storage: new PostgresStore({
    id: "mastra-pg",
    connectionString: process.env.DATABASE_URL!,
  }),

  logger: new PinoLogger({ name: "pdf-tutor", level: "info" }),

  server: {
    host: "0.0.0.0",
    port: process.env.PORT ? Number(process.env.PORT) : 4111, // Railway sets PORT
    cors: { origin: "*", allowMethods: ["*"], allowHeaders: ["*"] },
    apiRoutes: [
      // accept raw text (notes, topic, anything) and store it as a doc
      registerApiRoute("/upload-text", {
        method: "POST",
        handler: async (c) => {
          const { text, title } = await readJson<{ text: string; title?: string }>(c);
          if (!text?.trim()) return c.json({ error: "text required" }, 400);
          const id = crypto.randomUUID();
          await ensureTables();
          const content = title ? `[${title}]\n\n${text}` : text;
          await pool.query(
            "insert into documents (id, content) values ($1, $2)",
            [id, content],
          );
          return c.json({ docId: id, chars: content.length });
        },
      }),

      // parse a PDF and store its text
      registerApiRoute("/upload", {
        method: "POST",
        handler: async (c) => {
          const body = await c.req.parseBody();
          const file = body["file"];
          if (!file || typeof file === "string") {
            return c.json({ error: "no file" }, 400);
          }
          const buffer = Buffer.from(await (file as File).arrayBuffer());
          const parser = new PDFParse({ data: buffer });
          const { text } = await parser.getText();
          await parser.destroy();

          const id = crypto.randomUUID();
          await ensureTables();
          await pool.query(
            "insert into documents (id, content) values ($1, $2)",
            [id, text],
          );
          return c.json({ docId: id, chars: text.length });
        },
      }),

      // start a lesson: draft a plan and pause for approval
      registerApiRoute("/lessons", {
        method: "POST",
        handler: async (c) => {
          const { docId } = await readJson<{ docId: string }>(c);
          if (!docId) return c.json({ error: "docId required" }, 400);
          const view = await startLesson(planHandle(), docId);
          return c.json(view);
        },
      }),

      // current lesson state (also used to restore on reload)
      registerApiRoute("/lessons/:id", {
        method: "GET",
        handler: async (c) => {
          try {
            return c.json(await getLesson(c.req.param("id")));
          } catch {
            return c.json({ error: "not found" }, 404);
          }
        },
      }),

      // approve the plan -> first quiz
      registerApiRoute("/lessons/:id/approve", {
        method: "POST",
        handler: async (c) => {
          const { objectives, questionsPerQuiz } = await readJson<{
            objectives: any[];
            questionsPerQuiz?: number;
          }>(c);
          const view = await approvePlan(
            planHandle(),
            c.req.param("id"),
            objectives,
            questionsPerQuiz ?? 3,
          );
          return c.json(view);
        },
      }),

      // submit a result -> next quiz or summary
      registerApiRoute("/lessons/:id/submit", {
        method: "POST",
        handler: async (c) => {
          const { score, total } = await readJson<{
            score: number;
            total: number;
          }>(c);
          const view = await submitResult(c.req.param("id"), score, total);
          return c.json(view);
        },
      }),

      // ask the tutor for a hint
      registerApiRoute("/lessons/:id/ask", {
        method: "POST",
        handler: async (c) => {
          const { question } = await readJson<{ question: string }>(c);
          if (!question) return c.json({ error: "question required" }, 400);
          const out = await askTutor(c.req.param("id"), question);
          return c.json(out);
        },
      }),
    ],
  },
});
