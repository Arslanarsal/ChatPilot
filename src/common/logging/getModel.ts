// Supported Gemini models
export const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
] as const

// Supported OpenAI models
export const OPENAI_MODELS = [
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-5-mini',
  'o1',
  'o1-mini',
  'o1-preview',
] as const

export type GeminiModelKey = (typeof GEMINI_MODELS)[number]
export type OpenAIModelKey = (typeof OPENAI_MODELS)[number]
export type AllModelKeys = GeminiModelKey | OpenAIModelKey
export type ModelKey = AllModelKeys
export type ProviderKey = 'google' | 'openai'
