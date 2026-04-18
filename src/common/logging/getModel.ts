// Supported Gemini models
export const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
] as const

export type GeminiModelKey = (typeof GEMINI_MODELS)[number]
export type ModelKey = GeminiModelKey
export type ProviderKey = 'google'
