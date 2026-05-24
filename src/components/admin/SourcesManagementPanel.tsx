import { useEffect, useMemo, useState } from "react";
import {
  BookText,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  Eye,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { backendApi } from "@/services/backendApi";
import { BackendSecretsPayload, ConnectorConfig, QuranTafsirResource, QuranTranslationResource } from "@/types/backend";
import { SourceItem } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { downloadCsv } from "@/utils/csv";
import { classNames } from "@/utils/format";

type SourcesManagementPanelProps = {
  sourceLibrary: SourceItem[];
  onSaveSource: (source: SourceItem) => void;
  onDeleteSource: (sourceId: string) => void;
  onNotify: (message: string, tone?: "success" | "info") => void;
};

type ConnectorDraft = {
  name: string;
  category: ConnectorConfig["category"];
  connectionType: ConnectorConfig["connectionType"];
  baseUrl: string;
  apiKeyRef: string;
  trustTier: ConnectorConfig["trustTier"];
  notes: string;
};

type ManualSourceDraft = {
  sourceTitle: string;
  fullReference: string;
  topic: string;
  sourceType: SourceItem["sourceType"];
  sourceLanguage: SourceItem["sourceLanguage"];
  trustLevel: SourceItem["trustLevel"];
  excerpt: string;
  authenticatedTranslation: string;
  translationResourceName: string;
};

const blankDraft: ConnectorDraft = {
  name: "",
  category: "other",
  connectionType: "manual",
  baseUrl: "",
  apiKeyRef: "",
  trustTier: 2,
  notes: "",
};

const blankManualSourceDraft: ManualSourceDraft = {
  sourceTitle: "",
  fullReference: "",
  topic: "",
  sourceType: "user-note",
  sourceLanguage: "English",
  trustLevel: "medium",
  excerpt: "",
  authenticatedTranslation: "",
  translationResourceName: "",
};

const categoryLabels: Record<ConnectorConfig["category"], string> = {
  quran: "Quran",
  "hadith-en": "Sunnah (English)",
  "hadith-ar": "Sunnah (Arabic)",
  other: "Approved other",
  ai: "AI",
  web: "Web fallback",
};

const connectionTypeLabels: Record<ConnectorConfig["connectionType"], string> = {
  api: "API",
  web: "Web",
  manual: "Manual",
};

const sourceTypeLabels: Record<SourceItem["sourceType"], string> = {
  quran: "Qur'an",
  hadith: "Sunnah",
  "scholarly-note": "Scholarly Notes",
  "user-note": "User Notes",
  article: "Articles",
  "saved-bite": "Saved Bites",
};

const retrieveConnectorMeta = {
  quran: {
    connectorId: "conn-quran-primary",
    connectorName: "Quran Foundation Adapter",
  },
  hadith: {
    connectorId: "connector-hadith",
    connectorName: "Sunnah connector",
  },
} as const;

const formatConnectorBadge = (source: SourceItem) => {
  if (source.connectorName === "Quran Foundation Adapter") {
    return "Quran.com";
  }

  if (source.connectorName) {
    return source.connectorName;
  }

  return source.sourceOrigin === "manual" ? "Manual / no connector" : "Built-in / seeded";
};

const getFallbackSourceLabel = (source: SourceItem) => {
  if (source.connectorId !== "conn-web-fallback") {
    return null;
  }

  if (source.connectorName === "Quran.com" || source.connectorName === "Sunnah.com") {
    return source.connectorName;
  }

  return "approved domain";
};

const formatSourceReference = (source: SourceItem) => {
  if (source.sourceType === "quran" && (source.authenticatedTranslation || source.tafsirText)) {
    return source.fullReference;
  }

  if (source.sourceType === "scholarly-note" && source.connectorId === "conn-quran-primary") {
    if (source.tafsirResourceName) {
      return source.tafsirResourceName.startsWith("Tafsir")
        ? source.tafsirResourceName
        : `Tafsir ${source.tafsirResourceName}`;
    }
    if (source.translationResourceName) {
      return source.translationResourceName.includes("translation")
        ? source.translationResourceName
        : `${source.translationResourceName} translation`;
    }
    if (source.fullReference) {
      return source.fullReference;
    }
  }

  if (source.tafsirText && source.tafsirResourceName) {
    return source.tafsirResourceName;
  }

  if (source.authenticatedTranslation && source.translationResourceName) {
    return `${source.translationResourceName} translation`;
  }

  return source.fullReference;
};

const buildVariantAwareSource = (source: SourceItem, category: "quran" | "hadith"): SourceItem => {
  if (category !== "quran") {
    return source;
  }

  const translationPart = source.translationResourceId ? `tr-${source.translationResourceId}` : "tr-none";
  const tafsirPart = source.tafsirResourceId ? `tf-${source.tafsirResourceId}` : "tf-none";

  return {
    ...source,
    sourceId: `${source.sourceId}-${translationPart}-${tafsirPart}`,
  };
};

const normalizeSource = (source: SourceItem): SourceItem => ({
  ...source,
  sourceTitle: typeof source.sourceTitle === "string" ? source.sourceTitle : String(source.sourceTitle ?? "Untitled source"),
  excerpt: typeof source.excerpt === "string" ? source.excerpt : String(source.excerpt ?? ""),
  fullReference: typeof source.fullReference === "string" ? source.fullReference : String(source.fullReference ?? ""),
  topic: typeof source.topic === "string" ? source.topic : source.topic == null ? undefined : String(source.topic),
  authenticatedTranslation:
    typeof source.authenticatedTranslation === "string"
      ? source.authenticatedTranslation
      : source.authenticatedTranslation == null
        ? undefined
        : String(source.authenticatedTranslation),
  tafsirText:
    typeof source.tafsirText === "string"
      ? source.tafsirText
      : source.tafsirText == null
        ? undefined
        : String(source.tafsirText),
  tafsirResourceName:
    typeof source.tafsirResourceName === "string"
      ? source.tafsirResourceName
      : source.tafsirResourceName == null
        ? undefined
        : String(source.tafsirResourceName),
  translationResourceName:
    typeof source.translationResourceName === "string"
      ? source.translationResourceName
      : source.translationResourceName == null
        ? undefined
        : String(source.translationResourceName),
  trustLevel: source.trustLevel ?? "needs-review",
  sourceType: source.sourceType ?? "article",
  sourceLanguage: source.sourceLanguage ?? "English",
  translationAvailable: Boolean(source.translationAvailable),
  linkedBiteIds: Array.isArray(source.linkedBiteIds) ? source.linkedBiteIds : [],
});

const SELECTED_TRANSLATION_STORAGE_KEY = "dawah-desk.selected-quran-translation-resource";
const SELECTED_TAFSIR_STORAGE_KEY = "dawah-desk.selected-quran-tafsir-resource";

const readStoredTranslationResourceId = () => {
  if (typeof window === "undefined") return 20;
  const storedTranslation = window.localStorage.getItem(SELECTED_TRANSLATION_STORAGE_KEY);
  const parsed = Number(storedTranslation);
  return Number.isNaN(parsed) ? 20 : parsed;
};

const readStoredTafsirResourceId = (): number | "none" => {
  if (typeof window === "undefined") return "none";
  const storedTafsir = window.localStorage.getItem(SELECTED_TAFSIR_STORAGE_KEY);
  if (!storedTafsir || storedTafsir === "none") return "none";
  const parsed = Number(storedTafsir);
  return Number.isNaN(parsed) ? "none" : parsed;
};

const sortLookupList = (values: string[]) =>
  [...values].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));

