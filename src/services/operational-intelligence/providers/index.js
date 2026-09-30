const { createOllamaProvider } = require('./ollama');
const { createOpenAICompatibleProvider } = require('./openai-compatible');

function createProvider(providerName = process.env.AI_PROVIDER || 'ollama') {
  if (providerName === 'ollama') return createOllamaProvider();
  if (providerName === 'openai-compatible') return createOpenAICompatibleProvider();

  throw new Error(`Proveedor de IA no soportado: ${providerName}`);
}

module.exports = {
  createProvider
};