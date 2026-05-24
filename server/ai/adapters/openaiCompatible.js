const getApiKey = (provider) => {
  if (!provider.apiKeyRef) {
    throw new Error(`No API key reference configured for ${provider.name}.`);
  }

  const key = process.env[provider.apiKeyRef];
  if (!key) {
    throw new Error(`Missing environment variable for ${provider.apiKeyRef}.`);
  }

  return key;
};

const getBaseUrl = (provider) => {
  if (!provider.baseUrl) {
    throw new Error(`No base URL configured for ${provider.name}.`);
  }
  return provider.baseUrl.replace(/\/$/, "");
};

const isGoogleOpenAICompat = (baseUrl) =>
  baseUrl.includes("generativelanguage.googleapis.com");

const parseResponseText = async (response) => {
  const data = await response.json();
  const outputs = Array.isArray(data.output) ? data.output : [];
  const texts = outputs.flatMap((item) =>
    Array.isArray(item.content)
      ? item.content
          .filter((contentItem) => contentItem.type === "output_text")
          .map((contentItem) => contentItem.text ?? "")
      : [],
  );

  return {
    data,
    text: texts.join("\n").trim(),
  };
};

export const createOpenAICompatibleAdapter = (provider) => ({
  provider,
  async generateStructured({ modelId, systemPrompt, userPrompt, schema }) {
    const baseUrl = getBaseUrl(provider);
    const apiKey = getApiKey(provider);

    if (isGoogleOpenAICompat(baseUrl)) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(provider.headers ?? {}),
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "structured_output",
              schema,
            },
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Provider request failed: ${response.status} ${body.slice(0, 160)}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      return JSON.parse(text);
    }

    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(provider.headers ?? {}),
      },
      body: JSON.stringify({
        model: modelId,
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "structured_output",
            schema,
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Provider request failed: ${response.status} ${body.slice(0, 160)}`);
    }

    const { text } = await parseResponseText(response);
    return JSON.parse(text);
  },
  async generateText({ modelId, systemPrompt, userPrompt }) {
    const baseUrl = getBaseUrl(provider);
    const apiKey = getApiKey(provider);

    if (isGoogleOpenAICompat(baseUrl)) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(provider.headers ?? {}),
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Provider request failed: ${response.status} ${body.slice(0, 160)}`);
      }

      const data = await response.json();
      return { text: data.choices?.[0]?.message?.content?.trim?.() ?? "" };
    }

    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(provider.headers ?? {}),
      },
      body: JSON.stringify({
        model: modelId,
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Provider request failed: ${response.status} ${body.slice(0, 160)}`);
    }

    const { text } = await parseResponseText(response);
    return { text };
  },
  async healthCheck({ modelId } = {}) {
    const selectedModelId = modelId || provider.defaultModelId || provider.modelOptions?.find((option) => option.enabled)?.modelId;
    if (!selectedModelId) {
      return { ok: false, message: "No enabled model is configured." };
    }

    await this.generateText({
      modelId: selectedModelId,
      systemPrompt: "You are a health-check assistant.",
      userPrompt: "Reply with the single word OK.",
    });

    return {
      ok: true,
      message: `Provider responded using ${selectedModelId}.`,
    };
  },
});
