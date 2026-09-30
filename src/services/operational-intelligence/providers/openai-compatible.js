function normalizeBaseUrl(baseUrl) {
  const url = new URL(baseUrl);

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('URL del proveedor OpenAI-compatible invalida');
  }

  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  url.search = '';
  url.hash = '';
  return url;
}

function createOpenAICompatibleProvider({
  baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL || 'http://localhost:8080/v1',
  model = process.env.OPENAI_COMPATIBLE_MODEL || 'local-model',
  apiKey = process.env.OPENAI_COMPATIBLE_API_KEY || '',
  seed = Number(process.env.AI_SEED || process.env.OLLAMA_SEED) || 42
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  return {
    id: 'openai-compatible',
    displayName: 'OpenAI-compatible',
    model,
    async generate({ prompt, timeoutMs }) {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const response = await fetch(
        new URL('chat/completions', normalizedBaseUrl),
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0,
            seed
          }),
          signal: AbortSignal.timeout(timeoutMs)
        }
      );

      if (!response.ok) {
        throw new Error(`Error proveedor OpenAI-compatible: HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices && data.choices[0] &&
        data.choices[0].message && data.choices[0].message.content;

      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('El proveedor OpenAI-compatible no devolvio respuesta');
      }

      return content;
    }
  };
}

module.exports = {
  createOpenAICompatibleProvider
};