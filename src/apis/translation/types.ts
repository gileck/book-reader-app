// Request/Response types for translation API

export interface TranslateTextRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string; // Optional, will be auto-detected if not provided
}

export interface TranslateTextResponse {
  translatedText: string;
  detectedSourceLanguage?: string;
  success: boolean;
  error?: string;
  characterCount?: number;
  cost?: number;
  fromCache?: boolean;
  freeTierUsage?: {
    used: number;
    total: number;
    remaining: number;
    percentUsed: number;
  };
}

// For internal cache/usage tracking
export interface TranslationRecord {
  text: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: Date;
  characterCount: number;
  cost: number;
  fromCache: boolean;
}

