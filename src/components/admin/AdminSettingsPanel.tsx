import { useEffect, useMemo, useRef, useState } from "react";
import { Download, KeyRound, Plus, RefreshCw, Save, Sparkles, TestTube2, Upload } from "lucide-react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { backendApi } from "@/services/backendApi";
import { CredentialSetupScreen } from "@/components/setup/CredentialSetupScreen";
import {
  audienceTypeOptions,
  difficultyOptions,
  likelyIntentOptions,
  questionTypeOptions,
} from "@/data/classificationOptions";
import {
  AdminSettingsPayload,
  AIModelOption,
  AIProviderConfig,
  BackendPreflightStatus,
  BackendSecretsPayload,
  AIProviderType,
  LibraryBackupFile,
} from "@/types/backend";
import { useAppStore } from "@/state/useAppStore";

type AdminSettingsPanelProps = {
  onNotify: (message: string, tone?: "success" | "info") => void;
  onRestoreComplete?: () => Promise<void>;
};

const blankSettings: AdminSettingsPayload = {
  general: {
    defaultSourceResultLimit: 8,
    cachingEnabled: true,
    allowWebFallback: false,
    fallbackDomainAllowlist: [],
    similarityThreshold: 0.45,
    sourceTimeoutMs: 7000,
    translationTimeoutMs: 6000,
    topicsList: [],
    audienceTypeList: [...audienceTypeOptions],
    questionTypeList: [...questionTypeOptions],
    difficultyList: [...difficultyOptions],
    likelyIntentList: [...likelyIntentOptions],
  },
  aiDefaults: {
    defaultProviderId: "ai-vertex-primary",
    defaultModelId: "gemini-2.5-flash",
  },
};

const blankModel = (): AIModelOption => ({
  modelId: "",
  label: "",
  enabled: true,
  supportsStructuredOutput: true,
  supportsToolUse: false,
  supportsReasoning: false,
  notes: "",
});

const blankProvider = (): Omit<AIProviderConfig, "providerId" | "createdAt" | "updatedAt" | "health"> => ({
  name: "",
  providerType: "openai",
  enabled: false,
  baseUrl: "",
  apiKeyRef: "",
  projectId: "",
  location: "",
  modelOptions: [blankModel()],
  defaultModelId: "",
  headers: {},
  notes: "",
});

const sortLookupList = (values: string[]) =>
  [...values]
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));

const parseLookupList = (value: string) => sortLookupList(value.split(","));

const normalizeSettings = (settings?: Partial<AdminSettingsPayload>): AdminSettingsPayload => ({
  general: {
    ...blankSettings.general,
    ...(settings?.general ?? {}),
    topicsList: Array.isArray(settings?.general?.topicsList)
      ? sortLookupList(settings.general.topicsList)
      : sortLookupList(blankSettings.general.topicsList),
    audienceTypeList: Array.isArray(settings?.general?.audienceTypeList)
      ? sortLookupList(settings.general.audienceTypeList)
      : sortLookupList(blankSettings.general.audienceTypeList),
    questionTypeList: Array.isArray(settings?.general?.questionTypeList)
      ? sortLookupList(settings.general.questionTypeList)
      : sortLookupList(blankSettings.general.questionTypeList),
    difficultyList: Array.isArray(settings?.general?.difficultyList)
      ? sortLookupList(settings.general.difficultyList)
      : sortLookupList(blankSettings.general.difficultyList),
    likelyIntentList: Array.isArray(settings?.general?.likelyIntentList)
      ? sortLookupList(settings.general.likelyIntentList)
      : sortLookupList(blankSettings.general.likelyIntentList),
  },
  aiDefaults: {
    ...blankSettings.aiDefaults,
    ...(settings?.aiDefaults ?? {}),
  },
});

