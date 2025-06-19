import { BaseTtsAdapter, TTSResult, TTSConfig, TTSTimepoint } from './baseTtsAdapter';
import { addTtsUsageRecord } from '../../tts-usage-monitoring';
import { getAllVoiceIds } from '../../../common/tts/ttsUtils';
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export class ElevenLabsAdapter extends BaseTtsAdapter {
    name = 'elevenlabs';
    private client: ElevenLabsClient | null = null;

    private getClient() {
        if (this.client) return this.client;
        
        try {
            const apiKey = process.env.ELEVEN_LABS_KEY;
            if (!apiKey) {
                throw new Error('ELEVEN_LABS_KEY not found');
            }
            
            this.client = new ElevenLabsClient({
                apiKey: apiKey
            });
            return this.client;
        } catch (e) {
            console.error('Failed to initialize ElevenLabs TTS client:', e);
            return null;
        }
    }

    private getApiKey(): string | null {
        return process.env.ELEVEN_LABS_KEY || null;
    }

    async synthesizeSpeech(text: string, config: TTSConfig): Promise<TTSResult | null> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return null;
        }

        try {
            const words = text.split(' ').filter(word => word.length > 0);
            
            // Use direct fetch for timestamps endpoint since SDK doesn't support it yet
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}/with-timestamps`, {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: false
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.audio_base64 || !data.alignment) {
                return null;
            }

            // Convert ElevenLabs alignment to our timepoint format
            const timepoints: TTSTimepoint[] = [];
            
            // ElevenLabs returns character-level alignment, we need to convert to word-level
            let currentWordIndex = 0;
            let currentWordStart = 0;
            
            for (let i = 0; i < data.alignment.character_start_times_seconds.length; i++) {
                const char = data.alignment.characters[i];
                const charStartTime = data.alignment.character_start_times_seconds[i];
                
                // If we hit a space or end of text, we've finished a word
                if (char === ' ' || i === data.alignment.characters.length - 1) {
                    if (currentWordIndex < words.length) {
                        const word = words[currentWordIndex];
                        timepoints.push({
                            markName: `${word}-${currentWordIndex}`,
                            timeSeconds: currentWordStart
                        });
                        currentWordIndex++;
                    }
                    currentWordStart = charStartTime;
                } else if (currentWordIndex < words.length && currentWordStart === 0) {
                    // Mark the start of the first character of the word
                    currentWordStart = charStartTime;
                }
            }

            const result = {
                audioContent: data.audio_base64,
                timepoints
            };

            // Track usage async (don't await)
            const characterCount = text.length;
            const cost = this.calculateCost(characterCount, timepoints.length > 0 ? timepoints[timepoints.length - 1].timeSeconds : 0);
            
            addTtsUsageRecord('elevenlabs', config.voiceId, characterCount, timepoints.length > 0 ? timepoints[timepoints.length - 1].timeSeconds : 0, cost, 'tts-api', 'neural')
                .catch(error => console.error('Error tracking TTS usage:', error));

            return result;
        } catch (error) {
            console.error('ElevenLabs TTS synthesis error:', error);
            return null;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private calculateCost(textLength: number, _audioLength: number): number {
        // ElevenLabs pricing (approximate)
        // Creator plan: $5/month for 30,000 characters
        // Pro plan: $11/month for 100,000 characters  
        // Assuming pay-per-use model: ~$0.00018 per character
        return textLength * 0.00018;
    }

    async getSupportedVoices(): Promise<string[]> {
        return getAllVoiceIds('elevenlabs');
    }

    async isAvailable(): Promise<boolean> {
        const client = this.getClient();
        if (!client) {
            return false;
        }

        try {
            // Test API connection by getting user info using the SDK
            await client.user.get();
            return true;
        } catch (error) {
            console.error('ElevenLabs API not available:', error);
            return false;
        }
    }
} 