import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { BaseTtsAdapter, TTSResult, TTSConfig, TTSTimepoint } from './baseTtsAdapter';
import { addTtsUsageRecord } from '../../tts-usage-monitoring';
import { getAllVoiceIds, voiceSupportsSsmlMarks } from '../../../common/tts/ttsUtils';

export class PollyTtsAdapter extends BaseTtsAdapter {
    name = 'polly';
    private client: PollyClient | null = null;

    private getClient() {
        if (this.client) return this.client;

        try {
            if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
                throw new Error('AWS credentials not found');
            }

            this.client = new PollyClient({
                region: process.env.AWS_REGION || 'us-east-1',
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                }
            });
            return this.client;
        } catch (e) {
            console.error('Failed to initialize Polly TTS client:', e);
            return null;
        }
    }

    async synthesizeSpeech(text: string, config: TTSConfig): Promise<TTSResult | null> {
        const client = this.getClient();
        if (!client) {
            return null;
        }

        // Determine engine based on voice tier
        const getEngine = (voiceTier?: string) => {
            switch (voiceTier) {
                case 'standard': return 'standard';
                case 'neural': return 'neural';
                case 'long-form': return 'long-form';
                case 'generative': return 'generative';
                default: return 'neural'; // fallback
            }
        };

        // Check if this voice supports SSML marks for word-level timing
        // Generative voices do NOT support speech marks
        const supportsMarks = voiceSupportsSsmlMarks('polly', config.voiceId);
        const ssmlText = supportsMarks 
            ? this.generateSSMLWithMarks(text) 
            : this.generatePlainSSML(text);
        const engine = getEngine(config.voiceTier);

        try {
            const timepoints: TTSTimepoint[] = [];

            // Only fetch speech marks if the voice supports them
            if (supportsMarks) {
                // First, get speech marks for timing
                const speechMarksCommand = new SynthesizeSpeechCommand({
                    Text: ssmlText,
                    TextType: 'ssml',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    VoiceId: config.voiceId as any,
                    OutputFormat: 'json',
                    SpeechMarkTypes: ['ssml'],
                    Engine: engine as 'standard' | 'neural' | 'long-form' | 'generative'
                });

                console.log('speechMarksCommand', {
                    ssmlTextLength: ssmlText.length,
                    textLength: text.length,
                });

                const speechMarksResponse = await client.send(speechMarksCommand);

                // Parse speech marks to get timepoints
                if (speechMarksResponse.AudioStream) {
                    const speechMarksText = await this.streamToString(speechMarksResponse.AudioStream);
                    const lines = speechMarksText.trim().split('\n');

                    for (const line of lines) {
                        try {
                            const mark = JSON.parse(line);
                            if (mark.type === 'ssml' && mark.value) {
                                timepoints.push({
                                    markName: mark.value,
                                    timeSeconds: mark.time / 1000 // Convert ms to seconds
                                });
                            }
                        } catch {
                            // Skip invalid JSON lines
                        }
                    }
                }
            } else {
                console.log('🔵 [POLLY TTS] Skipping speech marks - voice does not support SSML marks:', {
                    voiceId: config.voiceId,
                    voiceTier: config.voiceTier,
                    engine: engine
                });
            }

            // Get the actual audio
            const audioCommand = new SynthesizeSpeechCommand({
                Text: ssmlText,
                TextType: 'ssml',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                VoiceId: config.voiceId as any,
                OutputFormat: 'mp3',
                Engine: engine as 'standard' | 'neural' | 'long-form' | 'generative'
            });

            const audioResponse = await client.send(audioCommand);

            if (!audioResponse.AudioStream) {
                return null;
            }

            const audioBuffer = await this.streamToBuffer(audioResponse.AudioStream);
            const audioContent = audioBuffer.toString('base64');

            const result = {
                audioContent,
                timepoints
            };

            // Track usage async (don't await)
            const audioLength = timepoints.length > 0 ? timepoints[timepoints.length - 1].timeSeconds : 0;

            // Amazon Polly billing:
            // - For voices with marks: AWS counts original text PLUS mark attribute names
            // - For voices without marks: Just the plain SSML text
            const textChars = text.length;
            let billableCharCount: number;
            let markAttributeChars = 0;
            
            if (supportsMarks) {
                const words = text.split(' ').filter(w => w.length > 0);
                markAttributeChars = words.reduce((sum, word, i) => {
                    return sum + `${word}-${i}`.length;
                }, 0);
                billableCharCount = textChars + markAttributeChars;
            } else {
                // Plain SSML: just the text plus <speak></speak> tags (15 chars)
                billableCharCount = textChars + 15;
            }

            console.log('🟢 [POLLY TTS] Request completed:', {
                voiceId: config.voiceId,
                voiceTier: config.voiceTier,
                engine: engine,
                supportsMarks: supportsMarks,
                originalTextChars: textChars,
                markAttributeChars: markAttributeChars,
                billableChars: billableCharCount,
                ssmlLength: ssmlText.length,
                audioLength: audioLength.toFixed(2) + 's',
                timestamp: new Date().toISOString()
            });

            const cost = this.calculateCost(billableCharCount, audioLength, config.voiceTier || 'standard');
            
            console.log('🟡 [POLLY TTS] About to track usage...');
            addTtsUsageRecord('polly', config.voiceId, billableCharCount, audioLength, cost, 'tts-api', config.voiceTier, undefined, false)
                .then(() => {
                    console.log('✅ [POLLY TTS] Tracking SUCCESS:', {
                        voiceId: config.voiceId,
                        chars: billableCharCount,
                        cost: cost.toFixed(6)
                    });
                })
                .catch(error => {
                    console.error('❌ [POLLY TTS] Tracking FAILED:', {
                        voiceId: config.voiceId,
                        chars: billableCharCount,
                        error: error.message,
                        stack: error.stack
                    });
                });

            return result;
        } catch (error) {
            // Enhanced error logging with text length information
            const originalTextLength = text.length;
            const ssmlTextLength = ssmlText.length;
            
            // Calculate billable chars the same way as success case
            const textChars = text.length;
            let billableCharCount: number;
            let markAttributeChars = 0;
            
            if (supportsMarks) {
                const words = text.split(' ').filter(w => w.length > 0);
                markAttributeChars = words.reduce((sum, word, i) => {
                    return sum + `${word}-${i}`.length;
                }, 0);
                billableCharCount = textChars + markAttributeChars;
            } else {
                billableCharCount = textChars + 15;
            }

            const textLengthInfo = `How long was the provided text: ${originalTextLength} characters (original), ${ssmlTextLength} characters (with SSML markup), ${billableCharCount} characters (billable)`;

            console.error(`Polly TTS synthesis error: ${textLengthInfo}`, {
                error: error,
                textMetrics: {
                    originalTextLength,
                    ssmlTextLength,
                    billableCharCount,
                    markAttributeChars,
                    supportsMarks,
                    ssmlOverhead: ssmlTextLength - originalTextLength,
                    compressionRatio: (ssmlTextLength / originalTextLength).toFixed(2)
                },
                config: {
                    voiceId: config.voiceId,
                    voiceTier: config.voiceTier,
                    engine: getEngine(config.voiceTier)
                }
            });

            // Specific handling for text length exceeded errors
            if (error && typeof error === 'object' && 'name' in error && error.name === 'TextLengthExceededException') {
                console.error(`❌ AWS Polly Text Length Exceeded - ${textLengthInfo}`, {
                    message: 'The text provided exceeds AWS Polly\'s maximum character limit',
                    limits: {
                        'standard_neural': '3000 characters (SSML)',
                        'long-form': '100,000 characters (plain text), 200,000 characters (SSML)',
                        'generative': '3000 characters (SSML)'
                    },
                    recommendation: originalTextLength > 2000
                        ? 'Consider splitting the text into smaller chunks or using long-form voice tier'
                        : 'The SSML markup is adding significant overhead. Consider reducing mark density.'
                });
            }

            return null;
        }
    }

    private calculateCost(textLength: number, audioLength: number, voiceTier: string): number {
        // Amazon Polly pricing (November 2025)
        // https://aws.amazon.com/polly/pricing/
        let costPerCharacter: number;
        switch (voiceTier) {
            case 'neural':
                costPerCharacter = 0.000016; // $16 per 1M characters
                break;
            case 'long-form':
                costPerCharacter = 0.0001;   // $100 per 1M characters
                break;
            case 'generative':
                costPerCharacter = 0.00003;  // $30 per 1M characters
                break;
            default: // standard
                costPerCharacter = 0.000004; // $4 per 1M characters
                break;
        }
        return textLength * costPerCharacter;
    }

    async getSupportedVoices(): Promise<string[]> {
        return getAllVoiceIds('polly');
    }

    async isAvailable(): Promise<boolean> {
        return this.getClient() !== null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async streamToString(stream: any): Promise<string> {
        const chunks: Uint8Array[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const chunk of stream as any) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks).toString('utf-8');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async streamToBuffer(stream: any): Promise<Buffer> {
        const chunks: Uint8Array[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const chunk of stream as any) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }
} 