const normalizeProvider = (provider: Partial<AIProviderConfig>): AIProviderConfig => ({
  providerId: provider.providerId ?? `provider-${Date.now()}`,
  name: provider.name ?? "Unnamed provider",
  providerType: provider.providerType ?? "other",
  enabled: Boolean(provider.enabled),
  baseUrl: provider.baseUrl ?? "",
  apiKeyRef: provider.apiKeyRef ?? "",
  projectId: provider.projectId ?? "",
  location: provider.location ?? "",
  modelOptions: Array.isArray(provider.modelOptions) && provider.modelOptions.length ? provider.modelOptions : [blankModel()],
  defaultModelId:
    provider.defaultModelId ??
    (Array.isArray(provider.modelOptions) ? provider.modelOptions.find((model) => model.enabled)?.modelId : "") ??
    "",
  headers: provider.headers ?? {},
  notes: provider.notes ?? "",
  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt,
  health: provider.health,
});

const providerTypeOptions: AIProviderType[] = ["openai", "custom-openai-compatible", "vertex-ai", "anthropic", "other"];

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none";

type SettingFieldProps = {
  label: string;
  help?: string;
  children: React.ReactNode;
};

const SettingField = ({ label, help, children }: SettingFieldProps) => (
  <label className="block text-sm text-slate-700">
    <span className="mb-1 block font-medium text-slate-900">{label}</span>
    {help ? <span className="mb-2 block text-xs leading-5 text-slate-500">{help}</span> : null}
    {children}
  </label>
);

