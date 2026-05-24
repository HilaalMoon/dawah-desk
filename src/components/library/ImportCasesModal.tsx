import { useState } from "react";
import { CaseRecord } from "@/types";
import { CaseExportFile } from "@/types/backend";
import { MatchLevel, MATCH_ORDER, titleMatchLevel } from "@/utils/titleMatch";

type Phase = "preview" | "loading" | "success" | "error";

type Props = {
  parsed: CaseExportFile;
  cases: CaseRecord[];
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

export const ImportCasesModal = ({ parsed, cases, onConfirm, onClose }: Props) => {
  const [phase, setPhase] = useState<Phase>("preview");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setPhase("loading");
    try {
      await onConfirm();
      setPhase("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
      setPhase("error");
    }
  };

  const importTopic = parsed.case.topic ?? "";
  const sameTopic = importTopic
    ? [...cases]
        .filter((c) => c.topic === importTopic)
        .sort(
          (a, b) =>
            MATCH_ORDER[titleMatchLevel(parsed.case.title, a.title)] -
            MATCH_ORDER[titleMatchLevel(parsed.case.title, b.title)],
        )
    : [];
  const titleMatched = !importTopic
    ? [...cases]
        .map((c) => ({ c, level: titleMatchLevel(parsed.case.title, c.title) }))
        .filter(({ level }) => level !== "none")
        .sort((a, b) => MATCH_ORDER[a.level] - MATCH_ORDER[b.level])
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">

        {phase === "preview" ? (
          <>
            <h2 className="text-lg font-semibold text-slate-900">Import case</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review the case below before importing.
            </p>

            <div className="mt-4 space-y-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{parsed.case.title}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Question</p>
                <p className="mt-0.5 text-sm text-slate-700">{parsed.case.originalQuestion}</p>
              </div>
              {parsed.case.contextNote ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Context</p>
                  <p className="mt-0.5 text-sm text-slate-700">{parsed.case.contextNote}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-6">
                {parsed.case.topic ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Topic</p>
                    <p className="mt-0.5 text-sm text-slate-700">{parsed.case.topic}</p>
                  </div>
                ) : null}
                {parsed.case.difficulty ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Difficulty</p>
                    <p className="mt-0.5 text-sm text-slate-700">{parsed.case.difficulty}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bites</p>
                  <p className="mt-0.5 text-sm text-slate-700">{parsed.bites.length}</p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Cases with the same topic in your library
              </p>
              {!importTopic ? (
                <>
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    This case has no topic assigned. We cannot show you potentially similar cases.
                    Please review your library manually before importing.
                  </div>
                  {titleMatched.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No similar case titles found in your library.</p>
                  ) : (
                    <ul className="mt-2 max-h-36 overflow-y-auto space-y-1">
                      {titleMatched.map(({ c, level }) => (
                        <li
                          key={c.caseId}
                          className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-slate-700"
                        >
                          <span>{c.title}</span>
                          {level === "exact" ? (
                            <span className="shrink-0 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                              Exact duplicate
                            </span>
                          ) : (
                            <span className="shrink-0 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Possible duplicate
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : sameTopic.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No existing cases with this topic found.</p>
              ) : (
                <ul className="mt-2 max-h-36 overflow-y-auto space-y-1">
                  {sameTopic.map((c) => {
                    const level = titleMatchLevel(parsed.case.title, c.title);
                    return (
                      <li
                        key={c.caseId}
                        className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-slate-700"
                      >
                        <span>{c.title}</span>
                        {level === "exact" ? (
                          <span className="shrink-0 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                            Exact duplicate
                          </span>
                        ) : level === "close" ? (
                          <span className="shrink-0 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            Possible duplicate
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleConfirm()}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Import case
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </>
        ) : null}

        {phase === "loading" ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-600">Importing case…</p>
          </div>
        ) : null}

        {phase === "success" ? (
          <>
            <p className="text-lg font-semibold text-slate-900">Case imported successfully.</p>
            <p className="mt-1 text-sm text-slate-600">
              "{parsed.case.title}" has been added to the Case Library.
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>
          </>
        ) : null}

        {phase === "error" ? (
          <>
            <p className="text-lg font-semibold text-slate-900">Import failed</p>
            <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
            <div className="mt-5">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>
          </>
        ) : null}

      </div>
    </div>
  );
};