const sourceToCsvRow = (source: SourceItem) => ({
  sourceId: source.sourceId,
  sourceTitle: source.sourceTitle,
  sourceType: source.sourceType,
  topic: source.topic ?? "",
  sourceLanguage: source.sourceLanguage,
  excerpt: source.excerpt,
  fullReference: source.fullReference,
  trustLevel: source.trustLevel,
  translationAvailable: source.translationAvailable,
  authenticatedTranslation: source.authenticatedTranslation ?? "",
  translationResourceId: source.translationResourceId ?? "",
  translationResourceName: source.translationResourceName ?? "",
  tafsirText: source.tafsirText ?? "",
  tafsirResourceId: source.tafsirResourceId ?? "",
  tafsirResourceName: source.tafsirResourceName ?? "",
  tafsirLanguageName: source.tafsirLanguageName ?? "",
  linkedBiteIds: source.linkedBiteIds.join(" | "),
  sourceOrigin: source.sourceOrigin ?? "",
  connectorId: source.connectorId ?? "",
  connectorName: source.connectorName ?? "",
  accessCount: source.accessCount ?? 0,
});

export const SourcesManagementPanel = ({
  sourceLibrary,
  onSaveSource,
  onDeleteSource,
  onNotify,
}: SourcesManagementPanelProps) => {
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [secretsPayload, setSecretsPayload] = useState<BackendSecretsPayload | null>(null);
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<ConnectorDraft>(blankDraft);
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [managementCollapsed, setManagementCollapsed] = useState(true);
  const [manualSourceCollapsed, setManualSourceCollapsed] = useState(true);
  const [retrieveCollapsed, setRetrieveCollapsed] = useState(true);
  const [retrieveCategory, setRetrieveCategory] = useState<"quran" | "hadith">("quran");
  const [retrieveQuery, setRetrieveQuery] = useState("");
  const [translationResources, setTranslationResources] = useState<QuranTranslationResource[]>([]);
  const [selectedTranslationResourceId, setSelectedTranslationResourceId] = useState<number>(readStoredTranslationResourceId);
  const [tafsirResources, setTafsirResources] = useState<QuranTafsirResource[]>([]);
  const [selectedTafsirResourceId, setSelectedTafsirResourceId] = useState<number | "none">(readStoredTafsirResourceId);
  const [expandedRetrievedSourceIds, setExpandedRetrievedSourceIds] = useState<string[]>([]);
  const [retrievedSources, setRetrievedSources] = useState<SourceItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [retrieveError, setRetrieveError] = useState<string | null>(null);
  const [reviewingSource, setReviewingSource] = useState<SourceItem | null>(null);
  const [reviewDraft, setReviewDraft] = useState<SourceItem | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySourceType, setLibrarySourceType] = useState<SourceItem["sourceType"] | "all">("all");
  const [libraryConnectorFilter, setLibraryConnectorFilter] = useState("all");
  const [expandedSavedSourceIds, setExpandedSavedSourceIds] = useState<string[]>([]);
  const [topicsList, setTopicsList] = useState<string[]>([]);
  const [newTopicDraft, setNewTopicDraft] = useState("");
  const [manualDraft, setManualDraft] = useState<ManualSourceDraft>(blankManualSourceDraft);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SELECTED_TRANSLATION_STORAGE_KEY, String(selectedTranslationResourceId));
  }, [selectedTranslationResourceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SELECTED_TAFSIR_STORAGE_KEY, String(selectedTafsirResourceId));
  }, [selectedTafsirResourceId]);

  useEffect(() => {
    if (
      selectedTafsirResourceId !== "none" &&
      tafsirResources.length > 0 &&
      !tafsirResources.some((resource) => resource.id === selectedTafsirResourceId)
    ) {
      setSelectedTafsirResourceId("none");
    }
  }, [selectedTafsirResourceId, tafsirResources]);

  useEffect(() => {
    if (
      translationResources.length > 0 &&
      !translationResources.some((resource) => resource.id === selectedTranslationResourceId)
    ) {
      const defaultResource = translationResources.find((resource) => resource.id === 20) ?? translationResources[0];
      if (defaultResource) {
        setSelectedTranslationResourceId(defaultResource.id);
      }
    }
  }, [selectedTranslationResourceId, translationResources]);

  const load = async () => {
    setIsLoading(true);
    try {
      const nextConnectors = await backendApi.getConnectors();
      setConnectors(nextConnectors);
      const nextSecrets = await backendApi.getBackendSecrets().catch(() => null);
      setSecretsPayload(nextSecrets);
      setSecretValues(Object.fromEntries((nextSecrets?.secrets ?? []).map((secret) => [secret.name, secret.value])));
      setBackendUnavailable(false);
    } catch {
      setConnectors([]);
      setBackendUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void backendApi
      .getSettings()
      .then((settings) => setTopicsList(sortLookupList(settings.general.topicsList)))
      .catch(() => setTopicsList([]));
  }, []);

  useEffect(() => {
    if (backendUnavailable) {
      setTranslationResources([]);
      setTafsirResources([]);
      return;
    }

    void backendApi
      .getQuranTranslationResources()
      .then((resources) => setTranslationResources(resources))
      .catch(() => setTranslationResources([]));

    void backendApi
      .getQuranTafsirResources()
      .then((resources) => setTafsirResources(resources))
      .catch(() => setTafsirResources([]));
  }, [backendUnavailable]);

  const libraryConnectorOptions = useMemo(() => {
    const unique = new Map<string, string>();
    unique.set("seed", "Built-in / seeded");
    unique.set("manual", "Manual / no connector");
    sourceLibrary.forEach((source) => {
      if (source.connectorId && source.connectorName) {
        unique.set(source.connectorId, source.connectorName);
      }
    });
    return Array.from(unique.entries());
  }, [sourceLibrary]);

  const availableLibrarySourceTypes = useMemo(
    () =>
      Array.from(new Set(sourceLibrary.map((source) => source.sourceType))).sort((left, right) =>
        sourceTypeLabels[left].localeCompare(sourceTypeLabels[right]),
      ),
    [sourceLibrary],
  );

  const filteredLibrary = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return sourceLibrary.filter((source) => {
      const matchesText =
        !query ||
        `${source.sourceTitle} ${source.excerpt} ${source.fullReference} ${source.authenticatedTranslation ?? ""} ${source.tafsirText ?? ""} ${source.tafsirResourceName ?? ""} ${source.connectorName ?? ""}`
          .toLowerCase()
          .includes(query);
      const matchesType = librarySourceType === "all" || source.sourceType === librarySourceType;
      const connectorValue = source.connectorId ?? (source.sourceOrigin === "manual" ? "manual" : "seed");
      const matchesConnector = libraryConnectorFilter === "all" || connectorValue === libraryConnectorFilter;
      return matchesText && matchesType && matchesConnector;
    });
  }, [libraryConnectorFilter, libraryQuery, librarySourceType, sourceLibrary]);

  const exportRetrievedSourcesCsv = () => {
    downloadCsv("retrieved-sources.csv", retrievedSources.map((source) => sourceToCsvRow(source)));
  };

  const exportSavedSourcesCsv = () => {
    downloadCsv("saved-source-library.csv", filteredLibrary.map((source) => sourceToCsvRow(source)));
  };

  const updateDraft = <K extends keyof ConnectorDraft>(field: K, value: ConnectorDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateManualDraft = <K extends keyof ManualSourceDraft>(field: K, value: ManualSourceDraft[K]) => {
    setManualDraft((current) => ({ ...current, [field]: value }));
  };

  const saveManualSource = () => {
    const trimmedTitle = manualDraft.sourceTitle.trim();
    const trimmedReference = manualDraft.fullReference.trim();
    const trimmedExcerpt = manualDraft.excerpt.trim();

    if (!trimmedTitle || !trimmedReference || !trimmedExcerpt) {
      onNotify("Add a title, reference, and source text before saving a manual source.", "info");
      return;
    }

    const allowsTranslation = manualDraft.sourceType === "quran" || manualDraft.sourceType === "hadith";
    const trimmedTranslation = allowsTranslation ? manualDraft.authenticatedTranslation.trim() : "";

    onSaveSource({
      sourceId: `manual-${Date.now()}`,
      sourceType: manualDraft.sourceType,
      sourceTitle: trimmedTitle,
      topic: manualDraft.topic || undefined,
      sourceLanguage: manualDraft.sourceLanguage,
      excerpt: trimmedExcerpt,
      fullReference: trimmedReference,
      trustLevel: manualDraft.trustLevel,
      translationAvailable: Boolean(trimmedTranslation),
      authenticatedTranslation: trimmedTranslation || undefined,
      translationResourceName: trimmedTranslation
        ? manualDraft.translationResourceName.trim() || "Manual English translation"
        : undefined,
      linkedBiteIds: [],
      sourceOrigin: "manual",
    });

    setManualDraft(blankManualSourceDraft);
    onNotify(`Saved manual source "${trimmedTitle}" to the source library.`);
  };

  const addTopicOption = async () => {
    const trimmed = newTopicDraft.trim();
    if (!trimmed) {
      onNotify("Add a topic name first.", "info");
      return;
    }
    if (topicsList.some((topic) => topic.toLowerCase() === trimmed.toLowerCase())) {
      onNotify("That topic already exists.", "info");
      return;
    }

    const nextTopics = sortLookupList([...topicsList, trimmed]);
    setTopicsList(nextTopics);
    setNewTopicDraft("");

    try {
      const currentSettings = await backendApi.getSettings();
      await backendApi.updateSettings({
        ...currentSettings,
        general: {
          ...currentSettings.general,
          topicsList: nextTopics,
        },
      });
      onNotify(`Added topic "${trimmed}".`);
    } catch {
      onNotify(`Added topic "${trimmed}" locally. Save Settings later if backend sync is unavailable.`, "info");
    }
  };

  const addConnector = async () => {
    if (!draft.name.trim()) {
      onNotify("Add a connector name first.", "info");
      return;
    }

    setIsSubmitting(true);
    try {
      await saveConnectorSecret(draft.apiKeyRef);
      const nextConnector = await backendApi.addConnector({
        name: draft.name.trim(),
        category: draft.category,
        connectionType: draft.connectionType,
        enabled: true,
        baseUrl: draft.baseUrl.trim(),
        apiKeyRef: draft.apiKeyRef.trim(),
        trustTier: draft.trustTier,
        notes: draft.notes.trim(),
        headers: {},
        params: {},
      });
      setConnectors((current) => [...current, nextConnector]);
      setDraft(blankDraft);
      onNotify(`Added ${nextConnector.name}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditConnector = (connector: ConnectorConfig) => {
    setEditingConnectorId(connector.connectorId);
    setDraft({
      name: connector.name,
      category: connector.category,
      connectionType: connector.connectionType,
      baseUrl: connector.baseUrl ?? "",
      apiKeyRef: connector.apiKeyRef ?? "",
      trustTier: connector.trustTier,
      notes: connector.notes ?? "",
    });
  };

  const resetDraft = () => {
    setEditingConnectorId(null);
    setDraft(blankDraft);
  };

  const getSecretValue = (name?: string) => (name ? secretValues[name] ?? "" : "");

  const updateSecretValue = (name: string, value: string) => {
    setSecretValues((current) => ({ ...current, [name]: value }));
  };

  const saveConnectorSecret = async (apiKeyRef: string) => {
    const keyRef = apiKeyRef.trim();
    const updates: Record<string, string> = {};
    if (keyRef) {
      updates[keyRef] = secretValues[keyRef] ?? "";
    }
    if (draft.category === "quran") {
      updates.QF_CLIENT_ID = secretValues.QF_CLIENT_ID ?? "";
    }
    if (Object.keys(updates).length === 0) return;
    const nextSecrets = await backendApi.updateBackendSecrets(updates);
    setSecretsPayload(nextSecrets);
    setSecretValues(Object.fromEntries(nextSecrets.secrets.map((secret) => [secret.name, secret.value])));
  };

  const saveConnectorDraft = async () => {
    if (!draft.name.trim()) {
      onNotify("Add a connector name first.", "info");
      return;
    }

    if (editingConnectorId) {
      setIsSubmitting(true);
      try {
        await saveConnectorSecret(draft.apiKeyRef);
        const updated = await backendApi.updateConnector(editingConnectorId, {
          name: draft.name.trim(),
          category: draft.category,
          connectionType: draft.connectionType,
          baseUrl: draft.baseUrl.trim(),
          apiKeyRef: draft.apiKeyRef.trim(),
          trustTier: draft.trustTier,
          notes: draft.notes.trim(),
        });
        setConnectors((current) =>
          current.map((connector) => (connector.connectorId === editingConnectorId ? updated : connector)),
        );
        onNotify(`Updated ${updated.name}.`);
        resetDraft();
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    await addConnector();
  };

  const toggleConnector = async (connectorId: string, enabled: boolean) => {
    const updated = await backendApi.updateConnector(connectorId, { enabled });
    setConnectors((current) => current.map((connector) => (connector.connectorId === connectorId ? updated : connector)));
    onNotify(`${updated.name} ${enabled ? "enabled" : "disabled"}.`, "info");
  };

  const runRetrieve = async () => {
    if (!retrieveQuery.trim()) {
      onNotify("Add a search term or verse reference first.", "info");
      return;
    }

    setIsSearching(true);
    setRetrieveError(null);
    try {
      const selectedTranslationResource = translationResources.find(
        (resource) => resource.id === selectedTranslationResourceId,
      );
      const selectedTafsirResource =
        selectedTafsirResourceId === "none"
          ? null
          : tafsirResources.find((resource) => resource.id === selectedTafsirResourceId) ?? null;
      const result = await backendApi.retrieveSourcesExternal({
        query: retrieveQuery,
        category: retrieveCategory,
        includeTranslation: true,
        limit: 100,
        translationResourceId: retrieveCategory === "quran" ? selectedTranslationResourceId : undefined,
        tafsirResourceId:
          retrieveCategory === "quran" && selectedTafsirResourceId !== "none"
            ? selectedTafsirResourceId
            : undefined,
      });
      const connectorMeta = retrieveConnectorMeta[retrieveCategory];
      const nextRetrieved = result.recommendations.map((item) => ({
        ...buildVariantAwareSource(item.source, retrieveCategory),
        sourceOrigin: item.source.sourceOrigin ?? ("connector" as const),
        connectorId: item.source.connectorId ?? connectorMeta.connectorId,
        connectorName: item.source.connectorName ?? connectorMeta.connectorName,
        translationResourceId:
          item.source.translationResourceId ?? (retrieveCategory === "quran" ? selectedTranslationResourceId : undefined),
        translationResourceName:
          item.source.translationResourceName ??
          ((retrieveCategory === "quran" && item.source.authenticatedTranslation) ? selectedTranslationResource?.name : undefined),
        tafsirResourceId:
          item.source.tafsirResourceId ??
          (retrieveCategory === "quran" && selectedTafsirResourceId !== "none" ? selectedTafsirResourceId : undefined),
        tafsirResourceName:
          item.source.tafsirResourceName ??
          ((retrieveCategory === "quran" && item.source.tafsirText) ? selectedTafsirResource?.name : undefined),
        tafsirLanguageName:
          item.source.tafsirLanguageName ??
          ((retrieveCategory === "quran" && item.source.tafsirText) ? selectedTafsirResource?.languageName : undefined),
      }));

      setRetrievedSources(nextRetrieved);
      setExpandedRetrievedSourceIds([]);

      if (nextRetrieved.length === 0) {
        setRetrieveError(
          "The external connector returned no content for this query. This section does not search the local library. If Quran topic searches keep returning nothing, the current pre-production Quran API scope is likely too limited for this use case.",
        );
      }

      onNotify(`Retrieved ${nextRetrieved.length} source result${nextRetrieved.length === 1 ? "" : "s"}.`, "info");
    } catch (error) {
      setRetrievedSources([]);
      setRetrieveError(
        error instanceof Error
          ? `${error.message}. Live retrieval could not be completed.`
          : "Live retrieval could not be completed.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const openSourceReview = (source: SourceItem) => {
    const normalized = normalizeSource(source);
    const initialReference = formatSourceReference(normalized);
    const reviewReadySource = {
      ...normalized,
      fullReference: initialReference,
    };
    setReviewingSource(reviewReadySource);
    setReviewDraft({ ...reviewReadySource });
  };

  const closeSourceReview = () => {
    setReviewingSource(null);
    setReviewDraft(null);
  };

  const updateReviewDraft = <K extends keyof SourceItem>(field: K, value: SourceItem[K]) => {
    setReviewDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const saveReviewedSource = () => {
    if (!reviewDraft) {
      return;
    }

    onSaveSource(reviewDraft);
    onNotify(`Saved ${reviewDraft.sourceTitle} to the source library.`);
    closeSourceReview();
  };

  const saveTafsirAsNote = (source: SourceItem) => {
    if (!source.tafsirText?.trim()) {
      onNotify("No tafsir text is attached to this source.", "info");
      return;
    }

    const tafsirSource: SourceItem = {
      sourceId: `${source.sourceId}-tafsir-${source.tafsirResourceId ?? "note"}`,
      sourceType: "scholarly-note",
      sourceTitle: `Tafsir ${source.fullReference.replace(/^Qur'an\s*/i, "Qur'an ")}`,
      topic: source.topic,
      sourceLanguage: source.tafsirLanguageName?.toLowerCase().includes("arab") ? "Arabic" : "English",
      excerpt: source.tafsirText,
      fullReference:
        source.tafsirResourceName
          ? source.tafsirResourceName.startsWith("Tafsir")
            ? source.tafsirResourceName
            : `Tafsir ${source.tafsirResourceName}`
          : `Tafsir on ${source.fullReference}`,
      trustLevel: "medium",
      translationAvailable: false,
      tafsirResourceId: source.tafsirResourceId,
      tafsirResourceName: source.tafsirResourceName,
      tafsirLanguageName: source.tafsirLanguageName,
      linkedBiteIds: [],
      sourceOrigin: "connector",
      connectorId: source.connectorId,
      connectorName: source.connectorName,
    };

    onSaveSource(tafsirSource);
    onNotify(`Saved ${tafsirSource.sourceTitle} to the source library.`);
  };

  const toggleRetrievedSourceExpanded = (sourceId: string) => {
    setExpandedRetrievedSourceIds((current) =>
      current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId],
    );
  };

  const toggleSavedSourceExpanded = (sourceId: string) => {
    setExpandedSavedSourceIds((current) =>
      current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId],
    );
  };

  const modalSource = reviewDraft ? normalizeSource(reviewDraft) : null;

  return (
    <div className="space-y-6">
      <section className="panel px-6 py-6">
        <SectionTitle
          title="Sources Management"
          description="Retrieve from approved connectors here, review what comes back, then save approved source records into the local source library for workspace use."
        />

        <div className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
            <button
              type="button"
              onClick={() => setManagementCollapsed((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">Connector Management</p>
              </div>
              <span className="rounded-full border border-stone-200 bg-white p-2 text-slate-700">
                {managementCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </span>
            </button>

            {!managementCollapsed ? (
              <div className="mt-5 grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                <section className="rounded-2xl border border-stone-200 bg-white px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Configured Connectors</p>
                    </div>
                    <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {connectors.length} total
                    </div>
                  </div>

                  {isLoading ? <p className="mt-4 text-sm text-slate-500">Loading connectors...</p> : null}
                  {!isLoading && backendUnavailable ? (
                    <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                      Backend unavailable. Start `npm.cmd run dev:server` to manage connectors and retrieve external sources.
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {!isLoading && !backendUnavailable && connectors.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
                        No connectors configured yet.
                      </div>
                    ) : null}
                    {connectors.map((connector) => (
                      <div key={connector.connectorId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{connector.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                              {categoryLabels[connector.category]} - {connectionTypeLabels[connector.connectionType]} - trust tier {connector.trustTier}
                            </p>
                            <p className="mt-2 text-sm text-slate-600">{connector.notes || "No notes added yet."}</p>
                            <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                              <p>
                                <span className="font-semibold text-slate-700">Base URL:</span> {connector.baseUrl?.trim() || "Not configured"}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">Key slot:</span> {connector.apiKeyRef?.trim() || "Not configured"}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">Status:</span> {connector.health?.ok ? "Healthy" : "Needs attention"}
                                {connector.health?.message ? ` - ${connector.health.message}` : ""}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">Connector ID:</span> {connector.connectorId}
                              </p>
                            </div>
                          </div>
                          <label className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
                            <span>{connector.enabled ? "Enabled" : "Disabled"}</span>
                            <input
                              type="checkbox"
                              checked={connector.enabled}
                              disabled={backendUnavailable}
                              onChange={(event) => void toggleConnector(connector.connectorId, event.target.checked)}
                            />
                          </label>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            disabled={backendUnavailable}
                            onClick={() => startEditConnector(connector)}
                            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                          >
                            <Pencil size={15} />
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-stone-200 bg-white px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {editingConnectorId ? "Edit Connector" : "Add Connector"}
                      </p>
                    </div>
                    {editingConnectorId ? (
                      <button
                        type="button"
                        onClick={resetDraft}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-4">
                    <label className="block text-sm text-slate-700">
                      <span className="mb-2 block font-medium">Connector name</span>
                      <input
                        value={draft.name}
                        onChange={(event) => updateDraft("name", event.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm text-slate-700">
                        <span className="mb-2 block font-medium">Source category</span>
                        <select
                          value={draft.category}
                          onChange={(event) => updateDraft("category", event.target.value as ConnectorConfig["category"])}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                        >
                          {Object.entries(categoryLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-sm text-slate-700">
                        <span className="mb-2 block font-medium">Connection type</span>
                        <select
                          value={draft.connectionType}
                          onChange={(event) => updateDraft("connectionType", event.target.value as ConnectorConfig["connectionType"])}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                        >
                          {Object.entries(connectionTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-2 block font-medium">Base URL</span>
                      <input
                        value={draft.baseUrl}
                        onChange={(event) => updateDraft("baseUrl", event.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </label>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-2 block font-medium">Server-side key slot reference</span>
                      <input
                        value={draft.apiKeyRef}
                        onChange={(event) => updateDraft("apiKeyRef", event.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      />
                    </label>

                    {draft.apiKeyRef.trim() ? (
                      <label className="block text-sm text-slate-700">
                        <span className="mb-2 block font-medium">{draft.apiKeyRef.trim()} value</span>
                        <input
                          value={getSecretValue(draft.apiKeyRef.trim())}
                          onChange={(event) => updateSecretValue(draft.apiKeyRef.trim(), event.target.value)}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="Paste secret value"
                        />
                      </label>
                    ) : null}

                    {draft.category === "quran" ? (
                      <label className="block text-sm text-slate-700">
                        <span className="mb-2 block font-medium">QF_CLIENT_ID value</span>
                        <input
                          value={getSecretValue("QF_CLIENT_ID")}
                          onChange={(event) => updateSecretValue("QF_CLIENT_ID", event.target.value)}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="Paste Quran Foundation client ID"
                        />
                      </label>
                    ) : null}

                    <label className="block text-sm text-slate-700">
                      <span className="mb-2 block font-medium">Trust tier</span>
                      <select
                        value={draft.trustTier}
                        onChange={(event) => updateDraft("trustTier", Number(event.target.value) as ConnectorConfig["trustTier"])}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value={1}>Tier 1 - primary text or highly trusted source</option>
                        <option value={2}>Tier 2 - approved scholarly/supporting source</option>
                        <option value={3}>Tier 3 - secondary reference needing stronger review</option>
                        <option value={4}>Tier 4 - fallback only</option>
                      </select>
                    </label>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-2 block font-medium">Notes</span>
                      <textarea
                        value={draft.notes}
                        onChange={(event) => updateDraft("notes", event.target.value)}
                        rows={4}
                        className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void saveConnectorDraft()}
                      disabled={isSubmitting || backendUnavailable}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {editingConnectorId ? <Save size={16} /> : <Plus size={16} />}
                      {editingConnectorId ? "Save Changes" : "Add Connector"}
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
            <div className="flex w-full items-center justify-between gap-3 text-left">
              <button
                type="button"
                onClick={() => setRetrieveCollapsed((current) => !current)}
                className="flex min-w-0 flex-1 items-start text-left"
                aria-label={retrieveCollapsed ? "Expand retrieve from connector" : "Collapse retrieve from connector"}
              >
                <div>
                <p className="text-sm font-semibold text-slate-900">Retrieve From Connector</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  2:163, 2:190-193, surah 2, trinity
                </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                {!retrieveCollapsed ? (
                  <button
                    type="button"
                    onClick={exportRetrievedSourcesCsv}
                    disabled={retrievedSources.length === 0}
                    className="inline-flex items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Extract retrieved sources"
                    title="Extract"
                  >
                    <Download size={16} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setRetrieveCollapsed((current) => !current)}
                  className="rounded-full border border-stone-200 bg-white p-2 text-slate-700"
                  aria-label={retrieveCollapsed ? "Expand retrieve from connector" : "Collapse retrieve from connector"}
                >
                  {retrieveCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
            </div>

            {!retrieveCollapsed ? (
              <div className="mt-4 space-y-4">
              <div className="flex gap-2">
                {(["quran", "hadith"] as const).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setRetrieveCategory(category)}
                    className={classNames(
                      "rounded-xl px-4 py-2 text-sm font-medium transition",
                      retrieveCategory === category ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                    )}
                  >
                    {category === "quran" ? "Quran" : "Sunnah"}
                  </button>
                ))}
              </div>

              {retrieveCategory === "quran" ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Translation resource</span>
                    <select
                      value={selectedTranslationResourceId}
                      onChange={(event) => setSelectedTranslationResourceId(Number(event.target.value))}
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none"
                    >
                      {translationResources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name}
                          {resource.languageName ? ` (${resource.languageName})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Optional tafsir resource</span>
                    <select
                      value={selectedTafsirResourceId}
                      onChange={(event) =>
                        setSelectedTafsirResourceId(
                          event.target.value === "none" ? "none" : Number(event.target.value),
                        )
                      }
                      className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="none">No tafsir</option>
                      {tafsirResources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name}
                          {resource.languageName ? ` (${resource.languageName})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <div className="flex gap-2">
                <label className="flex flex-1 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                  <Search size={16} className="text-slate-500" />
                  <input
                    value={retrieveQuery}
                    onChange={(event) => setRetrieveQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void runRetrieve();
                      }
                    }}
                    className="w-full border-none bg-transparent text-sm outline-none"
                    placeholder={retrieveCategory === "quran" ? "Search external Quran connector" : "Search external Sunnah connector"}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void runRetrieve()}
                  disabled={backendUnavailable}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {isSearching ? "Retrieving..." : "Retrieve"}
                </button>
              </div>

              {backendUnavailable ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  Live retrieval is unavailable because the backend is not running.
                </div>
              ) : null}

              {retrieveCategory === "quran" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  {retrievedSources.length > 0
                    ? `Retrieved ${retrievedSources.length} result${retrievedSources.length === 1 ? "" : "s"}. Quran retrieval includes the selected English translation resource under the Arabic text. You can also attach one tafsir resource to each retrieved verse.`
                    : "Quran retrieval includes the selected English translation resource under the Arabic text. You can also attach one tafsir resource to each retrieved verse."}
                </div>
              ) : null}

              {retrieveError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  {retrieveError}
                </div>
              ) : null}

              <div className="space-y-3">
                {retrievedSources.length === 0 && !retrieveError ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-4 text-sm text-slate-600">
                    Retrieved sources will appear here. Save the ones you approve into the local source library.
                  </div>
                ) : null}

                {retrievedSources.map((source) => {
                  const alreadySaved = sourceLibrary.some((item) => item.sourceId === source.sourceId);
                  const isExpanded = expandedRetrievedSourceIds.includes(source.sourceId);
                  const hasDetails = Boolean(source.authenticatedTranslation || source.tafsirText);
                  const fallbackSourceLabel = getFallbackSourceLabel(source);
                  return (
                    <div key={source.sourceId} className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{source.sourceTitle}</p>
                            <Badge tone={source.trustLevel === "high" ? "success" : "warning"}>{source.trustLevel}</Badge>
                            <Badge tone="muted">{source.sourceType}</Badge>
                            {source.connectorName ? <Badge tone="info">{source.connectorName}</Badge> : null}
                            {alreadySaved ? <Badge tone="info">saved</Badge> : null}
                            {source.translationResourceName ? <Badge tone="info">{source.translationResourceName}</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{source.excerpt}</p>
                          {fallbackSourceLabel ? (
                            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                              Retrieved through approved fallback from <span className="font-semibold">{fallbackSourceLabel}</span>, not the primary connector.
                            </div>
                          ) : null}
                          {hasDetails ? (
                            <button
                              type="button"
                              onClick={() => toggleRetrievedSourceExpanded(source.sourceId)}
                              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-slate-700"
                            >
                              <BookText size={16} />
                              {isExpanded ? "Hide translation and tafsir" : "Show translation and tafsir"}
                            </button>
                          ) : null}
                          {isExpanded && source.authenticatedTranslation ? (
                            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                                {source.translationResourceName ?? "Selected English translation"}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{source.authenticatedTranslation}</p>
                            </div>
                          ) : null}
                          {isExpanded && source.tafsirText ? (
                            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                                {source.tafsirResourceName ?? "Attached tafsir"}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{source.tafsirText}</p>
                            </div>
                          ) : null}
                          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{formatSourceReference(source)}</p>
                          {source.topic ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Topic: {source.topic}</p> : null}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => openSourceReview(source)}
                            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                          >
                            <Eye size={16} />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSaveSource(source);
                              onNotify(
                                alreadySaved
                                  ? `Updated ${source.sourceTitle} in the source library.`
                                  : `Saved ${source.sourceTitle} to the source library.`,
                              );
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                          >
                            <Save size={16} />
                            {alreadySaved ? "Update saved source" : "Save source"}
                          </button>
                          {source.tafsirText ? (
                            <button
                              type="button"
                              onClick={() => saveTafsirAsNote(source)}
                              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                            >
                              <Save size={16} />
                              Save tafsir note
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
            <button
              type="button"
              onClick={() => setManualSourceCollapsed((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">Add Manual Source</p>
              </div>
              <span className="rounded-full border border-stone-200 bg-white p-2 text-slate-700">
                {manualSourceCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </span>
            </button>

            {!manualSourceCollapsed ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr,1.2fr]">
                <div className="space-y-4">
                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Source title</span>
                    <input
                      value={manualDraft.sourceTitle}
                      onChange={(event) => updateManualDraft("sourceTitle", event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      placeholder="Example: Tawhid summary note"
                    />
                  </label>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Reference</span>
                    <input
                      value={manualDraft.fullReference}
                      onChange={(event) => updateManualDraft("fullReference", event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      placeholder="Example: Qur'an 2:163 or personal note 2026-03-26"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm text-slate-700">
                      <span className="mb-2 block font-medium">Source type</span>
                      <select
                        value={manualDraft.sourceType}
                        onChange={(event) => updateManualDraft("sourceType", event.target.value as SourceItem["sourceType"])}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="quran">Quran</option>
                        <option value="hadith">Sunnah</option>
                        <option value="scholarly-note">Scholarly note</option>
                        <option value="user-note">User note</option>
                      </select>
                    </label>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-2 block font-medium">Language</span>
                      <select
                        value={manualDraft.sourceLanguage}
                        onChange={(event) => updateManualDraft("sourceLanguage", event.target.value as SourceItem["sourceLanguage"])}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="Arabic">Arabic</option>
                        <option value="English">English</option>
                      </select>
                    </label>

                    <label className="block text-sm text-slate-700">
                      <span className="mb-2 block font-medium">Trust level</span>
                      <select
                        value={manualDraft.trustLevel}
                        onChange={(event) => updateManualDraft("trustLevel", event.target.value as SourceItem["trustLevel"])}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="needs-review">Needs review</option>
                      </select>
                    </label>

                    <div className="space-y-2">
                      <label className="block text-sm text-slate-700">
                        <span className="mb-2 block font-medium">Topic</span>
                        <select
                          value={manualDraft.topic}
                          onChange={(event) => updateManualDraft("topic", event.target.value)}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                        >
                          <option value="">No topic yet</option>
                          {topicsList.map((topic) => (
                            <option key={topic} value={topic}>
                              {topic}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={newTopicDraft}
                          onChange={(event) => setNewTopicDraft(event.target.value)}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="Add a new topic"
                        />
                        <button
                          type="button"
                          onClick={() => void addTopicOption()}
                          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Source text</span>
                    <textarea
                      rows={10}
                      value={manualDraft.excerpt}
                      onChange={(event) => updateManualDraft("excerpt", event.target.value)}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm leading-6 outline-none"
                      placeholder="Paste or write the source text here. Separate paragraphs with a blank line if you want multiple bites later."
                    />
                  </label>

                  {manualDraft.sourceType === "quran" || manualDraft.sourceType === "hadith" ? (
                    <div className="grid gap-4">
                      <label className="block text-sm text-slate-700">
                        <span className="mb-2 block font-medium">English translation (optional)</span>
                        <textarea
                          rows={6}
                          value={manualDraft.authenticatedTranslation}
                          onChange={(event) => updateManualDraft("authenticatedTranslation", event.target.value)}
                          className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm leading-6 outline-none"
                          placeholder="Add the English translation if you want it carried with this source."
                        />
                      </label>

                      <label className="block text-sm text-slate-700">
                        <span className="mb-2 block font-medium">Translation label (optional)</span>
                        <input
                          value={manualDraft.translationResourceName}
                          onChange={(event) => updateManualDraft("translationResourceName", event.target.value)}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                          placeholder="Example: Saheeh International"
                        />
                      </label>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={saveManualSource}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  >
                    <Plus size={16} />
                    Save manual source
                  </button>
                </div>
              </div>
            ) : null}
          </section>

        </div>
      </section>

      <section className="panel px-6 py-6">
        <SectionTitle
          title="Saved Source Library"
          description="Only sources saved here are available in the workspace Source Panel."
        />

        <section className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Saved Source Library</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {filteredLibrary.length} sources
                </div>
                <button
                  type="button"
                  onClick={exportSavedSourcesCsv}
                  disabled={filteredLibrary.length === 0}
                  className="inline-flex items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Extract saved sources"
                  title="Extract"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr,0.8fr,0.8fr]">
              <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                <Database size={16} className="text-slate-500" />
                <input
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                  className="w-full border-none bg-transparent text-sm outline-none"
                  placeholder="Filter saved source library"
                />
              </label>

                    <select
                      value={librarySourceType}
                      onChange={(event) => setLibrarySourceType(event.target.value as SourceItem["sourceType"] | "all")}
                      className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="all">All Source Types</option>
                      {availableLibrarySourceTypes.map((sourceType) => (
                        <option key={sourceType} value={sourceType}>
                          {sourceTypeLabels[sourceType]}
                        </option>
                      ))}
                    </select>

              <select
                value={libraryConnectorFilter}
                onChange={(event) => setLibraryConnectorFilter(event.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="all">All connectors</option>
                {libraryConnectorOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 space-y-3">
              {filteredLibrary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-4 text-sm text-slate-600">
                  No saved sources match the current filters.
                </div>
              ) : null}

              {filteredLibrary.map((source) => (
                <div key={source.sourceId} className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{source.sourceTitle}</p>
                        <Badge tone={source.trustLevel === "high" ? "success" : "warning"}>{source.trustLevel}</Badge>
                        <Badge tone="muted">{source.sourceType}</Badge>
                        <Badge tone="info">{formatConnectorBadge(source)}</Badge>
                        {source.authenticatedTranslation ? <Badge tone="info">translation</Badge> : null}
                        {source.tafsirText ? <Badge tone="warning">tafsir</Badge> : null}
                      </div>
                      <p
                        className={classNames(
                          "mt-2 text-sm leading-6 text-slate-600",
                          !expandedSavedSourceIds.includes(source.sourceId) && "line-clamp-1",
                        )}
                      >
                        {source.excerpt}
                      </p>
                      {(source.excerpt.length > 120 || source.authenticatedTranslation || source.tafsirText) ? (
                        <button
                          type="button"
                          onClick={() => toggleSavedSourceExpanded(source.sourceId)}
                          className="mt-3 inline-flex items-center rounded-xl border border-stone-200 bg-white p-2 text-slate-700"
                          aria-label={expandedSavedSourceIds.includes(source.sourceId) ? "Collapse saved source details" : "Expand saved source details"}
                        >
                          {expandedSavedSourceIds.includes(source.sourceId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      ) : null}
                      {expandedSavedSourceIds.includes(source.sourceId) && source.authenticatedTranslation ? (
                        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                            {source.translationResourceName ?? "Saved English translation"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{source.authenticatedTranslation}</p>
                        </div>
                      ) : null}
                      {expandedSavedSourceIds.includes(source.sourceId) && source.tafsirText ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                            {source.tafsirResourceName ?? "Attached tafsir"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{source.tafsirText}</p>
                        </div>
                      ) : null}
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">{formatSourceReference(source)}</p>
                      {source.topic ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Topic: {source.topic}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => openSourceReview(source)}
                        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                      >
                        <Eye size={16} />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(`Delete "${source.sourceTitle}" from the saved source library?`);
                          if (!confirmed) {
                            return;
                          }
                          onDeleteSource(source.sourceId);
                          onNotify(`Removed ${source.sourceTitle} from the source library.`, "info");
                        }}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-slate-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
      </section>

      {modalSource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-6 py-10">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Source Review</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{modalSource.sourceTitle}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Review the retrieved content, adjust metadata, then save it into the source library.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSourceReview}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid flex-1 gap-6 overflow-y-auto pr-1 xl:grid-cols-[1.2fr,0.8fr]">
              <section className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
                <p className="text-sm font-semibold text-slate-900">Retrieved Content</p>
                <p className="mt-3 text-sm leading-7 text-slate-700">{modalSource.excerpt}</p>
                {modalSource.authenticatedTranslation ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
                      Authenticated English translation
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{modalSource.authenticatedTranslation}</p>
                  </div>
                ) : null}
                {modalSource.tafsirText ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                      {modalSource.tafsirResourceName ?? "Attached tafsir"}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{modalSource.tafsirText}</p>
                  </div>
                ) : null}
                <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">{formatSourceReference(modalSource)}</p>
                {modalSource.topic ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Topic: {modalSource.topic}</p> : null}
              </section>

              <section className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
                <p className="text-sm font-semibold text-slate-900">Metadata</p>
                <div className="mt-4 space-y-4">
                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Source title</span>
                    <input
                      value={modalSource.sourceTitle}
                      onChange={(event) => updateReviewDraft("sourceTitle", event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </label>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Reference</span>
                    <input
                      value={modalSource.fullReference}
                      onChange={(event) => updateReviewDraft("fullReference", event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </label>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Topic</span>
                    <select
                      value={modalSource.topic ?? ""}
                      onChange={(event) => updateReviewDraft("topic", event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="">No topic yet</option>
                      {topicsList.map((topic) => (
                        <option key={topic} value={topic}>
                          {topic}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newTopicDraft}
                      onChange={(event) => setNewTopicDraft(event.target.value)}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                      placeholder="Add a new topic"
                    />
                    <button
                      type="button"
                      onClick={() => void addTopicOption()}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Add
                    </button>
                  </div>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Source type</span>
                    <select
                      value={modalSource.sourceType}
                      onChange={(event) => updateReviewDraft("sourceType", event.target.value as SourceItem["sourceType"])}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="quran">Quran</option>
                      <option value="hadith">Sunnah</option>
                      <option value="scholarly-note">Scholarly note</option>
                      <option value="user-note">User note</option>
                      <option value="article">Article</option>
                      <option value="saved-bite">Saved bite</option>
                    </select>
                  </label>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Trust level</span>
                    <select
                      value={modalSource.trustLevel}
                      onChange={(event) => updateReviewDraft("trustLevel", event.target.value as SourceItem["trustLevel"])}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="needs-review">Needs review</option>
                    </select>
                  </label>

                  <label className="block text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Excerpt</span>
                    <textarea
                      value={modalSource.excerpt}
                      onChange={(event) => updateReviewDraft("excerpt", event.target.value)}
                      rows={6}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm outline-none"
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {modalSource.tafsirText ? (
                <button
                  type="button"
                  onClick={() => saveTafsirAsNote(modalSource)}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  <Save size={16} />
                  Save tafsir note
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeSourceReview}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveReviewedSource}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                <Save size={16} />
                Save to library
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
