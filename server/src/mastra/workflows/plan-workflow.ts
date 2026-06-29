import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getDocText } from "../../db";
import { planLesson } from "../../llm";
import { ObjectiveSchema } from "../../schema";

/**
 * The ONE place we use Mastra's workflow engine: the human-in-the-loop plan
 * approval gate.
 *
 * Why a workflow here and plain code elsewhere? Because this is the single point
 * where the process must *pause and wait for a human*, durably, possibly across
 * a page reload or a server restart. That is exactly what `suspend` / `resume`
 * are for. The quiz loop, by contrast, is just a sequence — it needs no engine,
 * so it stays as ordinary TypeScript in the controller.
 *
 * Flow of this one-step workflow:
 *   start({ docId })           -> draft a plan with the LLM, then suspend.
 *   (status: 'suspended', suspendPayload = { plan })   <- UI shows it to the user
 *   resume({ objectives })     -> return the human-approved objectives. Done.
 */

/**
 * The step id. Exported because the controller needs it twice — to read the
 * suspend payload (Mastra namespaces it by step id) and to target the resume.
 * Keeping it in one place stops those two from drifting apart.
 */
export const DRAFT_PLAN_STEP = "draftPlan";

const draftPlan = createStep({
  id: DRAFT_PLAN_STEP,
  inputSchema: z.object({ docId: z.string() }),
  // What the UI sends back when the human approves (possibly edited) objectives.
  resumeSchema: z.object({ objectives: z.array(ObjectiveSchema) }),
  // What we hand to the UI while paused.
  suspendSchema: z.object({
    plan: z.object({ objectives: z.array(ObjectiveSchema) }),
  }),
  // The approved objectives, once resumed.
  outputSchema: z.object({ objectives: z.array(ObjectiveSchema) }),

  execute: async ({ inputData, resumeData, suspend }) => {
    // Second pass: the human approved. Just hand the chosen objectives onward.
    if (resumeData?.objectives) {
      return { objectives: resumeData.objectives };
    }

    // First pass: draft a plan, assign ids in code, then pause for approval.
    const text = await getDocText(inputData.docId);
    const draft = await planLesson(text);
    const objectives = draft.objectives.map((o, i) => ({
      id: `obj-${i + 1}`,
      ...o,
    }));

    await suspend({ plan: { objectives } });

    // Unreachable until resume; required so the type checker sees a return.
    return { objectives };
  },
});

export const planWorkflow = createWorkflow({
  id: "planWorkflow",
  inputSchema: z.object({ docId: z.string() }),
  outputSchema: z.object({ objectives: z.array(ObjectiveSchema) }),
})
  .then(draftPlan)
  .commit();
