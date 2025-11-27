import { GoogleGenAI, Modality } from '@google/genai';
import { BaseTtsAdapter, TTSResult, TTSConfig } from './baseTtsAdapter';
import { addTtsUsageRecord } from '../../tts-usage-monitoring';
import { getAllVoiceIds } from '../../../common/tts/ttsUtils';

/**
 * Gemini TTS Adapter
 * 
 * Uses Google's Gemini API for text-to-speech synthesis.
 * Supports Gemini 2.5 Flash and Pro models with 30 high-quality voices.
 * 
 * Note: Gemini TTS does NOT support SSML marks for word-level timing.
 * Word timing must be estimated or handled differently.
 */
export class GeminiTtsAdapter extends BaseTtsAdapter {
    name = 'gemini';
    private client: GoogleGenAI | null = null;

    private getClient(): GoogleGenAI | null {
        if (this.client) return this.client;

        try {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                console.error('GEMINI_API_KEY not found in environment variables');
                return null;
            }
            this.client = new GoogleGenAI({ apiKey });
            return this.client;
        } catch (e) {
            console.error('Failed to initialize Gemini TTS client:', e);
            return null;
        }
    }

    async synthesizeSpeech(text: string, config: TTSConfig): Promise<TTSResult | null> {
        const client = this.getClient();
        if (!client) {
            return null;
        }

        try {
            // Extract voice name from config (e.g., "Puck" from the voice ID)
            const voiceName = this.extractVoiceName(config.voiceId);

            // Determine which Gemini model to use based on voiceTier
            const modelId = this.getModelId(config.voiceTier);

            console.log(`Gemini TTS - Model: ${modelId}, Voice: ${voiceName}, Text length: ${text.length}`);

            // Generate speech using Gemini API
            const response = await client.models.generateContent({
                model: modelId,
                contents: text,
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceName
                            }
                        }
                    }
                }
            });

            // Extract audio data from response
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const responseData = response as any;

            // The response structure may vary - try to extract audio content
            let audioContent: string | null = null;

            if (responseData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
                audioContent = responseData.candidates[0].content.parts[0].inlineData.data;
            } else if (responseData.audio?.data) {
                audioContent = responseData.audio.data;
            } else if (typeof responseData.audioContent === 'string') {
                audioContent = responseData.audioContent;
            }

            if (!audioContent) {
                console.error('No audio content in Gemini TTS response');
                console.log('Response structure:', JSON.stringify(Object.keys(responseData)));
                return null;
            }

            // Gemini TTS does not provide word-level timing
            // Return empty timepoints array
            const result: TTSResult = {
                audioContent,
                timepoints: []
            };

            // Track usage
            const cost = this.calculateCost(text.length, 0, config.voiceTier || 'gemini-flash');
            addTtsUsageRecord('gemini', config.voiceId, text.length, 0, cost, 'gemini-tts', config.voiceTier, undefined, false)
                .catch(error => console.error('Error tracking Gemini TTS usage:', error));

            return result;
        } catch (error) {
            console.error('Gemini TTS synthesis error:', error);
            return null;
        }
    }

    private extractVoiceName(voiceId: string): string {
        // Voice IDs are in format:
        // - "gemini-Puck" -> "Puck"
        // - "gemini-pro-Puck" -> "Puck"
        // - "gemini-lite-Puck" -> "Puck"
        if (voiceId.startsWith('gemini-pro-')) {
            return voiceId.replace('gemini-pro-', '');
        }
        if (voiceId.startsWith('gemini-lite-')) {
            return voiceId.replace('gemini-lite-', '');
        }
        if (voiceId.startsWith('gemini-')) {
            return voiceId.replace('gemini-', '');
        }
        return voiceId;
    }

    private getModelId(voiceTier?: string): string {
        // Map voice tier to Gemini model
        switch (voiceTier) {
            case 'gemini-pro':
                return 'gemini-2.5-pro-preview-tts';
            case 'gemini-flash-lite':
                return 'gemini-2.5-flash-lite-preview-tts';
            case 'gemini-flash':
            default:
                return 'gemini-2.5-flash-preview-tts';
        }
    }

    private calculateCost(textLength: number, audioLength: number, voiceTier: string): number {
        // Gemini TTS pricing (November 2025)
        // These are approximate costs based on available information
        // Flash: ~$0.008 per 1K characters
        // Pro: ~$0.03 per 1K characters
        let costPerCharacter: number;
        switch (voiceTier) {
            case 'gemini-pro':
                costPerCharacter = 0.00003;   // ~$30 per 1M characters
                break;
            case 'gemini-flash-lite':
                costPerCharacter = 0.000004;  // ~$4 per 1M characters
                break;
            case 'gemini-flash':
            default:
                costPerCharacter = 0.000008;  // ~$8 per 1M characters
                break;
        }
        return textLength * costPerCharacter;
    }

    async getSupportedVoices(): Promise<string[]> {
        return getAllVoiceIds('gemini');
    }

    async isAvailable(): Promise<boolean> {
        return this.getClient() !== null;
    }
}

