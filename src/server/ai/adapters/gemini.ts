import { GoogleGenAI } from '@google/genai';
import {
  AIModel,
  AIModelResponse,
  Usage
} from '../types';

type GenAIUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

export class GeminiAdapter implements AIModel {
  static provider = 'gemini';
  private genAI: GoogleGenAI;

  constructor() {
    // Get API key from environment variable
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key not found in environment variables');
    }

    this.genAI = new GoogleGenAI({ apiKey });
  }

  private calcUsage(response: { usageMetadata?: GenAIUsageMetadata }): Usage {
    // Normalize usage metadata across SDK versions
    const usageMetadata = response.usageMetadata;
    
    return {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      completionTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens: usageMetadata?.totalTokenCount || 0
    };
  }

  // New SDK primarily uses ai.models.generateContent; keep a thin helper if needed later.
  private async generateContent(modelId: string, contents: string) {
    return await this.genAI.models.generateContent({
      model: modelId,
      contents
    });
  }
  
  // Make an API call to the Gemini model and return plain text
  async processPromptToText(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<string>> {
    try {
      const response = await this.generateContent(modelId, prompt);
      const responseText = (response as unknown as { text?: string }).text || '';
      return {
        result: responseText,
        usage: this.calcUsage(response),
      };
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw error;
    }
  }

  // Make an API call to the Gemini model and return parsed JSON
  async processPromptToJSON<T>(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<T>> {
    try {
      const response = await this.generateContent(modelId, prompt);
      const responseText = (response as unknown as { text?: string }).text || '';
      // Parse JSON
      let json: T;
      try {
        json = JSON.parse(responseText) as T;
      } catch (e) {
        console.error('Failed to parse JSON response:', e);
        throw new Error('Failed to parse JSON response from Gemini API');
      }
      // Return the formatted response
      return {
        result: json,
        usage: this.calcUsage(response),
      };
    } catch (error) {
      console.error('Gemini API call failed:', error);
      throw error;
    }
  }
}
