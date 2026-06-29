"use client";
import { useState } from "react";
import type { Objective, Quiz as QuizT, Result } from "../lib/api";
import { BRAND } from "../lib/theme";
import { AskTutor } from "./AskTutor";

/**
 * The MCQ widget. Pure UI: it renders the questions the server generated, grades
 * the selection against `correctIndex` for instant green/red feedback, lets the
 * user retry a wrong answer with no penalty, and reports the first-try score back
 * up when the objective is finished. It owns no lesson state beyond the current
 * question — advancing the lesson is the server's job (page.tsx -> /submit).
 */
export function Quiz({
  lessonId,
  objectives,
  objectiveIndex,
  results,
  quiz,
  busy,
  onDone,
}: {
  lessonId: string;
  objectives: Objective[];
  objectiveIndex: number;
  results: Result[];
  quiz: QuizT;
  busy: boolean;
  onDone: (score: number, total: number) => void;
}) {
  const objective = objectives[objectiveIndex];
  const objectivesCount = objectives.length;
  const questions = quiz.questions;
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [firstTry, setFirstTry] = useState(0);

  const q = questions[idx];
  const correct = submitted && selected === q.correctIndex;
  const progress = ((idx + 1) / questions.length) * 100;
  const last = idx + 1 >= questions.length;

  function submit() {
    if (selected === null) return;
    if (selected === q.correctIndex && attempts === 0) setFirstTry((n) => n + 1);
    setAttempts((a) => a + 1);
    setSubmitted(true);
  }

  function next() {
    if (last) {
      onDone(firstTry, questions.length);
      return;
    }
    setIdx((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
    setAttempts(0);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        {/* Lesson-wide progress: one segment per objective, filled as you go */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {objectives.map((o, i) => {
            const done = i < objectiveIndex;
            const current = i === objectiveIndex;
            const r = results.find((x) => x.objectiveId === o.id);
            return (
              <div
                key={o.id}
                title={o.title}
                style={{ flex: 1, textAlign: "center" }}
              >
                <div
                  style={{
                    height: 8,
                    borderRadius: 99,
                    boxSizing: "border-box",
                    background: done
                      ? BRAND.green
                      : current
                        ? BRAND.greenSoft
                        : BRAND.line,
                    border: current ? `2px solid ${BRAND.green}` : "none",
                  }}
                />
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                    marginTop: 5,
                    color: done || current ? BRAND.green : BRAND.muted,
                  }}
                >
                  {done && r ? `${r.score}/${r.total}` : `Obj ${i + 1}`}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: BRAND.green,
          }}
        >
          Objective {objectiveIndex + 1} of {objectivesCount}
        </div>
        <div
          style={{
            fontFamily: BRAND.serif,
            fontSize: 22,
            fontWeight: 600,
            marginTop: 2,
          }}
        >
          {objective.title}
        </div>
      </div>

      <div
        style={{
          border: `1px solid ${BRAND.line}`,
          borderRadius: 16,
          padding: 22,
          background: "#fff",
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        }}
      >
        {/* progress */}
        <div
          style={{
            height: 6,
            borderRadius: 99,
            background: BRAND.line,
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: BRAND.green,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <div
          style={{
            fontSize: 12,
            color: BRAND.muted,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 8,
          }}
        >
          Question {idx + 1} of {questions.length}
        </div>

        <div
          style={{
            fontFamily: BRAND.serif,
            fontWeight: 600,
            fontSize: 19,
            lineHeight: 1.4,
            marginBottom: 16,
          }}
        >
          {q.question}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {q.options.map((opt, i) => {
            let bg = "#fff";
            let border = BRAND.line;
            if (submitted && i === q.correctIndex) {
              bg = BRAND.greenSoft;
              border = BRAND.green;
            } else if (submitted && i === selected) {
              bg = BRAND.redSoft;
              border = BRAND.red;
            } else if (!submitted && i === selected) {
              bg = BRAND.greenSoft;
              border = BRAND.green;
            }
            return (
              <label
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "12px 14px",
                  border: `1.5px solid ${border}`,
                  borderRadius: 12,
                  background: bg,
                  fontSize: 15,
                  cursor: submitted ? "default" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  disabled={submitted}
                  checked={selected === i}
                  onChange={() => setSelected(i)}
                  style={{ accentColor: BRAND.green }}
                />
                {opt}
              </label>
            );
          })}
        </div>

        {submitted && correct && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              background: BRAND.greenSoft,
              borderRadius: 12,
              color: BRAND.greenDark,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <strong>✓ Correct</strong> — {q.explanation}
          </div>
        )}

        {submitted && !correct && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              background: BRAND.amberSoft,
              border: `1.5px solid #FCD34D`,
              borderRadius: 12,
              color: BRAND.amber,
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            ✗ Not quite. 💡 Hint: {q.hint}
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          {!submitted && (
            <button
              disabled={selected === null}
              onClick={submit}
              style={{
                background: selected === null ? "#D1D5DB" : BRAND.green,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "9px 22px",
                fontSize: 14,
                fontWeight: 600,
                cursor: selected === null ? "not-allowed" : "pointer",
              }}
            >
              Submit
            </button>
          )}
          {submitted && !correct && (
            <button
              onClick={() => {
                setSubmitted(false);
                setSelected(null);
              }}
              style={{
                background: "#fff",
                color: BRAND.green,
                border: `1.5px solid ${BRAND.green}`,
                borderRadius: 10,
                padding: "9px 22px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          )}
          {submitted && correct && (
            <button
              onClick={next}
              disabled={busy}
              style={{
                background: BRAND.green,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "9px 22px",
                fontSize: 14,
                fontWeight: 600,
                cursor: busy ? "wait" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Saving…" : last ? "Finish objective" : "Next question"}
            </button>
          )}
        </div>
      </div>

      {/* The one open-ended, conversational surface. */}
      <AskTutor lessonId={lessonId} />
    </div>
  );
}
