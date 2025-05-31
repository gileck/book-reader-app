import { EnhancedGenerateContentResponse, GenerationConfig, GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIModel,
  AIModelResponse,
  Usage
} from '../types';

export class GeminiAdapter implements AIModel {
  static provider = 'gemini';
  private genAI: GoogleGenerativeAI;

  constructor() {
    // Get API key from environment variable
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key not found in environment variables');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private calcUsage(response: EnhancedGenerateContentResponse): Usage {
    // Get token usage from the usage_metadata in the response
    const usageMetadata = response.usageMetadata;
    
    return {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      completionTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens: usageMetadata?.totalTokenCount || 0
    };
  }

  private getModel(modelId: string, generationConfig?: Partial<GenerationConfig>): GenerativeModel {
    return this.genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        ...generationConfig
      }
    });
  }
  
  // Make an API call to the Gemini model and return plain text
  async processPromptToText(
    prompt: string,
    modelId: string,
  ): Promise<AIModelResponse<string>> {
    const model = this.getModel(modelId)
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const responseText = response.text();
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
    const model = this.getModel(modelId, {
      responseMimeType: 'application/json', // Always set for JSON responses
    })
    try {
      // Make the API call
      const result = await model.generateContent(prompt);
      const response = result.response;
      const responseText = response.text();
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
