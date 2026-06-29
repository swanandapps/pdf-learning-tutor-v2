# PDF Learning Tutor

Upload a PDF and it becomes a short, interactive lesson. You get a learning plan to
review, a few multiple-choice questions per topic (with hints and explanations as
you go), and a little progress report at the end with study tips.

It's built with TypeScript, Mastra, Next.js and Postgres.

## The idea behind it

The main thing I cared about while building this was keeping the LLM on a short
leash. It only handles the "writing" parts: drafting the plan, writing the quiz
questions, giving hints, and writing the final summary. Each of those returns
structured data that I validate before using it.

Everything else (deciding what happens next, grading answers, moving through the
topics, pausing for your approval) is just normal code. So the flow is easy to
follow and doesn't depend on the model behaving perfectly every time.

## What you'll need

- Node 22 or newer
- A Postgres database — a free [Neon](https://neon.tech) project works great
- An OpenAI API key

## Running it locally

There's a backend and a frontend, so you'll have two terminals open.

**1. Backend** (runs on http://localhost:4111)

```bash
cd server
npm install
cp .env.example .env     # then add your OPENAI_API_KEY and DATABASE_URL
npm run dev
```

The database tables are created automatically the first time they're needed, so
there's nothing to migrate.

**2. Frontend** (runs on http://localhost:3000)

```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```

Now open http://localhost:3000, upload a PDF, and work through the lesson.

A few things worth knowing:

- Start the backend before the frontend.
- The first step after you upload makes a real call to OpenAI, so the plan takes a
  few seconds to show up.
- If port 3000 is already in use, Next.js grabs the next free one and prints it.

### Environment variables

The backend (`server/.env`) needs two things:

- `OPENAI_API_KEY` — used for the four LLM calls (model is `gpt-4o`)
- `DATABASE_URL` — your Postgres connection string (Neon's needs `?sslmode=require`)

The frontend (`web/.env.local`) just needs to know where the backend is. It defaults
to `http://localhost:4111`, so you only need to set `NEXT_PUBLIC_MASTRA_URL` if yours
is somewhere else.

Your keys live in `server/.env`, which is gitignored and never committed.

## Deploying

It's two services, so it deploys as two.

**Backend → Railway.** Point Railway at this repo and set the root directory to
`server`. Add three variables: `OPENAI_API_KEY`, `DATABASE_URL`, and `PORT` (the
server binds to whatever port the platform hands it). Railway picks up
`server/railway.json` and starts it, then give it a public domain.

**Frontend → Vercel.** Import the repo with the root directory set to `web`, and set
`NEXT_PUBLIC_MASTRA_URL` to the backend's public URL. Vercel detects Next.js and
builds the rest.

Deploy the backend first, since the frontend needs its URL at build time.

## How it works

1. You upload a PDF. The backend extracts the text (with `pdf-parse`) and stores it.
2. It drafts a three-topic learning plan and then pauses, waiting for you to approve
   or edit it. This pause is a real Mastra workflow that suspends and resumes, not
   just a chat message you can ignore.
3. Once you approve, it writes a short quiz for the first topic.
4. You answer. A correct answer shows an explanation; a wrong one shows a hint and
   lets you try again without losing points. You can also ask the tutor for help
   along the way, and it won't hand you the answer.
5. It works through each topic in turn, then writes a summary with your scores per
   topic and a couple of study tips.

On the backend, the LLM lives in `server/src/llm.ts` as four small functions that
each take some input and return validated data. The actual lesson logic lives in
`server/src/lesson-controller.ts`, which is basically a state machine
(`awaiting_approval → quizzing → complete`) deciding what to do next. The frontend
just renders whatever state the backend reports.

## Project layout

```
server/                          # Mastra backend (port 4111)
  src/
    schema.ts                    # the shapes every LLM reply has to match
    prompts.ts                   # the prompts
    llm.ts                       # the four LLM functions
    db.ts                        # Postgres + tables
    lesson-controller.ts         # the lesson state machine
    mastra/
      index.ts                   # server + REST routes
      workflows/plan-workflow.ts # the approve-the-plan pause (suspend/resume)
web/                             # Next.js frontend (port 3000)
  app/
    page.tsx                     # renders the current lesson state
    lib/api.ts                   # typed client for the backend
    components/                  # PlanApproval, Quiz, Summary, AskTutor
```

## Tech

- TypeScript
- Mastra — for the LLM calls and the one suspend/resume workflow
- OpenAI `gpt-4o`
- Next.js / React
- Postgres
- `pdf-parse` for pulling text out of the PDF

## What I'd do next

If this went past a prototype:

- The score is currently worked out in the browser and trusted by the server. For
  anything graded, I'd recompute it on the server and stop sending the correct answer
  to the client.
- Reloading mid-quiz keeps your place at the topic level but restarts that topic's
  questions. I'd persist the in-topic progress too.
- Only the plan approval uses a workflow, since it's the one step that has to wait
  for a human. If more steps needed to pause, I'd move them into workflows as well.
