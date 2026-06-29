import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

import { getDocText } from "../../db";
import { planLesson } from "../../llm";
import { ObjectiveSchema } from "../../schema";

// the one workflow: draft a plan, suspend for the user to approve, resume with their picks.
// exported because the controller uses the step id to read the suspend payload and to resume.
export const DRAFT_PLAN_STEP = "draftPlan";

const draftPlan = createStep({
  id: DRAFT_PLAN_STEP,
  inputSchema: z.object({ docId: z.string() }),
  resumeSchema: z.object({ objectives: z.array(ObjectiveSchema) }), // the approved objectives
  suspendSchema: z.object({
    plan: z.object({ objectives: z.array(ObjectiveSchema) }),
  }),
  outputSchema: z.object({ objectives: z.array(ObjectiveSchema) }),

  execute: async ({ inputData, resumeData, suspend }) => {
    // resumed: pass the approved objectives through
    if (resumeData?.objectives) {
      return { objectives: resumeData.objectives };
    }

    // first run: draft the plan, add ids, then pause
    const text = await getDocText(inputData.docId);
    const draft = await planLesson(text);
    const objectives = draft.objectives.map((o, i) => ({
      id: `obj-${i + 1}`,
      ...o,
    }));

    await suspend({ plan: { objectives } });

    return { objectives }; // only reached after resume
  },
});

export const planWorkflow = createWorkflow({
  id: "planWorkflow",
  inputSchema: z.object({ docId: z.string() }),
  outputSchema: z.object({ objectives: z.array(ObjectiveSchema) }),
})
  .then(draftPlan)
  .commit();
