import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Save } from "lucide-react";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { AnswerLibrary } from "@/components/library/AnswerLibrary";
import { SavedCaseDetail } from "@/components/library/SavedCaseDetail";
import { AdminSettingsPanel } from "@/components/admin/AdminSettingsPanel";
import { SourcesManagementPanel } from "@/components/admin/SourcesManagementPanel";
import { CredentialSetupScreen } from "@/components/setup/CredentialSetupScreen";
import { QuickAissistPanel } from "@/components/quick-assist/QuickAissistPanel";
import { HelpModal } from "@/components/help/HelpModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ToastItem, ToastViewport } from "@/components/ui/ToastViewport";
import { AppShell } from "@/components/layout/AppShell";
import { NewCaseForm } from "@/components/new-case/NewCaseForm";
import { TranslationModal } from "@/components/translation/TranslationModal";
import { ResearchWorkspace } from "@/components/workspace/ResearchWorkspace";
import { backendApi } from "@/services/backendApi";
import { useAppStore } from "@/state/useAppStore";
import { QuickAssistMessage, ResponseBite } from "@/types";
import { AdminSettingsPayload, AIProviderConfig, CaseExportFile } from "@/types/backend";
import {
  audienceTypeOptions as fallbackAudienceTypeOptions,
  difficultyOptions as fallbackDifficultyOptions,
  likelyIntentOptions as fallbackLikelyIntentOptions,
  questionTypeOptions as fallbackQuestionTypeOptions,
  topicOptions as fallbackTopicOptions,
} from "@/data/classificationOptions";

