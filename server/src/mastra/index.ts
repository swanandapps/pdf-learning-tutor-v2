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

/**
 * The Mastra server.
 *
 * The REST routes below are deliberately thin: each one validates input, calls a
 * single controller transition, and returns the lesson view. All the thinking is
 * in the controller (orchestration) and llm.ts (generation). The routes are the
 * typed contract the frontend talks to — no chat protocol, no tool-call plumbing.
 */

// Helper so route handlers can resume the plan workflow bound to storage.
// Reads from the module-scoped `mastra` instance (assigned below, resolved at
// request time), which guarantees the workflow is wired to PostgresStore.
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
    // Bind to the platform-provided port in production (Railway sets $PORT),
    // falling back to 4111 for local dev.
    port: process.env.PORT ? Number(process.env.PORT) : 4111,
    cors: { origin: "*", allowMethods: ["*"], allowHeaders: ["*"] },
    apiRoutes: [
      // 1. Upload a PDF: extract text, store it, return a docId.
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

      // 2. Start a lesson: draft a plan and pause for approval (HITL).
      registerApiRoute("/lessons", {
        method: "POST",
        handler: async (c) => {
          const { docId } = await readJson<{ docId: string }>(c);
          if (!docId) return c.json({ error: "docId required" }, 400);
          const view = await startLesson(planHandle(), docId);
          return c.json(view);
        },
      }),

      // 3. Read the current lesson state (also used to restore on reload).
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

      // 4. Approve the plan -> generate the first quiz.
      registerApiRoute("/lessons/:id/approve", {
        method: "POST",
        handler: async (c) => {
          const { objectives } = await readJson<{ objectives: any[] }>(c);
          const view = await approvePlan(
            planHandle(),
            c.req.param("id"),
            objectives,
          );
          return c.json(view);
        },
      }),

      // 5. Submit a quiz result -> next quiz, or the final summary.
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

      // 6. Ask the tutor (open-ended hint/explanation, never reveals the answer).
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
