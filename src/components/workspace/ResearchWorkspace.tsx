import { useEffect, useState } from "react";
import { CatalogingPanel } from "@/components/workspace/CatalogingPanel";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CaseContextPanel } from "@/components/workspace/CaseContextPanel";
import { ConfidencePanel } from "@/components/workspace/ConfidencePanel";
import { ResponseBuilderPanel } from "@/components/workspace/ResponseBuilderPanel";
import { SimilarCasesPanel } from "@/components/workspace/SimilarCasesPanel";
import { SourcePanel } from "@/components/workspace/SourcePanel";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { CaseRecord, ResponseBite, SaveMetadataSuggestion, SimilarCaseMatch, SourceItem, StructureSuggestion } from "@/types";

type ResearchWorkspaceProps = {
  caseItem: CaseRecord;
  metadata?: SaveMetadataSuggestion;
  topicOptions: string[];
  audienceTypeOptions: string[];
  questionTypeOptions: string[];
  difficultyOptions: string[];
  likelyIntentOptions: string[];
  sources: SourceItem[];
  allSources: SourceItem[];
  savedBites: ResponseBite[];
  workspaceBites: ResponseBite[];
  selectedSourceIds: string[];
  matches: SimilarCaseMatch[];
  searchableCases: CaseRecord[];
  searchableBitesByCase: Record<string, ResponseBite[]>;
  structureSuggestions: StructureSuggestion[];
  isGeneratingStructure: boolean;
  isLoadingSimilar: boolean;
  onOpenCase: (caseId: string) => void;
  onCaseFieldChange: (
    field:
      | "title"
      | "originalQuestion"
      | "contextNote"
      | "personName"
      | "platform"
      | "topic"
      | "audienceType"
      | "questionType"
      | "difficulty"
      | "likelyIntent",
    value: string,
  ) => void;
  onTagsChange: (tags: string[]) => void;
  onAddSource: (sourceId: string) => void;
  onReuseSavedBite: (bite: ResponseBite) => void;
  onUpdateBite: (biteId: string, changes: Partial<ResponseBite>) => void;
  onAddBite: () => void;
  onMoveBite: (biteId: string, direction: "up" | "down") => void;
  onRemoveBite: (biteId: string) => void;
  onGenerateStructure: () => void;
  onAcceptSuggestion: (index: number) => void;
  onClearSuggestions: () => void;
  onAssessConfidence: () => void;
  onCopyText: (text: string, message?: string) => void;
  onSelectBite: (biteId: string) => void;
  onTranslateSource: (sourceId: string) => void;
  onTranslateBite: (bite: ResponseBite) => void;
  onTranslateSavedBite: (bite: ResponseBite) => void;
};

export const ResearchWorkspace = ({
  caseItem,
  metadata,
  topicOptions,
  audienceTypeOptions,
  questionTypeOptions,
  difficultyOptions,
  likelyIntentOptions,
  sources,
  allSources,
  savedBites,
  workspaceBites,
  selectedSourceIds,
  matches,
  searchableCases,
  searchableBitesByCase,
  structureSuggestions,
  isGeneratingStructure,
  isLoadingSimilar,
  onOpenCase,
  onCaseFieldChange,
  onTagsChange,
  onAddSource,
  onReuseSavedBite,
  onUpdateBite,
  onAddBite,
  onMoveBite,
  onRemoveBite,
  onGenerateStructure,
  onAcceptSuggestion,
  onClearSuggestions,
  onAssessConfidence,
  onCopyText,
  onSelectBite,
  onTranslateSource,
  onTranslateBite,
  onTranslateSavedBite,
}: ResearchWorkspaceProps) => {
  const getWorkspaceOverviewStorageKey = (caseId: string) => `dawah-workspace-overview:${caseId}`;
  const readWorkspaceOverviewState = (caseId: string) => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(getWorkspaceOverviewStorageKey(caseId));
    return stored === null ? true : stored === "open";
  };
  const [workspaceOverviewOpen, setWorkspaceOverviewOpen] = useState(() => readWorkspaceOverviewState(caseItem.caseId));

  useEffect(() => {
    setWorkspaceOverviewOpen(readWorkspaceOverviewState(caseItem.caseId));
  }, [caseItem.caseId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      getWorkspaceOverviewStorageKey(caseItem.caseId),
      workspaceOverviewOpen ? "open" : "collapsed",
    );
  }, [caseItem.caseId, workspaceOverviewOpen]);

  return (
    <div className="space-y-6">
      <section className="panel px-6 py-5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setWorkspaceOverviewOpen((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setWorkspaceOverviewOpen((value) => !value);
            }
          }}
          className="cursor-pointer rounded-2xl"
        >
          <SectionTitle
            title="Research Workspace"
            description="The workspace keeps case context, similar-case reuse, sources, drafting, and confidence review visible together instead of collapsing everything into chat."
            action={
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setWorkspaceOverviewOpen((value) => !value);
                }}
                className="inline-flex items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-900"
                aria-label={workspaceOverviewOpen ? "Collapse workspace overview" : "Expand workspace overview"}
              >
                {workspaceOverviewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            }
          />
        </div>
        {workspaceOverviewOpen ? (
          <div className="grid gap-6 border-t border-stone-200 pt-5 xl:grid-cols-[1.05fr,0.95fr]">
            <CaseContextPanel
              caseItem={caseItem}
              onCaseFieldChange={onCaseFieldChange}
              embedded
            />
            <CatalogingPanel
              caseItem={caseItem}
              metadata={metadata}
              topicOptions={topicOptions}
              audienceTypeOptions={audienceTypeOptions}
              questionTypeOptions={questionTypeOptions}
              difficultyOptions={difficultyOptions}
              likelyIntentOptions={likelyIntentOptions}
              onCaseFieldChange={onCaseFieldChange}
              onTagsChange={onTagsChange}
              embedded
            />
            <div className="xl:col-span-2">
              <SimilarCasesPanel
                matches={matches}
                searchableCases={searchableCases}
                searchableBitesByCase={searchableBitesByCase}
                isLoading={isLoadingSimilar}
                onOpenCase={onOpenCase}
                onReuseBite={onReuseSavedBite}
                embedded
                draftTitle={caseItem.title}
              />
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,1.2fr,0.8fr] xl:items-start">
        <SourcePanel
          sources={sources}
          allSources={allSources}
          selectedSourceIds={selectedSourceIds}
          onAddSource={onAddSource}
          onCopyText={onCopyText}
          onTranslateSource={onTranslateSource}
        />
        <ResponseBuilderPanel
          caseItem={caseItem}
          bites={workspaceBites}
          structureSuggestions={structureSuggestions}
          isGeneratingStructure={isGeneratingStructure}
          onAddBite={onAddBite}
          onGenerateStructure={onGenerateStructure}
          onClearSuggestions={onClearSuggestions}
          onMoveBite={onMoveBite}
          onUpdateBite={onUpdateBite}
          onRemoveBite={onRemoveBite}
          onAcceptSuggestion={onAcceptSuggestion}
          onCopyBite={(bite) =>
            onCopyText(
              bite.structuredSourceLayout === "split-source" ? bite.sourcePrimaryText ?? bite.biteText : bite.biteText,
            )
          }
          onTranslateBite={onTranslateBite}
          onCopyBiteTafsir={(bite) => onCopyText(bite.sourceTafsirText ?? "", "Copied tafsir note.")}
        />
        <ConfidencePanel bites={workspaceBites} onAssess={onAssessConfidence} onSelectBite={onSelectBite} />
      </div>
    </div>
  );
};
