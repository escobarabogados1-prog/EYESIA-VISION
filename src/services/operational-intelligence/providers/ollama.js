function createOllamaProvider({
  baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434',
  model = process.env.OLLAMA_MODEL || 'qwen2.5:3b',
  seed = Number(process.env.OLLAMA_SEED) || 42
} = {}) {
  return {
    id: 'ollama',
    displayName: 'Ollama',
    model,
    async generate({ prompt, timeoutMs }) {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0,
            seed
          }
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`Error Ollama: HTTP ${response.status}`);
      }

      const data = await response.json();

      if (typeof data.response !== 'string' || !data.response.trim()) {
        throw new Error('Ollama no devolvió respuesta');
      }

      return data.response;
    }
  };
}

module.exports = {
  createOllamaProvider
};