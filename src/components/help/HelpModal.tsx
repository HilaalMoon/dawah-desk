import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

type Tab = "what-is-this" | "quick-start" | "key-concepts" | "help";

const AiFeatureBox = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <div className="rounded-lg border-l-2 border-blue-200 bg-blue-50 px-3.5 py-2.5">
    <div className="flex items-center gap-1.5">
      <Sparkles size={14} className="shrink-0 text-blue-500" />
      <span className="font-medium text-slate-900">{name}</span>
    </div>
    <p className="mt-1.5 text-slate-700">{children}</p>
  </div>
);

const TABS: { id: Tab; label: string }[] = [
  { id: "what-is-this", label: "What is this?" },
  { id: "quick-start", label: "Quick start" },
  { id: "key-concepts", label: "Key concepts" },
  { id: "help", label: "Help" },
];

type Props = {
  onClose: () => void;
};

const WhatIsThis = () => (
  <div className="space-y-4 text-sm text-slate-700">
    <p>Da'wah Desk is a private workspace that helps you manage da'wah conversations case by case.</p>
    <p>It is not a chatbot. It includes AI assistance, but AI is a helper — not the decision-maker. You stay in control of what gets saved and what gets used.</p>
    <p>It is designed for Muslim da'ees answering questions in live chat, social media, or in person, and for anyone who wants to build reusable, source-backed responses over time.</p>
    <p>It is not a fatwa tool, not a generic AI chatbot, and not a replacement for human judgment.</p>
    <p className="font-medium text-slate-900">The simple workflow: Question → Create a case → Check similar cases → Find sources → Draft bites → Save for reuse</p>
    <AiFeatureBox name="With AI connected">
      The app also suggests the right topic, audience type, and difficulty for each new case; proposes a response structure of short bites based on your question; and translates source content into your target language on request. The app works without AI, but AI turns it into a significantly more powerful tool.
    </AiFeatureBox>
  </div>
);

const QuickStart = () => (
  <div className="space-y-5 text-sm text-slate-700">
    <div>
      <p className="font-semibold text-slate-900">Your first session in 5 steps:</p>
      <ol className="mt-3 space-y-3 pl-5 list-decimal">
        <li>Go to New Case and enter the question you need to answer</li>
        <li>
          <AiFeatureBox name="Suggest Classification">
            Click Suggest Classification — if AI is connected, the app will suggest a topic, audience type, and difficulty based on your question
          </AiFeatureBox>
        </li>
        <li>Check the similar cases shown at the bottom — you may already have a useful saved case</li>
        <li>Go to Sources, search Quran.com or Sunnah.com directly from the app, and save the sources you need to your library</li>
        <li>
          <AiFeatureBox name="Suggest Structure">
            Open the Workspace, add your saved sources, use Suggest Structure to get AI-proposed bites, refine them, and save the case
          </AiFeatureBox>
        </li>
      </ol>
    </div>
    <p>What success looks like after your first session: 1 saved case, 1 to 3 sources saved from Quran.com or Sunnah.com, 2 to 3 short response bites, 1 reusable answer ready for next time.</p>
    <div className="space-y-2">
      <p>AI features available in this workflow:</p>
      <AiFeatureBox name="Suggest Classification">in New Case</AiFeatureBox>
      <AiFeatureBox name="Suggest Structure">in the Workspace</AiFeatureBox>
      <AiFeatureBox name="Translate">on individual bites in the Workspace</AiFeatureBox>
    </div>
  </div>
);

