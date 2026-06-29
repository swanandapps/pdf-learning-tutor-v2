import pg from "pg";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let ready: Promise<void> | null = null;

// create the tables on first use so there's no separate migration step
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
          questions_per_quiz int not null default 3,
          updated_at timestamptz default now()
        )
      `);
      // for tables created before this column existed
      await pool.query(
        `alter table lessons add column if not exists questions_per_quiz int not null default 3`,
      );
    })();
  }
  return ready;
}

export async function getDocText(docId: string): Promise<string> {
  await ensureTables();
  const res = await pool.query("select content from documents where id = $1", [
    docId,
  ]);
  if (!res.rows[0]) throw new Error(`document not found: ${docId}`);
  return res.rows[0].content as string;
}
