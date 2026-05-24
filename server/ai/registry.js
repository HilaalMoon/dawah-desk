import { createMockProviderAdapter } from "./adapters/mockProvider.js";
import { createOpenAICompatibleAdapter } from "./adapters/openaiCompatible.js";
import { createVertexAiAdapter } from "./adapters/vertexAi.js";

export const createAIProviderAdapter = (provider) => {
  if (!provider) {
    throw new Error("Provider configuration is missing.");
  }

  if (provider.providerType === "other") {
    return createMockProviderAdapter(provider);
  }

  if (provider.providerType === "openai" || provider.providerType === "custom-openai-compatible") {
    return createOpenAICompatibleAdapter(provider);
  }

  if (provider.providerType === "vertex-ai") {
    return createVertexAiAdapter(provider);
  }

  return {
    provider,
    async generateStructured() {
      throw new Error(`${provider.providerType} adapter is not implemented yet.`);
    },
    async generateText() {
      throw new Error(`${provider.providerType} adapter is not implemented yet.`);
    },
    async healthCheck() {
      return {
        ok: false,
        message: `${provider.providerType} adapter is not implemented yet.`,
      };
    },
  };
};

export const resolveProviderModel = (state, sessionId = "local-session") => {
  const defaults = state.settings?.aiDefaults ?? {};
  const providerId = defaults.defaultProviderId;
  const modelId = defaults.defaultModelId;

  const provider = state.aiProviders?.find((item) => item.providerId === providerId);
  if (!provider) {
    throw new Error("No active AI provider is configured.");
  }
  if (!provider.enabled) {
    throw new Error(`${provider.name} is disabled.`);
  }

  const model = provider.modelOptions?.find((item) => item.modelId === modelId && item.enabled);
  if (!model) {
    throw new Error(`Model ${modelId} is not enabled for ${provider.name}.`);
  }

  return {
    provider,
    model,
    sessionSelection: {
      sessionId,
      providerId: defaults.defaultProviderId,
      modelId: defaults.defaultModelId,
      inheritedFromDefault: true,
      updatedAt: new Date().toISOString(),
    },
  };
};
