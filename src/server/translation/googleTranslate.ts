import { v2 } from '@google-cloud/translate';
import * as fs from 'fs';

// Initialize Google Translate client
// Handle both file path and direct JSON credentials
function initializeTranslateClient() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

  if (!credentialsPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
  }

  // Check if it's a valid file path
  if (fs.existsSync(credentialsPath)) {
    // It's a file path
    return new v2.Translate({
      keyFilename: credentialsPath,
      projectId,
    });
  }

  // Otherwise, try to parse it as JSON credentials
  try {
    let credentials;
    
    // Try to parse as JSON first
    try {
      credentials = JSON.parse(credentialsPath);
    } catch {
      // If that fails, try base64 decode then parse
      const decoded = Buffer.from(credentialsPath, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }

    return new v2.Translate({
      credentials,
      projectId: projectId || credentials.project_id,
    });
  } catch (error) {
    throw new Error(
      `Failed to initialize Google Translate client. GOOGLE_APPLICATION_CREDENTIALS should be either a file path or valid JSON credentials. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

const translate = initializeTranslateClient();

// Cost calculation: $20 per 1M characters
const COST_PER_MILLION_CHARS = 20;

export interface TranslateOptions {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface TranslateResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  characterCount: number;
  cost: number;
}

/**
 * Translate text using Google Cloud Translation API
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslateResult> {
  try {
    const options: { to: string; from?: string } = {
      to: targetLanguage,
    };

    if (sourceLanguage) {
      options.from = sourceLanguage;
    }

    // Call Google Translate API
    const [translation, metadata] = await translate.translate(text, options);

    // Calculate cost
    const characterCount = text.length;
    const cost = (characterCount / 1000000) * COST_PER_MILLION_CHARS;

    return {
      translatedText: Array.isArray(translation) ? translation[0] : translation,
      detectedSourceLanguage: metadata?.data?.translations?.[0]?.detectedSourceLanguage || sourceLanguage,
      characterCount,
      cost,
    };
  } catch (error) {
    console.error('Google Translate API error:', error);
    throw new Error(
      `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate cost for a given text length
 */
export function calculateTranslationCost(characterCount: number): number {
  return (characterCount / 1000000) * COST_PER_MILLION_CHARS;
}

/**
 * Get supported languages
 */
export async function getSupportedLanguages(): Promise<Array<{ code: string; name: string }>> {
  try {
    const [languages] = await translate.getLanguages();
    return languages.map(lang => ({
      code: lang.code,
      name: lang.name,
    }));
  } catch (error) {
    console.error('Error fetching supported languages:', error);
    return [];
  }
}

