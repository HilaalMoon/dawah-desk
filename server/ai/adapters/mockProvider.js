export const createMockProviderAdapter = (provider) => ({
  provider,
  async generateStructured() {
    return {
      ok: true,
      providerId: provider.providerId,
      mock: true,
    };
  },
  async generateText({ userPrompt }) {
    return {
      text: `Mock response for: ${userPrompt}`,
    };
  },
  async healthCheck({ modelId } = {}) {
    return {
      ok: true,
      message: `Mock provider ready${modelId ? ` with ${modelId}` : ""}.`,
    };
  },
});