export const AdminSettingsPanel = ({ onNotify, onRestoreComplete }: AdminSettingsPanelProps) => {
  const [settings, setSettings] = useState<AdminSettingsPayload>(blankSettings);
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [preflight, setPreflight] = useState<BackendPreflightStatus | null>(null);
  const [secretsPayload, setSecretsPayload] = useState<BackendSecretsPayload | null>(null);
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [providerForm, setProviderForm] = useState(blankProvider());
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [isSavingSecrets, setIsSavingSecrets] = useState(false);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [showUpdateCredentials, setShowUpdateCredentials] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<LibraryBackupFile | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const savedCases = useAppStore((state) => state.savedCases);
  const savedBites = useAppStore((state) => state.savedBites);
  const sourceItems = useAppStore((state) => state.sourceItems);

  const enabledProviderModelOptions = useMemo(
    () =>
      providers.flatMap((provider) =>
        (provider.modelOptions ?? [])
          .filter((model) => model.enabled)
          .map((model) => ({
            value: `${provider.providerId}::${model.modelId}`,
            label: `${provider.name} / ${model.label}`,
            providerId: provider.providerId,
            modelId: model.modelId,
          })),
      ),
    [providers],
  );

  const load = async () => {
    setIsLoading(true);
    try {
      const nextSettings = await backendApi.getSettings();
      setSettings(normalizeSettings(nextSettings));
      setPreflight(await backendApi.getBackendPreflight().catch(() => null));
      const nextSecrets = await backendApi.getBackendSecrets().catch(() => null);
      setSecretsPayload(nextSecrets);
      setSecretValues(
        Object.fromEntries((nextSecrets?.secrets ?? []).map((secret) => [secret.name, secret.value])),
      );

      try {
        const nextProviders = await backendApi.getAIProviders();
        setProviders((nextProviders ?? []).map((provider) => normalizeProvider(provider)));
        setBackendUnavailable(false);
      } catch {
        setProviders([]);
        setBackendUnavailable(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetProviderForm = () => {
    setEditingProviderId(null);
    setProviderForm(blankProvider());
  };

  const saveSettings = async () => {
    const next = await backendApi.updateSettings(normalizeSettings(settings));
    setSettings(next);
    onNotify("Saved backend and AI defaults.");
  };

  const saveSecrets = async () => {
    setIsSavingSecrets(true);
    try {
      const nextSecrets = await backendApi.updateBackendSecrets(secretValues);
      setSecretsPayload(nextSecrets);
      setSecretValues(Object.fromEntries(nextSecrets.secrets.map((secret) => [secret.name, secret.value])));
      setPreflight(await backendApi.getBackendPreflight().catch(() => null));
      onNotify("Saved credentials to DawahDeskData\\credentials.json.");
    } finally {
      setIsSavingSecrets(false);
    }
  };

  const getSecretValue = (name?: string) => (name ? secretValues[name] ?? "" : "");

  const updateSecretValue = (name: string, value: string) => {
    setSecretValues((current) => ({ ...current, [name]: value }));
  };

  const saveProvider = async () => {
    setIsSavingProvider(true);
    try {
      const sanitizedModels = providerForm.modelOptions
        .filter((model) => model.modelId.trim() && model.label.trim())
        .map((model) => ({
          ...model,
          modelId: model.modelId.trim(),
          label: model.label.trim(),
          notes: model.notes?.trim() || "",
        }));

      const enabledModels = sanitizedModels.filter((model) => model.enabled);
      const defaultModelId =
        providerForm.defaultModelId && enabledModels.some((model) => model.modelId === providerForm.defaultModelId)
          ? providerForm.defaultModelId
          : enabledModels[0]?.modelId ?? "";

      const payload = {
        ...providerForm,
        name: providerForm.name.trim(),
        baseUrl: providerForm.baseUrl?.trim() || "",
        apiKeyRef: providerForm.apiKeyRef?.trim() || "",
        projectId: providerForm.projectId?.trim() || "",
        location: providerForm.location?.trim() || "",
        notes: providerForm.notes?.trim() || "",
        modelOptions: sanitizedModels,
        defaultModelId,
      };

      if (payload.apiKeyRef && secretValues[payload.apiKeyRef] !== undefined) {
        await backendApi.updateBackendSecrets({ [payload.apiKeyRef]: secretValues[payload.apiKeyRef] });
      }

      if (editingProviderId) {
        await backendApi.updateAIProvider(editingProviderId, payload);
        onNotify("Updated AI provider.");
      } else {
        await backendApi.addAIProvider(payload);
        onNotify("Added AI provider.");
      }

      await load();
      resetProviderForm();
    } finally {
      setIsSavingProvider(false);
    }
  };

  const testProvider = async (providerId: string) => {
    const result = await backendApi.testAIProvider(providerId);
    onNotify(result.ok ? (result.message ?? "Provider test succeeded.") : (result.message ?? "Provider test failed."), result.ok ? "success" : "info");
    await load();
  };

  const handleBackup = () => {
    const backup: LibraryBackupFile = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: "Da'wah Desk 1.2.0",
      savedCases,
      savedBites,
      sourceRecords: sourceItems,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dawah-desk-backup-${stamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    onNotify("Library backed up.", "success");
  };

  const handleRestoreFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result ?? ""));
        if (
          typeof parsed.backupVersion !== "number" ||
          !Array.isArray(parsed.savedCases) ||
          !Array.isArray(parsed.savedBites) ||
          !Array.isArray(parsed.sourceRecords)
        ) {
          onNotify("That file does not look like a Da'wah Desk backup.");
          return;
        }
        setPendingRestore(parsed as LibraryBackupFile);
      } catch {
        onNotify("Could not read the file. Make sure it is a valid Da'wah Desk backup.");
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be selected again if needed.
    event.target.value = "";
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setIsRestoring(true);
    try {
      await backendApi.restoreLibrary(pendingRestore);
      await onRestoreComplete?.();
      setPendingRestore(null);
      onNotify(`Library restored — ${pendingRestore.savedCases.length} cases loaded.`, "success");
    } catch {
      onNotify("Restore failed. Your library has not been changed.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      {showUpdateCredentials ? (
        <div className="fixed inset-0 z-50">
          <CredentialSetupScreen
            mode="update"
            onComplete={() => {
              setShowUpdateCredentials(false);
              void load();
            }}
          />
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowUpdateCredentials(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
          >
            <KeyRound size={16} />
            Update Credentials
          </button>
        </div>

        <section className="panel px-6 py-6">
          <SectionTitle
            title="Library"
            description="Back up your full case library to a file, or restore from a previous backup. Restore replaces your entire library — a safety snapshot is saved automatically before any restore."
          />

          <div className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleBackup}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
              >
                <Download size={16} />
                Back up library
              </button>
              <span className="text-sm text-slate-500">
                {savedCases.length} {savedCases.length === 1 ? "case" : "cases"}, {sourceItems.length}{" "}
                {sourceItems.length === 1 ? "source" : "sources"}
              </span>
            </div>

            <div className="border-t border-stone-200 pt-4">
              {pendingRestore ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p className="font-semibold">Replace your library with this backup?</p>
                    <p className="mt-1">
                      Backup contains {pendingRestore.savedCases.length}{" "}
                      {pendingRestore.savedCases.length === 1 ? "case" : "cases"} and{" "}
                      {pendingRestore.sourceRecords.length}{" "}
                      {pendingRestore.sourceRecords.length === 1 ? "source" : "sources"}. Your current{" "}
                      {savedCases.length} {savedCases.length === 1 ? "case" : "cases"} will be replaced. A safety
                      snapshot will be saved to DawahDeskData\backups\ before the restore runs.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleConfirmRestore()}
                      disabled={isRestoring}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {isRestoring ? "Restoring…" : "Restore"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRestore(null)}
                      disabled={isRestoring}
                      className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => restoreInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                  >
                    <Upload size={16} />
                    Restore from backup
                  </button>
                  <span className="text-xs text-slate-500">Select a Da'wah Desk backup .json file</span>
                </div>
              )}
              <input
                ref={restoreInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleRestoreFileChange}
              />
            </div>
          </div>
        </section>

        {preflight && (!preflight.ok || preflight.warnings.length > 0) ? (
        <section className="panel px-6 py-5">
          <SectionTitle title="Backend Credential Check" />
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
            {!preflight.ok ? (
              <div>
                <p className="text-sm font-semibold text-amber-700">Required backend credentials need attention.</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {preflight.issues.map((issue) => (
                    <li key={issue}>• {issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preflight.warnings.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">Warnings</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {preflight.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-slate-500">
              Backend credentials are loaded from <span className="font-mono">DawahDeskData\\credentials.json</span> at startup.
            </p>
          </div>
        </section>
      ) : null}

      <section className="panel px-6 py-6">
        <SectionTitle
          title="Secrets"
          description="View and update local credential paths. Values are stored in DawahDeskData\credentials.json."
          action={
            <button
              type="button"
              onClick={() => void saveSecrets()}
              disabled={isSavingSecrets || !secretsPayload}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <Save size={16} />
              Save Secrets
            </button>
          }
        />

        {!secretsPayload ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Secrets could not be loaded. Restart the backend and return to this page.
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Local secrets file</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{secretsPayload.filePath}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                <KeyRound size={14} />
                {secretsPayload.secrets.length} slots
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {secretsPayload.secrets.map((secret) => {
                const isReadOnly =
                  secret.name === "GOOGLE_APPLICATION_CREDENTIALS" ||
                  secret.name === "VERTEX_AI_SERVICE_ACCOUNT_PATH";
                return (
                  <SettingField
                    key={secret.name}
                    label={secret.name}
                    help={secret.configured ? "Configured in local secrets." : "Empty until you add a value."}
                  >
                    <input
                      value={secretValues[secret.name] ?? ""}
                      onChange={(event) => updateSecretValue(secret.name, event.target.value)}
                      className={`${inputClass}${isReadOnly ? " cursor-default bg-stone-100 text-slate-500" : ""}`}
                      placeholder="Path to credential file"
                      readOnly={isReadOnly}
                    />
                    {isReadOnly ? (
                      <span className="mt-1 block text-xs text-slate-400">
                        To update credentials, use the Update Credentials button above.
                      </span>
                    ) : null}
                  </SettingField>
                );
              })}
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Credential updates are saved to DawahDeskData\\credentials.json and are available to the running backend immediately.
            </div>
          </div>
        )}
      </section>

      <section className="panel px-6 py-6">
        <SectionTitle
          title="Admin / AI Settings"
          description="Manage backend AI providers, their model options, and the default provider/model that new sessions inherit. This does not change the case workflow; it changes which backend AI service powers it."
          action={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void saveSettings()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                <Save size={16} />
                Save Defaults
              </button>
            </div>
          }
        />

        {isLoading ? <p className="text-sm text-slate-500">Loading AI configuration...</p> : null}

        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <section className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Configured AI Providers</p>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {providers.length} total
              </div>
            </div>

            <div className="space-y-3">
              {backendUnavailable ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  The backend AI provider service is not reachable right now. Restart the backend launcher, then refresh this page to load the configured providers.
                </div>
              ) : null}
              {providers.map((provider) => (
                <article key={provider.providerId} className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
                  {(() => {
                    const hasEnabledModel = provider.modelOptions.some((model) => model.enabled);
                    const providerUsable = provider.enabled && hasEnabledModel;
                    return (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{provider.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">{provider.providerType}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {settings.aiDefaults.defaultProviderId === provider.providerId ? (
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                          App default
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          providerUsable
                            ? "bg-emerald-50 text-emerald-700"
                            : provider.enabled
                              ? "bg-amber-50 text-amber-700"
                              : "bg-stone-100 text-slate-500"
                        }`}
                      >
                        {providerUsable ? "Enabled" : provider.enabled ? "No enabled models" : "Disabled"}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${provider.health?.ok ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>
                        {provider.health?.ok ? "Connection healthy" : "Connection needs attention"}
                      </span>
                    </div>
                  </div>
                    );
                  })()}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 text-sm text-slate-600">
                      <p><span className="font-medium text-slate-900">Base URL:</span> {provider.baseUrl || "Default / not set"}</p>
                      <p><span className="font-medium text-slate-900">Key ref:</span> {provider.apiKeyRef || "Not set"}</p>
                      {provider.projectId ? <p><span className="font-medium text-slate-900">Project ID:</span> {provider.projectId}</p> : null}
                      {provider.location ? <p><span className="font-medium text-slate-900">Location:</span> {provider.location}</p> : null}
                      <p><span className="font-medium text-slate-900">Default model:</span> {provider.defaultModelId || "Not set"}</p>
                      {settings.aiDefaults.defaultProviderId === provider.providerId ? (
                        <p><span className="font-medium text-slate-900">Used by new sessions:</span> Yes</p>
                      ) : null}
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">Models</p>
                      <ul className="space-y-1">
                        {provider.modelOptions.map((model) => (
                          <li key={model.modelId}>
                            {model.label}
                            {model.modelId === provider.defaultModelId ? " (provider default)" : ""}
                            {model.enabled ? "" : " (disabled)"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {provider.health?.message ? (
                    <p
                      className={`mt-3 rounded-2xl px-4 py-3 text-sm ${
                        provider.health.ok
                          ? "bg-sky-50 text-sky-800"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {provider.health.message}
                    </p>
                  ) : null}

                  {provider.notes ? <p className="mt-3 text-sm text-slate-600">{provider.notes}</p> : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProviderId(provider.providerId);
                        setProviderForm({
                          name: provider.name,
                          providerType: provider.providerType,
                          enabled: provider.enabled,
                          baseUrl: provider.baseUrl ?? "",
                          apiKeyRef: provider.apiKeyRef ?? "",
                          projectId: provider.projectId ?? "",
                          location: provider.location ?? "",
                          modelOptions: provider.modelOptions.length ? provider.modelOptions : [blankModel()],
                          defaultModelId: provider.defaultModelId ?? provider.modelOptions[0]?.modelId ?? "",
                          headers: provider.headers ?? {},
                          notes: provider.notes ?? "",
                        });
                      }}
                      className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                    >
                      Edit provider
                    </button>
                    <button
                      type="button"
                      onClick={() => void testProvider(provider.providerId)}
                      className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                    >
                      <TestTube2 size={15} />
                      Test connection
                    </button>
                  </div>
                </article>
              ))}
              {!backendUnavailable && !isLoading && providers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-6 text-sm text-slate-500">
                  No AI providers are configured yet.
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-6">
            <article className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{editingProviderId ? "Edit AI Provider" : "Add AI Provider"}</p>
                  <p className="mt-1 text-sm text-slate-500">Keys stay server-side. This form only stores the key slot reference and provider metadata.</p>
                </div>
                {editingProviderId ? (
                  <button
                    type="button"
                    onClick={resetProviderForm}
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-4">
                <SettingField label="Provider name">
                  <input
                    value={providerForm.name}
                    onChange={(event) => setProviderForm((current) => ({ ...current, name: event.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Google Vertex AI, Internal Proxy"
                  />
                </SettingField>

                <SettingField label="Provider type">
                  <select
                    value={providerForm.providerType}
                    onChange={(event) =>
                      setProviderForm((current) => ({ ...current, providerType: event.target.value as AIProviderType }))
                    }
                    className={inputClass}
                  >
                    {providerTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </SettingField>

                <div className="grid gap-4 md:grid-cols-2">
                  <SettingField label="Base URL" help="Optional for providers that use a custom or compatible endpoint.">
                    <input
                      value={providerForm.baseUrl ?? ""}
                      onChange={(event) => setProviderForm((current) => ({ ...current, baseUrl: event.target.value }))}
                      className={inputClass}
                      placeholder="https://api.openai.com/v1"
                    />
                  </SettingField>

                  <SettingField label="Key slot reference" help="Name of the backend environment variable or secret slot.">
                    <input
                      value={providerForm.apiKeyRef ?? ""}
                      onChange={(event) => setProviderForm((current) => ({ ...current, apiKeyRef: event.target.value }))}
                      className={inputClass}
                      placeholder="OPENAI_API_KEY"
                    />
                  </SettingField>
                </div>

                {(providerForm.apiKeyRef ?? "").trim() ? (
                  <SettingField label={`${(providerForm.apiKeyRef ?? "").trim()} value`} help="Saved to DawahDeskData\\credentials.json.">
                    <input
                      value={getSecretValue((providerForm.apiKeyRef ?? "").trim())}
                      onChange={(event) => updateSecretValue((providerForm.apiKeyRef ?? "").trim(), event.target.value)}
                      className={inputClass}
                      placeholder={providerForm.providerType === "vertex-ai" ? "Path to service account JSON" : "Paste API key"}
                    />
                  </SettingField>
                ) : null}

                {providerForm.providerType === "vertex-ai" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <SettingField label="Google Cloud project ID">
                      <input
                        value={providerForm.projectId ?? ""}
                        onChange={(event) => setProviderForm((current) => ({ ...current, projectId: event.target.value }))}
                        className={inputClass}
                        placeholder="hm-so2021"
                      />
                    </SettingField>

                    <SettingField label="Vertex location" help="Use global unless you have confirmed the target model is available in a specific regional endpoint.">
                      <input
                        value={providerForm.location ?? ""}
                        onChange={(event) => setProviderForm((current) => ({ ...current, location: event.target.value }))}
                        className={inputClass}
                        placeholder="global"
                      />
                    </SettingField>
                  </div>
                ) : null}

                <label className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">Provider enabled</p>
                    <p className="mt-1 text-xs text-slate-500">Only enabled providers appear in defaults and session selection.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={providerForm.enabled}
                    onChange={(event) => setProviderForm((current) => ({ ...current, enabled: event.target.checked }))}
                  />
                </label>

                <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Model options</p>
                      <p className="mt-1 text-xs text-slate-500">Define the models this provider can expose for session selection.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProviderForm((current) => ({ ...current, modelOptions: [...current.modelOptions, blankModel()] }))}
                      className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    >
                      <Plus size={15} />
                      Add model
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {providerForm.modelOptions.map((model, index) => (
                      <div key={`${model.modelId || "new"}-${index}`} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <SettingField label="Model ID">
                            <input
                              value={model.modelId}
                              onChange={(event) =>
                                setProviderForm((current) => ({
                                  ...current,
                                  modelOptions: current.modelOptions.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, modelId: event.target.value } : item,
                                  ),
                                }))
                              }
                              className={inputClass}
                              placeholder="gpt-5.4"
                            />
                          </SettingField>

                          <SettingField label="Label">
                            <input
                              value={model.label}
                              onChange={(event) =>
                                setProviderForm((current) => ({
                                  ...current,
                                  modelOptions: current.modelOptions.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, label: event.target.value } : item,
                                  ),
                                }))
                              }
                              className={inputClass}
                              placeholder="GPT-5.4"
                            />
                          </SettingField>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={model.enabled}
                              onChange={(event) =>
                                setProviderForm((current) => ({
                                  ...current,
                                  modelOptions: current.modelOptions.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                                  ),
                                }))
                              }
                            />
                            Enabled
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(model.supportsStructuredOutput)}
                              onChange={(event) =>
                                setProviderForm((current) => ({
                                  ...current,
                                  modelOptions: current.modelOptions.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, supportsStructuredOutput: event.target.checked } : item,
                                  ),
                                }))
                              }
                            />
                            Structured output
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(model.supportsToolUse)}
                              onChange={(event) =>
                                setProviderForm((current) => ({
                                  ...current,
                                  modelOptions: current.modelOptions.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, supportsToolUse: event.target.checked } : item,
                                  ),
                                }))
                              }
                            />
                            Tool use
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(model.supportsReasoning)}
                              onChange={(event) =>
                                setProviderForm((current) => ({
                                  ...current,
                                  modelOptions: current.modelOptions.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, supportsReasoning: event.target.checked } : item,
                                  ),
                                }))
                              }
                            />
                            Reasoning
                          </label>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                              type="radio"
                              name="default-model"
                              checked={providerForm.defaultModelId === model.modelId}
                              onChange={() => setProviderForm((current) => ({ ...current, defaultModelId: model.modelId }))}
                            />
                            Default model
                          </label>

                          {providerForm.modelOptions.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setProviderForm((current) => ({
                                  ...current,
                                  modelOptions: current.modelOptions.filter((_, itemIndex) => itemIndex !== index),
                                  defaultModelId:
                                    current.defaultModelId === model.modelId
                                      ? current.modelOptions.find((_, itemIndex) => itemIndex !== index)?.modelId ?? ""
                                      : current.defaultModelId,
                                }))
                              }
                              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                            >
                              Remove model
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <SettingField label="Notes">
                  <textarea
                    value={providerForm.notes ?? ""}
                    onChange={(event) => setProviderForm((current) => ({ ...current, notes: event.target.value }))}
                    className={`${inputClass} min-h-[90px]`}
                    placeholder="Operational notes, warnings, or deployment details."
                  />
                </SettingField>

                <button
                  type="button"
                  onClick={() => void saveProvider()}
                  disabled={isSavingProvider}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  <Sparkles size={16} />
                  {editingProviderId ? "Save provider changes" : "Add provider"}
                </button>
              </div>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-5">
              <p className="text-sm font-semibold text-slate-900">General backend settings</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <SettingField label="Default source result limit">
                  <input
                    type="number"
                    value={settings.general.defaultSourceResultLimit}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: { ...current.general, defaultSourceResultLimit: Number(event.target.value) },
                      }))
                    }
                    className={inputClass}
                  />
                </SettingField>
                <SettingField label="Similarity threshold">
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.general.similarityThreshold}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: { ...current.general, similarityThreshold: Number(event.target.value) },
                      }))
                    }
                    className={inputClass}
                  />
                </SettingField>
                <SettingField label="Source timeout (ms)" help="Maximum time allowed for connector and approved-domain source retrieval before the backend stops waiting.">
                  <input
                    type="number"
                    value={settings.general.sourceTimeoutMs}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: { ...current.general, sourceTimeoutMs: Number(event.target.value) },
                      }))
                    }
                    className={inputClass}
                  />
                </SettingField>
                <SettingField label="Translation timeout (ms)" help="Maximum time allowed for AI-first translation and Google fallback before the request errors clearly.">
                  <input
                    type="number"
                    value={settings.general.translationTimeoutMs}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: { ...current.general, translationTimeoutMs: Number(event.target.value) },
                      }))
                    }
                    className={inputClass}
                  />
                </SettingField>
              </div>

              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">Caching enabled</p>
                    <p className="mt-1 text-xs text-slate-500">Reuses recent source-search and translation results to reduce repeat latency and cost.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.general.cachingEnabled}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: { ...current.general, cachingEnabled: event.target.checked },
                      }))
                    }
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">Allow web fallback</p>
                    <p className="mt-1 text-xs text-slate-500">Allows approved-domain fallback adapters when primary connectors do not return enough source material.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.general.allowWebFallback}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: { ...current.general, allowWebFallback: event.target.checked },
                      }))
                    }
                  />
                </label>

                <SettingField label="Fallback domain allowlist" help="Only these approved domains may be used by the controlled web fallback adapters. Subdomains are allowed automatically.">
                  <input
                    value={settings.general.fallbackDomainAllowlist.join(", ")}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: {
                          ...current.general,
                          fallbackDomainAllowlist: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                    className={inputClass}
                    placeholder="quran.com, sunnah.com"
                  />
                </SettingField>

                <SettingField label="Topics list" help="These topics are available when reviewing and saving sources. Enter them as a comma-separated list.">
                  <input
                    value={settings.general.topicsList.join(", ")}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: {
                          ...current.general,
                          topicsList: parseLookupList(event.target.value),
                        },
                      }))
                    }
                    className={inputClass}
                    placeholder="Allah / Tawhid, Women and Family"
                  />
                </SettingField>

                <SettingField label="Audience type list" help="These options are available when classifying and editing cases. Enter them as a comma-separated list.">
                  <input
                    value={settings.general.audienceTypeList.join(", ")}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: {
                          ...current.general,
                          audienceTypeList: parseLookupList(event.target.value),
                        },
                      }))
                    }
                    className={inputClass}
                    placeholder="General, Seeker, Christian / Jesus-focused"
                  />
                </SettingField>

                <SettingField label="Question type list" help="These options are available when classifying and editing cases. Enter them as a comma-separated list.">
                  <input
                    value={settings.general.questionTypeList.join(", ")}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: {
                          ...current.general,
                          questionTypeList: parseLookupList(event.target.value),
                        },
                      }))
                    }
                    className={inputClass}
                    placeholder="Clarification, Comparative, Evidential"
                  />
                </SettingField>

                <SettingField label="Difficulty list" help="These options are available when classifying and editing cases. Enter them as a comma-separated list.">
                  <input
                    value={settings.general.difficultyList.join(", ")}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: {
                          ...current.general,
                          difficultyList: parseLookupList(event.target.value),
                        },
                      }))
                    }
                    className={inputClass}
                    placeholder="Easy, Medium, Advanced, Hard"
                  />
                </SettingField>

                <SettingField label="Likely intent list" help="These options are available when classifying and editing cases. Enter them as a comma-separated list.">
                  <input
                    value={settings.general.likelyIntentList.join(", ")}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        general: {
                          ...current.general,
                          likelyIntentList: parseLookupList(event.target.value),
                        },
                      }))
                    }
                    className={inputClass}
                    placeholder="Seek understanding, Seeking proof, Challenge"
                  />
                </SettingField>
              </div>
            </article>
          </section>
        </div>
      </section>
      </div>
    </>
  );
};
