import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { TranslationResult } from "@/types";
import { classNames } from "@/utils/format";

type TranslationModalProps = {
  result: TranslationResult;
  isTranslating?: boolean;
  onInsert: (selectedText: string) => void;
  onCopy: (selectedText: string) => void;
  onCancel: () => void;
  onReword: (options: {
    targetLanguageInput: string;
    targetLanguageLabel?: string;
    targetLanguageCode?: string;
  }) => void;
};

export const TranslationModal = ({
  result,
  isTranslating = false,
  onInsert,
  onCopy,
  onCancel,
  onReword,
}: TranslationModalProps) => {
  const initialOptions = useMemo(
    () =>
      [result.workingTranslation, ...result.alternatives.filter((item) => item !== result.workingTranslation)].filter(
        Boolean,
      ),
    [result.alternatives, result.workingTranslation],
  );
  const [options, setOptions] = useState(initialOptions);
  const [selectedText, setSelectedText] = useState(initialOptions[0] ?? "");
  const [targetLanguageInput, setTargetLanguageInput] = useState(result.targetLanguageLabel ?? "English");
  const hasExistingTranslation = Boolean((result.workingTranslation ?? "").trim());
  const normalizedTargetLanguage = (targetLanguageInput.trim() || "English").toLowerCase();
  const normalizedCurrentLanguage = (result.targetLanguageLabel?.trim() || "English").toLowerCase();
  const actionLabel =
    hasExistingTranslation && normalizedTargetLanguage === normalizedCurrentLanguage ? "Reword" : "Translate";

  const handleReword = () => {
    onReword({
      targetLanguageInput: targetLanguageInput.trim() || "English",
      targetLanguageLabel: targetLanguageInput.trim() || "English",
    });
  };

  useEffect(() => {
    setOptions(initialOptions);
    setSelectedText(initialOptions[0] ?? "");
    setTargetLanguageInput(result.targetLanguageLabel ?? "English");
  }, [initialOptions, result.targetLanguageLabel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-6">
      <div className="panel max-h-[85vh] w-full max-w-5xl overflow-y-auto px-6 py-6">
        <SectionTitle
          title="Translation"
          description="Compare the original text with the proposed translation, then choose the wording you want to insert."
        />

        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Original Text</p>
          <p className="mt-3 text-sm leading-7 text-slate-800">{result.originalText}</p>
        </div>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-white px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-slate-900">Translation and rewording</p>
            <div className="flex items-center gap-3">
              <input
                value={targetLanguageInput}
                onChange={(event) => setTargetLanguageInput(event.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm font-medium text-slate-900"
                placeholder="English"
              />
              <button
                type="button"
                onClick={handleReword}
                disabled={isTranslating}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
              >
                <RefreshCw size={16} className={isTranslating ? "animate-spin" : undefined} />
                {isTranslating ? "Translating..." : actionLabel}
              </button>
            </div>
          </div>
          {result.warning ? (
            <p className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-slate-600">
              {result.warning}
            </p>
          ) : null}
          <div className="mt-4 space-y-3">
            {options.length > 0 ? options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedText(option)}
                className={classNames(
                  "w-full rounded-xl border px-4 py-3 text-left text-sm",
                  selectedText === option
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-stone-200 bg-stone-50 text-slate-700",
                )}
              >
                {option}
              </button>
            )) : (
              <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-slate-500">
                {isTranslating ? "Generating translation..." : "No translation is available yet."}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onCopy(selectedText)}
            disabled={!selectedText.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
          >
            <Copy size={16} />
            Copy
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onInsert(selectedText)}
            disabled={!selectedText.trim()}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
          >
            Insert Into Draft
          </button>
        </div>
      </div>
    </div>
  );
};
