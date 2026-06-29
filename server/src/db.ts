import pg from "pg";

/**
 * Postgres connection pool + tables.
 *
 * Two app tables:
 *  - `documents` — extracted PDF text, keyed by docId.
 *  - `lessons`   — the read model for one learning session (its state, the
 *                  approved objectives, the current quiz, scores, summary).
 *
 * A third concern — durable workflow run snapshots for the plan-approval HITL —
 * is owned by Mastra's PostgresStore, which manages its own tables.
 *
 * Tables are created on demand, so there is no separate migration step.
 */
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let ready: Promise<void> | null = null;

/** Idempotently create the app tables. Cached so it only runs once per process. */
export function ensureTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await pool.query(`
        create table if not exists documents (
          id text primary key,
          content text not null,
          created_at timestamptz default now()
        )
      `);
      await pool.query(`
        create table if not exists lessons (
          id text primary key,
          doc_id text not null,
          status text not null,
          plan jsonb,
          objectives jsonb,
          objective_index int not null default 0,
          results jsonb not null default '[]',
          current_quiz jsonb,
          summary jsonb,
          updated_at timestamptz default now()
        )
      `);
    })();
  }
  return ready;
}

/** Load the extracted text for an uploaded PDF. */
export async function getDocText(docId: string): Promise<string> {
  await ensureTables();
  const res = await pool.query("select content from documents where id = $1", [
    docId,
  ]);
  if (!res.rows[0]) throw new Error(`document not found: ${docId}`);
  return res.rows[0].content as string;
}
