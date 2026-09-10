import { useState } from "react";
import { Languages } from "lucide-react";
import { SourcePanel } from "@/components/workspace/SourcePanel";
import { SourceItem } from "@/types";

const EMPTY_SELECTION: string[] = [];

type AiTranslationUtilityProps = {
  sources: SourceItem[];
  onTranslateText: (text: string) => void;
  onCopyText: (text: string, message?: string) => void;
  onTranslateSource: (sourceId: string) => void;
};

// Top-bar AI Translation utility: caseless translation of pasted text or a
// saved source. Reuses the existing translation flow (the Translation window
// opens on top; Insert Into Draft only appears when a case is open) and the
// saved-source panel in browse mode (no Add to draft).
export const AiTranslationUtility = ({
  sources,
  onTranslateText,
  onCopyText,
  onTranslateSource,
}: AiTranslationUtilityProps) => {
  const [text, setText] = useState("");
  const trimmed = text.trim();

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
        <p className="text-sm font-semibold text-slate-900">Translate any text</p>
        <p className="mt-1 text-sm text-slate-600">
          Paste text and open it in the translator — no case needed. You choose the target language there.
        </p>
        <textarea
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste or type the text to translate..."
          className="mt-3 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-slate-400"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onTranslateText(trimmed)}
            disabled={!trimmed}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Languages size={16} />
            Translate
          </button>
        </div>
      </section>

      <SourcePanel
        embedded
        canAddToDraft={false}
        sources={sources}
        allSources={sources}
        selectedSourceIds={EMPTY_SELECTION}
        onAddSource={() => undefined}
        onCopyText={onCopyText}
        onTranslateSource={onTranslateSource}
      />
    </div>
  );
};
