"use client";
import { useEffect, useState } from "react";
import { api, type LessonView, type Objective } from "./lib/api";
import { BRAND } from "./lib/theme";
import { PlanApproval } from "./components/PlanApproval";
import { Quiz } from "./components/Quiz";
import { Summary } from "./components/Summary";

/**
 * The whole UI is a function of one value: the `LessonView` the server returns.
 * There is no client-side orchestration — we upload, then render whatever state
 * the server reports, and POST transitions back to advance the lesson.
 */
export default function Home() {
  const [lesson, setLesson] = useState<LessonView | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  // Restore an in-progress lesson on reload (durable, server-side state).
  useEffect(() => {
    const id = localStorage.getItem("lessonId");
    if (!id) return;
    api
      .get(id)
      .then(setLesson)
      .catch(() => localStorage.removeItem("lessonId"));
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setFileName(file.name);
    setUploading(true);
    try {
      const { docId } = await api.upload(file);
      const view = await api.start(docId);
      localStorage.setItem("lessonId", view.id);
      setLesson(view);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function run(fn: () => Promise<LessonView>) {
    setBusy(true);
    setError("");
    try {
      setLesson(await fn());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const approve = (objectives: Objective[]) =>
    run(() => api.approve(lesson!.id, objectives));

  const submit = (score: number, total: number) =>
    run(() => api.submit(lesson!.id, score, total));

  function restart() {
    localStorage.removeItem("lessonId");
    setLesson(null);
    setFileName("");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: BRAND.card,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 28px",
          background: "#fff",
          borderBottom: `1px solid ${BRAND.line}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: BRAND.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            📘
          </div>
          <div>
            <div
              style={{
                fontFamily: BRAND.serif,
                fontWeight: 600,
                fontSize: 20,
                color: BRAND.text,
              }}
            >
              PDF Tutor
            </div>
            <div style={{ fontSize: 12, color: BRAND.muted }}>
              The AI Stack for learning from PDF
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {fileName && (
            <span
              style={{
                fontSize: 12,
                color: BRAND.green,
                fontWeight: 600,
                background: BRAND.greenSoft,
                padding: "5px 10px",
                borderRadius: 8,
              }}
            >
              ✓ {fileName}
            </span>
          )}
          <label
            style={{
              cursor: "pointer",
              background: BRAND.green,
              color: "#fff",
              padding: "9px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {lesson ? "New PDF" : "Upload PDF"}
            <input
              type="file"
              accept="application/pdf"
              onChange={handleUpload}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "32px 20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 640 }}>
          {error && (
            <div
              style={{
                background: BRAND.redSoft,
                color: BRAND.red,
                border: `1px solid ${BRAND.red}`,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {uploading && (
            <Centered>Reading your PDF and drafting a plan…</Centered>
          )}

          {!uploading && !lesson && (
            <Centered>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄→🧠</div>
              <div
                style={{
                  fontFamily: BRAND.serif,
                  fontSize: 22,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Upload a PDF to begin
              </div>
              <div style={{ color: BRAND.muted, fontSize: 15, maxWidth: 380 }}>
                We&apos;ll propose a short lesson plan, you approve it, then
                work through quizzes with hints, retries, and a final report.
              </div>
            </Centered>
          )}

          {lesson?.status === "awaiting_approval" && lesson.plan && (
            <PlanApproval
              objectives={lesson.plan.objectives}
              busy={busy}
              onApprove={approve}
            />
          )}

          {lesson?.status === "quizzing" &&
            lesson.quiz &&
            lesson.currentObjective && (
              <Quiz
                key={lesson.objectiveIndex}
                lessonId={lesson.id}
                objectives={lesson.objectives ?? []}
                objectiveIndex={lesson.objectiveIndex ?? 0}
                results={lesson.results ?? []}
                quiz={lesson.quiz}
                busy={busy}
                onDone={submit}
              />
            )}

          {lesson?.status === "complete" && lesson.summary && (
            <Summary
              summary={lesson.summary}
              results={lesson.results ?? []}
              onRestart={restart}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 0",
        color: BRAND.text,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}
