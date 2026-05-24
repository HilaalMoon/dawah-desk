import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Copy, Send, Trash2 } from "lucide-react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { QuickAssistMessage } from "@/types";

type QuickAissistPanelProps = {
  messages: QuickAssistMessage[];
  isLoading: boolean;
  onSend: (prompt: string) => void;
  onClear: () => void;
  onCopy: (text: string) => void;
};

export const QuickAissistPanel = ({
  messages,
  isLoading,
  onSend,
  onClear,
  onCopy,
}: QuickAissistPanelProps) => {
  const [input, setInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const hasMessages = messages.length > 0;
  const trimmed = input.trim();

  const helperText = useMemo(
    () => "Quick text-only utility chat using the currently active AI model. Not part of case traceability.",
    [],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || isLoading) {
      return;
    }
    onSend(trimmed);
    setInput("");
  };

  useEffect(() => {
    if (latestMessageRef.current) {
      latestMessageRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (scrollContainerRef.current && isLoading) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isLoading]);

  return (
    <section className="panel flex flex-col px-6 py-6">
      <SectionTitle
        eyebrow="AI Utility"
        title="Quick AIssist"
        description={helperText}
        action={
          <button
            type="button"
            onClick={onClear}
            disabled={!hasMessages || isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={16} />
            Clear
          </button>
        }
      />

      <div className="flex h-[clamp(24rem,52vh,40rem)] min-h-0 flex-col rounded-3xl border border-stone-200 bg-stone-50 p-4">
        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-white p-4">
          {hasMessages ? (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.messageId}
                  ref={index === messages.length - 1 ? latestMessageRef : null}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[80%] rounded-2xl bg-slate-900 px-4 py-3 text-sm leading-7 text-white"
                        : "max-w-[80%] rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-7 text-slate-800"
                    }
                  >
                    <div className="whitespace-pre-wrap">{message.text}</div>
                    {message.role === "assistant" ? (
                      <button
                        type="button"
                        onClick={() => onCopy(message.text)}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        <Copy size={14} />
                        Copy
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {isLoading ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    <Bot size={16} />
                    <span>Waiting for AI response...</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-6 text-center text-sm text-slate-500">
              Send a quick text-only query to the currently active AI model.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a quick question..."
            rows={3}
            className="min-h-[88px] flex-1 resize-none rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-slate-400"
          />
          <button
            type="submit"
            disabled={!trimmed || isLoading}
            className="inline-flex items-center gap-2 self-end rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
            Send
          </button>
        </form>
      </div>
    </section>
  );
};