const App = () => {
  const {
    currentView,
    navigationLabel,
    searchTerm,
    savedCases,
    activeTabs,
    currentCaseId,
    draftForm,
    classificationDraft,
    isClassifying,
    isGeneratingStructure,
    isTranslating,
    similarMatches,
    structureSuggestionsByCase,
    saveMetadataByCase,
    workspaceBites,
    selectedSourceIds,
    recommendedSourcesByCase,
    sourceItems,
    savedBites,
    isLoadingSimilar,
    translationModalOpen,
    translationResult,
    selectedLibraryCaseId,
    setCurrentView,
    setSearchTerm,
    selectCase,
    updateDraftField,
    updateClassificationField,
    runClassification,
    createCaseFromDraft,
    closeTab,
    togglePinTab,
    addSourceToWorkspace,
    addSavedBiteToWorkspace,
    updateWorkspaceBite,
    addEmptyBite,
    moveBite,
    removeBite,
    generateStructure,
    acceptStructureSuggestion,
    clearStructureSuggestions,
    loadRecommendedSources,
    refreshSimilarMatches,
    assessConfidence,
    openTranslationModal,
    openTranslationForText,
    closeTranslationModal,
    insertTranslationIntoBites,
    confirmSaveCase,
    updateCaseDetails,
    updateCaseTags,
    saveSourceToLibrary,
    removeSourceFromLibrary,
    openLibrary,
    openCaseDetail,
    deleteSavedCase,
    duplicateCaseFromLibrary,
    hydrateFromBackendSnapshot,
  } = useAppStore();
  const [showHelp, setShowHelp] = useState(false);
  const [credentialsConfigured, setCredentialsConfigured] = useState<boolean | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingDeleteCaseId, setPendingDeleteCaseId] = useState<string | null>(null);
  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>([]);
  const [aiSettings, setAiSettings] = useState<AdminSettingsPayload | null>(null);
  const [quickAssistMessages, setQuickAssistMessages] = useState<QuickAssistMessage[]>([]);
  const [isQuickAssisting, setIsQuickAssisting] = useState(false);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const hasAttemptedBootstrapRecovery = useRef(false);

  const loadAiConfig = async () => {
    try {
      const [providers, settings] = await Promise.all([
        backendApi.getAIProviders(),
        backendApi.getSettings(),
      ]);
      setAiProviders(providers);
      setAiSettings(settings);
    } catch {
      // Leave the picker hidden if backend config is unavailable.
    }
  };

  const pushToast = (message: string, tone: ToastItem["tone"] = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  };

  const copyText = async (text: string, message = "Copied to clipboard.") => {
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    pushToast(message, "info");
  };

  const handleQuickAssist = async (prompt: string) => {
    const userMessage: QuickAssistMessage = {
      messageId: `quick-user-${Date.now()}`,
      role: "user",
      text: prompt,
    };
    setQuickAssistMessages((current) => [...current, userMessage]);
    setIsQuickAssisting(true);
    try {
      const response = await backendApi.quickAssist(prompt);
      const assistantMessage: QuickAssistMessage = {
        messageId: `quick-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "assistant",
        text: response.text?.trim() || "No response was returned by the active AI provider.",
      };
      setQuickAssistMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      const assistantMessage: QuickAssistMessage = {
        messageId: `quick-assistant-error-${Date.now()}`,
        role: "assistant",
        text: error instanceof Error ? error.message : "Quick AIssist failed.",
      };
      setQuickAssistMessages((current) => [...current, assistantMessage]);
    } finally {
      setIsQuickAssisting(false);
    }
  };

  const handleTranslateBite = async (bite: ResponseBite) => {
    if (bite.structuredSourceLayout === "split-source" && bite.sourceSecondaryText?.trim()) {
      await copyText(bite.sourceSecondaryText, "Copied stored English translation.");
      return;
    }

    try {
      await openTranslationForText(bite.biteText, bite.biteTitle, bite.sourceLinks, bite.aiAssisted, {
        executeNow: false,
      });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Translation failed.", "info");
    }
  };

  const confirmDeleteSavedCase = (caseId: string) => setPendingDeleteCaseId(caseId);

  const syncBackendSnapshot = useCallback(
    async (showRecoveryToast = false) => {
      try {
        const snapshot = await backendApi.getBootstrapState();
        const localSavedCaseCount = savedCases.filter((caseItem) => caseItem.status === "saved").length;
        const shouldAttemptRecovery =
          snapshot.savedCases.length > localSavedCaseCount || snapshot.sourceRecords.length > sourceItems.length;

        hydrateFromBackendSnapshot(snapshot);
        if (showRecoveryToast && shouldAttemptRecovery) {
          pushToast("Recovered saved cases and sources from backend storage.", "info");
        }
      } catch {
        // Keep current local state if backend sync is unavailable.
      }
    },
    [hydrateFromBackendSnapshot, savedCases, sourceItems.length],
  );

  const handleConfirmedDelete = async () => {
    if (!pendingDeleteCaseId) return;
    const caseItem = savedCases.find((item) => item.caseId === pendingDeleteCaseId);
    try {
      await backendApi.deleteCase(pendingDeleteCaseId);
    } catch {
      pushToast(`Could not delete "${caseItem?.title ?? "saved case"}" from backend storage.`, "info");
      return;
    }
    deleteSavedCase(pendingDeleteCaseId);
    setPendingDeleteCaseId(null);
    pushToast(`Deleted "${caseItem?.title ?? "saved case"}" from the library.`);
  };

  const handleImportCases = async (parsed: CaseExportFile): Promise<void> => {
    await backendApi.importCases(parsed);
    await syncBackendSnapshot(false);
  };

  const selectBiteInBuilder = (biteId: string) => {
    const element = document.getElementById(`builder-bite-${biteId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const currentCase = savedCases.find((item) => item.caseId === currentCaseId) ?? savedCases[0];
  const currentActiveTab = activeTabs.find((tab) => tab.caseId === currentCaseId) ?? null;
  const libraryCase = savedCases.find((item) => item.caseId === selectedLibraryCaseId) ?? savedCases[0];
  const pendingDeleteCase = savedCases.find((item) => item.caseId === pendingDeleteCaseId) ?? null;
  const filteredCases = savedCases.filter((caseItem) => {
    if (!searchTerm.trim()) return true;
    const metadataTags = saveMetadataByCase[caseItem.caseId]?.tags.join(" ") ?? "";
    const biteText = (workspaceBites[caseItem.caseId] ?? [])
      .map((bite) => `${bite.biteTitle} ${bite.biteText}`)
      .join(" ");
    const haystack = `${caseItem.title} ${caseItem.originalQuestion} ${caseItem.topic} ${caseItem.audienceType} ${metadataTags} ${biteText}`.toLowerCase();
    return haystack.includes(searchTerm.toLowerCase());
  });
  const filteredLibraryCases = filteredCases.filter((caseItem) => caseItem.status === "saved");
  const searchMatches = searchTerm.trim() ? filteredLibraryCases.slice(0, 6) : [];
  const sortLookupList = (values: string[]) =>
    [...values].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  const topicOptions = [
    ...new Set(
      (aiSettings?.general.topicsList?.length ? aiSettings.general.topicsList : [...fallbackTopicOptions]).concat(
        "zzGeneral",
      ),
    ),
  ].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
  const audienceTypeList = sortLookupList(
    aiSettings?.general.audienceTypeList?.length ? aiSettings.general.audienceTypeList : [...fallbackAudienceTypeOptions],
  );
  const questionTypeList = sortLookupList(
    aiSettings?.general.questionTypeList?.length ? aiSettings.general.questionTypeList : [...fallbackQuestionTypeOptions],
  );
  const difficultyList = sortLookupList(
    aiSettings?.general.difficultyList?.length ? aiSettings.general.difficultyList : [...fallbackDifficultyOptions],
  );
  const likelyIntentList = sortLookupList(
    aiSettings?.general.likelyIntentList?.length ? aiSettings.general.likelyIntentList : [...fallbackLikelyIntentOptions],
  );
  const hasUnsavedWorkspaceChanges =
    (currentView === "workspace" || currentView === "save-review") &&
    Boolean(currentActiveTab?.unsavedChangesFlag);
  const apiStatusMessage = isQuickAssisting
      ? "Waiting for Quick AIssist..."
      : isGeneratingStructure
      ? "Generating structured bite suggestions..."
      : isClassifying
        ? "Classifying this case with AI..."
        : isLoadingSimilar
          ? "Checking similar cases..."
          : null;

  const confirmLeaveUnsavedCase = () =>
    !hasUnsavedWorkspaceChanges ||
    window.confirm("You have unsaved case changes. Leave this case without saving or updating it?");

  const handleSelectCase = (caseId: string) => {
    if (caseId === currentCaseId && currentView === "workspace") {
      return;
    }
    if (!confirmLeaveUnsavedCase()) {
      return;
    }
    selectCase(caseId);
  };

  const handleOpenLibraryCase = (caseId: string) => {
    if (!confirmLeaveUnsavedCase()) {
      return;
    }
    openCaseDetail(caseId);
  };

  const handleCloseTab = (tabId: string) => {
    const tab = activeTabs.find((item) => item.tabId === tabId);
    const shouldWarn =
      tab?.caseId === currentCaseId
        ? hasUnsavedWorkspaceChanges
        : Boolean(tab?.unsavedChangesFlag);

    if (
      shouldWarn &&
      !window.confirm("This case has unsaved changes. Close it without saving or updating it?")
    ) {
      return;
    }

    closeTab(tabId);
  };

  useEffect(() => {
    if (currentView === "workspace" && currentCaseId && similarMatches.length === 0) {
      void refreshSimilarMatches();
    }
  }, [currentCaseId, currentView, refreshSimilarMatches, similarMatches.length]);

  useEffect(() => {
    if (currentView === "workspace" && currentCaseId && !(recommendedSourcesByCase[currentCaseId]?.length)) {
      void loadRecommendedSources(currentCaseId);
    }
  }, [currentCaseId, currentView, loadRecommendedSources, recommendedSourcesByCase]);

  useEffect(() => {
    backendApi
      .getCredentialsStatus()
      .then(({ configured }) => setCredentialsConfigured(configured))
      .catch(() => setCredentialsConfigured(true)); // Fail open — don't block the app if backend is unreachable.
  }, []);

  useEffect(() => {
    void loadAiConfig();
  }, []);

  useEffect(() => {
    if (hasAttemptedBootstrapRecovery.current) {
      return;
    }
    hasAttemptedBootstrapRecovery.current = true;
    void syncBackendSnapshot(true);
  }, [syncBackendSnapshot]);

  useEffect(() => {
    const handleWindowFocus = () => {
      void syncBackendSnapshot(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncBackendSnapshot(false);
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncBackendSnapshot(false);
      }
    }, 30000);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [syncBackendSnapshot]);

  useEffect(() => {
    if (currentView === "workspace" || currentView === "settings") {
      void loadAiConfig();
    }
  }, [currentView]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedWorkspaceChanges) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedWorkspaceChanges]);

  const enabledProviderModelOptions = aiProviders.flatMap((provider) =>
    provider.enabled
      ? provider.modelOptions
          .filter((model) => model.enabled)
          .map((model) => ({
            value: `${provider.providerId}::${model.modelId}`,
            label: `${provider.name} / ${model.label}`,
            providerId: provider.providerId,
            modelId: model.modelId,
          }))
      : [],
  );

  const globalModelPicker =
    enabledProviderModelOptions.length > 0 && aiSettings ? (
      <div key="global-ai" className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
        <Bot size={15} className="text-slate-500" />
        <select
          value={`${aiSettings.aiDefaults.defaultProviderId}::${aiSettings.aiDefaults.defaultModelId}`}
          onChange={(event) => {
            const [defaultProviderId, defaultModelId] = event.target.value.split("::");
            void backendApi
              .updateSettings({
                aiDefaults: { defaultProviderId, defaultModelId },
              })
              .then((nextSettings) => {
                const nextLabel =
                  enabledProviderModelOptions.find(
                    (option) => option.providerId === defaultProviderId && option.modelId === defaultModelId,
                  )?.label ?? "selected model";
                setAiSettings(nextSettings);
                pushToast(`Active model set to ${nextLabel}.`, "info");
              });
          }}
          className="min-w-[220px] border-none bg-transparent text-sm outline-none"
          aria-label="Active AI model"
        >
          {enabledProviderModelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  const workspaceActions =
    currentView === "workspace"
      ? [
          <button
            key="save-case"
            type="button"
            onClick={() => {
              if (currentCaseId) {
                confirmSaveCase(currentCaseId);
                void backendApi.saveCase({
                  caseItem: {
                    ...(savedCases.find((item) => item.caseId === currentCaseId) ?? currentCase),
                    caseId: currentCaseId,
                    status: "saved",
                    updatedDate: new Date().toISOString(),
                    responseBiteIds: (workspaceBites[currentCaseId] ?? []).map((bite) => bite.biteId),
                    sourceIdsUsed: selectedSourceIds[currentCaseId] ?? [],
                  },
                  bites: workspaceBites[currentCaseId] ?? [],
                });
                pushToast(
                  currentCase?.status === "saved"
                    ? `Updated "${currentCase?.title ?? "case"}".`
                    : `Saved "${currentCase?.title ?? "case"}" to the library.`,
                );
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            <Save size={16} />
            {currentCase?.status === "saved" ? "Update Saved Case" : "Save Case"}
          </button>,
        ]
      : undefined;

  const topBarActions = [globalModelPicker, ...(workspaceActions ?? [])].filter(Boolean);

  if (credentialsConfigured === null) return null;
  if (!credentialsConfigured) {
    return <CredentialSetupScreen onComplete={() => setCredentialsConfigured(true)} />;
  }

  return (
    <>
      <AppShell
        currentView={currentView}
        title={navigationLabel}
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchMatches={searchMatches}
        onOpenSearchCase={(caseId) => {
          if (!confirmLeaveUnsavedCase()) {
            return;
          }
          setSearchTerm("");
          openCaseDetail(caseId);
        }}
        activeTabs={activeTabs}
        cases={savedCases}
        currentCaseId={currentCaseId}
        onSelectCase={handleSelectCase}
        onCloseTab={handleCloseTab}
        onTogglePin={togglePinTab}
        topBarActions={topBarActions}
        onHelpOpen={() => setShowHelp(true)}
        overlays={
          <>
            <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
            {pendingDeleteCase ? (
              <ConfirmModal
                title="Delete saved case?"
                description={`"${pendingDeleteCase.title}" will be removed from the library and its saved workspace data will be cleared.`}
                confirmLabel="Delete case"
                onConfirm={handleConfirmedDelete}
                onCancel={() => setPendingDeleteCaseId(null)}
              />
            ) : null}
          </>
        }
        apiStatusMessage={apiStatusMessage}
        onNavigate={(view) => {
          if (view === "library") {
            if (!confirmLeaveUnsavedCase()) {
              return;
            }
            openLibrary();
            return;
          }
          if (view === "settings") {
            if (!confirmLeaveUnsavedCase()) {
              return;
            }
            setCurrentView("settings", "Admin / AI Settings");
            return;
          }
          if (view === "sources") {
            if (!confirmLeaveUnsavedCase()) {
              return;
            }
            setCurrentView("sources", "Sources Management");
            return;
          }
          if (view === "quick-aissist") {
            if (!confirmLeaveUnsavedCase()) {
              return;
            }
            setCurrentView("quick-aissist", "Quick AIssist");
            return;
          }
          if (view === "workspace" && currentCaseId) {
            setCurrentView("workspace", currentCase?.title ?? "Research Workspace");
            return;
          }
          if (!confirmLeaveUnsavedCase()) {
            return;
          }
          setCurrentView(view, view === "new-case" ? "New Case Setup" : "Home");
        }}
      >
        {currentView === "home" ? (
          <HomeDashboard
            savedCases={filteredCases}
            activeCaseIds={activeTabs.map((tab) => tab.caseId)}
            sourceItems={sourceItems}
            onCreateCase={() => setCurrentView("new-case", "New Case Setup")}
            onOpenCase={(caseId) => handleSelectCase(caseId)}
            onCopyText={(text, message) => void copyText(text, message)}
          />
        ) : null}

        {currentView === "new-case" ? (
          <NewCaseForm
            draft={draftForm}
            classification={classificationDraft}
            topicOptions={topicOptions}
            audienceTypeOptions={audienceTypeList}
            questionTypeOptions={questionTypeList}
            difficultyOptions={difficultyList}
            likelyIntentOptions={likelyIntentList}
            isClassifying={isClassifying}
            similarMatches={similarMatches}
            isLoadingSimilar={isLoadingSimilar}
            onDraftChange={updateDraftField}
            onClassificationChange={updateClassificationField}
            classificationError={classificationError}
            onRunClassification={() => {
              setClassificationError(null);
              runClassification().catch(() => {
                setClassificationError("AI classification is not available. Please check your connection in Settings.");
              });
            }}
            onOpenWorkspace={() => void createCaseFromDraft()}
            onOpenSimilarCase={handleSelectCase}
          />
        ) : null}

        {currentView === "workspace" && currentCase ? (
          <ResearchWorkspace
            caseItem={currentCase}
            metadata={saveMetadataByCase[currentCase.caseId]}
            topicOptions={topicOptions}
            audienceTypeOptions={audienceTypeList}
            questionTypeOptions={questionTypeList}
            difficultyOptions={difficultyList}
            likelyIntentOptions={likelyIntentList}
            sources={(recommendedSourcesByCase[currentCase.caseId] ?? []).map((item) => item.source)}
            allSources={sourceItems}
            savedBites={savedBites}
            workspaceBites={workspaceBites[currentCase.caseId] ?? []}
            selectedSourceIds={selectedSourceIds[currentCase.caseId] ?? []}
            matches={similarMatches.filter((match) => match.caseItem.caseId !== currentCase.caseId)}
            searchableCases={savedCases.filter((caseItem) => caseItem.status === "saved" && caseItem.caseId !== currentCase.caseId)}
            searchableBitesByCase={workspaceBites}
            structureSuggestions={structureSuggestionsByCase[currentCase.caseId] ?? []}
            isGeneratingStructure={isGeneratingStructure}
            isLoadingSimilar={isLoadingSimilar}
            onOpenCase={handleSelectCase}
            onCaseFieldChange={(field, value) => updateCaseDetails(currentCase.caseId, { [field]: value })}
            onTagsChange={(tags) => updateCaseTags(currentCase.caseId, tags)}
            onAddSource={(sourceId) => addSourceToWorkspace(currentCase.caseId, sourceId)}
            onReuseSavedBite={(bite) => {
              addSavedBiteToWorkspace(currentCase.caseId, bite);
              pushToast(`Reused bite "${bite.biteTitle}".`);
            }}
            onUpdateBite={(biteId, changes) => {
              updateWorkspaceBite(currentCase.caseId, biteId, changes);
              const isConversationUsageOnly =
                Object.keys(changes).length === 1 && Object.prototype.hasOwnProperty.call(changes, "usedInConversation");
              if (isConversationUsageOnly && currentCase.status === "saved") {
                const nextState = useAppStore.getState();
                const updatedCase = nextState.savedCases.find((item) => item.caseId === currentCase.caseId);
                if (updatedCase) {
                  void backendApi.saveCase({
                    caseItem: {
                      ...updatedCase,
                      responseBiteIds: (nextState.workspaceBites[currentCase.caseId] ?? []).map((bite) => bite.biteId),
                      sourceIdsUsed: nextState.selectedSourceIds[currentCase.caseId] ?? [],
                    },
                    bites: nextState.workspaceBites[currentCase.caseId] ?? [],
                  });
                }
              }
            }}
            onAddBite={() => addEmptyBite(currentCase.caseId)}
            onMoveBite={(biteId, direction) => moveBite(currentCase.caseId, biteId, direction)}
            onRemoveBite={(biteId) => removeBite(currentCase.caseId, biteId)}
            onGenerateStructure={() =>
              void generateStructure(currentCase.caseId).catch((error) => {
                const message =
                  error instanceof Error && error.message
                    ? error.message
                    : "Live AI structure generation failed.";
                pushToast(message, "info");
              })
            }
            onAcceptSuggestion={(index) => acceptStructureSuggestion(currentCase.caseId, index)}
            onClearSuggestions={() => clearStructureSuggestions(currentCase.caseId)}
            onAssessConfidence={() => void assessConfidence(currentCase.caseId)}
            onCopyText={(text) => void copyText(text)}
            onSelectBite={selectBiteInBuilder}
            onTranslateSource={(sourceId) => {
              const source = sourceItems.find((item) => item.sourceId === sourceId);
              if ((source?.sourceType === "quran" || source?.sourceType === "hadith") && source.authenticatedTranslation?.trim()) {
                void copyText(source.authenticatedTranslation, "Copied stored English translation.");
                return;
              }
              void openTranslationModal(sourceId).catch((error) => {
                pushToast(error instanceof Error ? error.message : "Translation failed.", "info");
              });
            }}
            onTranslateBite={(bite) => void handleTranslateBite(bite)}
            onTranslateSavedBite={(bite) => void handleTranslateBite(bite)}
          />
        ) : null}

        {currentView === "library" ? (
          <AnswerLibrary
            cases={filteredLibraryCases}
            bitesByCase={workspaceBites}
            onOpenCase={(caseId) => handleOpenLibraryCase(caseId)}
            onDeleteCase={confirmDeleteSavedCase}
            onImportCases={handleImportCases}
          />
        ) : null}

        {currentView === "sources" ? (
          <SourcesManagementPanel
            sourceLibrary={sourceItems}
            onSaveSource={(source) => {
              saveSourceToLibrary(source);
              void backendApi.saveSourceRecord(source);
            }}
            onDeleteSource={(sourceId) => {
              removeSourceFromLibrary(sourceId);
              void backendApi.deleteSourceRecord(sourceId);
            }}
            onNotify={pushToast}
          />
        ) : null}

        {currentView === "quick-aissist" ? (
          <QuickAissistPanel
            messages={quickAssistMessages}
            isLoading={isQuickAssisting}
            onSend={(prompt) => void handleQuickAssist(prompt)}
            onClear={() => setQuickAssistMessages([])}
            onCopy={(text) => void copyText(text, "Copied AI response.")}
          />
        ) : null}

        {currentView === "settings" ? (
          <AdminSettingsPanel
            onNotify={pushToast}
            onRestoreComplete={() => syncBackendSnapshot(false)}
          />
        ) : null}

        {currentView === "case-detail" && libraryCase ? (
          <SavedCaseDetail
            caseItem={libraryCase}
            bites={workspaceBites[libraryCase.caseId] ?? savedBites.filter((bite) => bite.caseId === libraryCase.caseId)}
            sources={sourceItems}
            onReuseSequence={() => {
              duplicateCaseFromLibrary(libraryCase.caseId);
              pushToast(`Created a new working copy of "${libraryCase.title}".`);
            }}
            onOpenWorkspace={() => handleSelectCase(libraryCase.caseId)}
          />
        ) : null}
      </AppShell>
      {showHelp ? <HelpModal onClose={() => setShowHelp(false)} /> : null}
      {translationModalOpen && translationResult && currentCaseId ? (
        <TranslationModal
          result={translationResult}
          isTranslating={isTranslating}
          onInsert={(selectedText) => insertTranslationIntoBites(currentCaseId, selectedText)}
          onCopy={(selectedText) => void copyText(selectedText, "Copied translation.")}
          onCancel={closeTranslationModal}
          onReword={({ targetLanguageInput, targetLanguageCode, targetLanguageLabel }) =>
            void openTranslationForText(
              translationResult.originalText,
              translationResult.sourceTitle ?? "Translation",
              translationResult.sourceLinks,
              Boolean(translationResult.aiAssisted),
              {
                executeNow: true,
                targetLanguageLabel: targetLanguageLabel ?? targetLanguageInput,
                targetLanguageCode,
              },
            ).catch((error) => {
              pushToast(error instanceof Error ? error.message : "Translation failed.", "info");
            })
          }
        />
      ) : null}
    </>
  );
};

export default App;