const KeyConcepts = () => (
  <div className="space-y-5 text-sm text-slate-700">
    <div>
      <p className="font-semibold text-slate-900">Case</p>
      <p className="mt-1">A case is one da'wah question and everything you build to answer it — sources, bites, and notes. Cases are saved in your Case Library and can be reopened and reused.</p>
    </div>
    <div>
      <p className="font-semibold text-slate-900">Bite</p>
      <p className="mt-1">A bite is one short piece of your response — one point, one argument, one source reference. Responses are built from multiple short bites rather than one long paragraph. This makes them easier to reuse and easier to adapt to different conversations.</p>
      <div className="mt-2">
        <AiFeatureBox name="Suggest Structure">
          If AI is connected, use Suggest Structure in the Workspace to get a proposed set of bites for your case. AI proposes, you decide.
        </AiFeatureBox>
      </div>
    </div>
    <div>
      <p className="font-semibold text-slate-900">Source</p>
      <p className="mt-1">A source is a Quran verse, hadith, scholarly note, or user-written content saved in your Source Library. Sources are saved once and reused across many cases.</p>
    </div>
    <div>
      <p className="font-semibold text-slate-900">Authenticated online sources — Quran.com and Sunnah.com</p>
      <p className="mt-1">The Sources menu gives you direct access to Quran.com and Sunnah.com — the same authenticated sources da'ees use and trust. You can search for verses and hadiths by keyword, retrieve the Arabic text with translation, and save them to your library in one step. No copy-pasting between browser tabs. No losing track of references. This works without AI and is one of the most valuable features in the app.</p>
    </div>
    <AiFeatureBox name="Translation">
      If AI is connected, you can translate any bite into another language directly from the Workspace. Click the translate button on a bite, choose your target language, and the AI produces a translation for your review. You decide whether to keep it. Translation is never automatic. For Quran and Sunnah sources, stored English translations are used directly — no AI translation needed.
    </AiFeatureBox>
    <div>
      <p className="font-semibold text-slate-900">Support status</p>
      <p className="mt-1">Every bite shows where its content comes from — Direct source, Translated source, AI assisted, Weak support, or Missing support. This distinction is always visible so you always know how much to trust each bite.</p>
      <div className="mt-2">
        <AiFeatureBox name="AI assisted">
          AI assisted — drafted with AI help, needs human review.
        </AiFeatureBox>
      </div>
    </div>
    <div>
      <p className="font-semibold text-slate-900">Quick AIssist</p>
      <p className="mt-1">A lightweight text-only chat for quick model questions. It does not save history and is not connected to your cases or sources. Use it for quick lookups without leaving the app.</p>
    </div>
  </div>
);

const HelpContent = () => (
  <div className="space-y-5 text-sm text-slate-700">
    <AiFeatureBox name="AI does not respond">
      Go to Settings, check Backend Credential Check, click Test connection on the Vertex AI provider. If it fails, click Update Credentials and paste your credential file again. Note: the app still works without AI — you can create cases, save sources, and build bites manually.
    </AiFeatureBox>
    <div>
      <p className="font-semibold text-slate-900">Quran or Sunnah search returns no results</p>
      <p className="mt-1">Check your internet connection — live source retrieval requires internet access. Try a different search term or search by surah name. If the problem continues, check Settings for connector status.</p>
    </div>
    <div>
      <p className="font-semibold text-slate-900">A case does not save</p>
      <p className="mt-1">Check the backend terminal window is still running. Close and reopen the app using the DawahDesk shortcut. Try saving again.</p>
    </div>
    <div>
      <p className="font-semibold text-slate-900">A source is missing from the library</p>
      <p className="mt-1">Go to Sources and check the Saved Source Library. Restart the app and check again.</p>
    </div>
    <div>
      <p className="font-semibold text-slate-900">The app opens but shows the credential setup screen</p>
      <p className="mt-1">Your credential file is missing or was deleted. Paste the credential file you received from your system administrator and click Save.</p>
    </div>
    <AiFeatureBox name="Suggest Classification or Suggest Structure does not work">
      These features require AI to be connected. Go to Settings and check that Vertex AI shows Connection healthy. If not, click Update Credentials and paste your credential file again.
    </AiFeatureBox>
    <AiFeatureBox name="Quick AIssist shows an error">
      Check which model is selected in the top bar. Try switching to a different Gemini model in the dropdown. If all models fail, check Settings for credential issues.
    </AiFeatureBox>
    <div>
      <p className="font-semibold text-slate-900">I cannot find a case I saved</p>
      <p className="mt-1">Go to Case Library. Use the search bar at the top of the app to search by title or topic. If still missing, restart the app — the backend will reload saved cases on startup.</p>
    </div>
  </div>
);

export const HelpModal = ({ onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<Tab>("what-is-this");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        style={{ maxHeight: "calc(100vh - 3rem)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-4">
          <div className="flex flex-wrap gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-stone-100 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 rounded-xl border border-stone-200 p-2 text-slate-500 hover:bg-stone-50 hover:text-slate-900"
            aria-label="Close help"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {activeTab === "what-is-this" && <WhatIsThis />}
          {activeTab === "quick-start" && <QuickStart />}
          {activeTab === "key-concepts" && <KeyConcepts />}
          {activeTab === "help" && <HelpContent />}
        </div>
      </div>
    </div>
  );
};
