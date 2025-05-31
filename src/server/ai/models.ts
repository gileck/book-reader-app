/**
 * Shared model definitions for AI providers
 * These types are used by both client and server code
 */

export interface AIModelDefinition {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | string;
  maxTokens: number;
  capabilities: string[];
}

// Gemini models with pricing information
export const GEMINI_MODELS: AIModelDefinition[] = [
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash-8B',
    provider: 'gemini',
    maxTokens: 1048576,
    capabilities: ['summarization', 'question-answering', 'content-generation']
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    maxTokens: 32768,
    capabilities: ['summarization', 'question-answering', 'content-generation', 'reasoning']
  }
];

// OpenAI models with pricing information
export const OPENAI_MODELS: AIModelDefinition[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4O Mini',
    provider: 'openai',
    maxTokens: 8192,
    capabilities: ['summarization', 'question-answering', 'content-generation', 'reasoning']
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4O',
    provider: 'openai',
    maxTokens: 8192,
    capabilities: ['summarization', 'question-answering', 'content-generation', 'reasoning']
  }
];

// Helper function to get all available models
export function getAllModels(): AIModelDefinition[] {
  return [...GEMINI_MODELS, ...OPENAI_MODELS];
}

// Helper function to get models by provider
export function getModelsByProvider(provider: string): AIModelDefinition[] {
  return getAllModels().filter(model => model.provider === provider);
}

// Helper function to get a model by ID
export function getModelById(modelId: string): AIModelDefinition {
  const model = getAllModels().find(model => model.id === modelId);
  if (!model) {
    throw new Error(`Model not found: ${modelId}`);
  }
  return model;
}

export function isModelExists(modelId: string): boolean {
  return getAllModels().some(model => model.id === modelId);
}
