import { ConfidenceStatus, ResponseBite } from "@/types";

export type OverallConfidence = "well-supported" | "mixed-support" | "ai-assisted" | "needs-review" | "empty";

// Aggregates per-bite support statuses into one case-level state.
// Mirrors the ConfidencePanel maths: weak/missing support dominates, then
// AI-assisted, and a case is only "well supported" when every bite rests on
// a direct or translated source. "ai-assisted" and "mixed-support" share the
// same amber trust tier — the split only keeps the label truthful (a case
// where every bite is AI-assisted is not "mixed").
export const getOverallConfidence = (bites: ResponseBite[]): OverallConfidence => {
  if (bites.length === 0) return "empty";
  if (bites.some((bite) => bite.supportStatus === "weak-support" || bite.supportStatus === "missing-support")) {
    return "needs-review";
  }
  if (bites.every((bite) => bite.supportStatus === "ai-assisted")) {
    return "ai-assisted";
  }
  if (bites.some((bite) => bite.supportStatus === "ai-assisted")) {
    return "mixed-support";
  }
  return "well-supported";
};

// Maps the live aggregation onto the case-level ConfidenceStatus stored with
// saved cases (shown as the confidence badge in the Case Library).
export const toCaseConfidenceStatus = (overall: OverallConfidence): ConfidenceStatus => {
  if (overall === "well-supported") return "high";
  if (overall === "mixed-support" || overall === "ai-assisted") return "mixed";
  return "low";
};
