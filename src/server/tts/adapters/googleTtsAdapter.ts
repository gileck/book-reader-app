import * as textToSpeech from '@google-cloud/text-to-speech';
import { BaseTtsAdapter, TTSResult, TTSConfig } from './baseTtsAdapter';
import { addTtsUsageRecord } from '../../tts-usage-monitoring';
import { getAllVoiceIds, voiceSupportsSsmlMarks } from '../../../common/tts/ttsUtils';

export class GoogleTtsAdapter extends BaseTtsAdapter {
    name = 'google';
    private client: textToSpeech.v1beta1.TextToSpeechClient | null = null;

    private getClient() {
        if (this.client) return this.client;

        try {
            const keyBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            if (!keyBase64) {
                throw new Error('GOOGLE_APPLICATION_CREDENTIALS not found');
            }
            const credentials = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'));
            this.client = new textToSpeech.v1beta1.TextToSpeechClient({
                credentials,
            });
            return this.client;
        } catch (e) {
            console.error('Failed to initialize Google TTS client:', e);
            return null;
        }
    }

    async synthesizeSpeech(text: string, config: TTSConfig): Promise<TTSResult | null> {
        const client = this.getClient();
        if (!client) {
            return null;
        }

        try {
            // Check if this voice supports SSML marks for word-level timing
            const supportsMarks = voiceSupportsSsmlMarks('google', config.voiceId);
            const ssmlText = supportsMarks 
                ? this.generateSSMLWithMarks(text) 
                : this.generatePlainSSML(text);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const request: any = {
                input: { ssml: ssmlText },
                voice: {
                    languageCode: config.languageCode || 'en-US',
                    name: config.voiceId
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: config.speakingRate || 1.0,
                    pitch: config.pitch || 0.0,
                    volumeGainDb: config.volumeGainDb || 0.0
                }
            };

            // Only enable time pointing if the voice supports SSML marks
            if (supportsMarks) {
                request.enableTimePointing = ['SSML_MARK'];
            }

            const [response] = await client.synthesizeSpeech(request);

            // Only extract timepoints if the voice supports marks
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const timepoints = supportsMarks 
                ? ((response as any)?.timepoints?.map((tp: any) => ({
                    markName: tp.markName,
                    timeSeconds: tp.timeSeconds
                })) || [])
                : [];
            /* eslint-enable @typescript-eslint/no-explicit-any */

            const audioContent = response.audioContent;
            const result = {
                audioContent: audioContent instanceof Uint8Array
                    ? Buffer.from(audioContent).toString('base64')
                    : audioContent?.toString() || '',
                timepoints
            };

            // Track usage async (don't await)
            const audioLength = timepoints.length > 0 ? timepoints[timepoints.length - 1].timeSeconds : 0;

            // Google billing counts all characters in SSML except <mark> tags
            // Remove all <mark> tags from SSML for accurate billing count
            const billableText = ssmlText.replace(/<mark[^>]*\/>/g, '');
            const billableCharCount = billableText.length;

            const cost = this.calculateCost(billableCharCount, audioLength, config.voiceTier || 'standard');
            addTtsUsageRecord('google', config.voiceId, billableCharCount, audioLength, cost, 'tts-api', config.voiceTier, undefined, false)
                .catch(error => console.error('Error tracking TTS usage:', error));

            return result;
        } catch (error) {
            console.error('Google TTS synthesis error:', error);
            return null;
        }
    }

    private calculateCost(textLength: number, audioLength: number, voiceTier: string): number {
        // Google TTS pricing (November 2025)
        // https://cloud.google.com/text-to-speech/pricing
        let costPerCharacter: number;
        switch (voiceTier) {
            case 'studio':
                costPerCharacter = 0.00016;   // $160 per 1M characters
                break;
            case 'chirp3-hd':
                costPerCharacter = 0.00003;   // $30 per 1M characters
                break;
            case 'neural2':
            case 'polyglot':
                costPerCharacter = 0.000016;  // $16 per 1M characters
                break;
            case 'wavenet':
            case 'standard':
            default:
                costPerCharacter = 0.000004;  // $4 per 1M characters
                break;
        }
        return textLength * costPerCharacter;
    }

    async getSupportedVoices(): Promise<string[]> {
        return getAllVoiceIds('google');
    }

    async isAvailable(): Promise<boolean> {
        return this.getClient() !== null;
    }
} 