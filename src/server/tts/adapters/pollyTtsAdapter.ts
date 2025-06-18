import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { BaseTtsAdapter, TTSResult, TTSConfig, TTSTimepoint } from './baseTtsAdapter';
import { addTtsUsageRecord } from '../../tts-usage-monitoring';

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

        try {
            const ssmlText = this.generateSSMLWithMarks(text);

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

            const engine = getEngine(config.voiceTier);

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

            const speechMarksResponse = await client.send(speechMarksCommand);
            
            // Parse speech marks to get timepoints
            const timepoints: TTSTimepoint[] = [];
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

            // Then, get the actual audio
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
            
            // Amazon Polly billing: "SSML tags are not counted as billed characters"
            // Remove all SSML tags from text for accurate billing count
            const billableText = ssmlText.replace(/<[^>]*>/g, '');
            const billableCharCount = billableText.length;
            
            const cost = this.calculateCost(billableCharCount, audioLength, config.voiceTier || 'standard');
            addTtsUsageRecord('polly', config.voiceId, billableCharCount, audioLength, cost, 'tts-api', config.voiceTier)
                .catch(error => console.error('Error tracking TTS usage:', error));

            return result;
        } catch (error) {
            console.error('Polly TTS synthesis error:', error);
            return null;
        }
    }

    private calculateCost(textLength: number, audioLength: number, voiceTier: string): number {
        // Amazon Polly pricing (approximate)
        let costPerCharacter: number;
        switch (voiceTier) {
            case 'neural':
                costPerCharacter = 0.000025; // $25 per 1M characters
                break;
            case 'long-form':
                costPerCharacter = 0.00010; // $100 per 1M characters
                break;
            case 'generative':
                costPerCharacter = 0.00020; // $200 per 1M characters
                break;
            default: // standard
                costPerCharacter = 0.000004; // $4 per 1M characters
                break;
        }
        return textLength * costPerCharacter;
    }

    async getSupportedVoices(): Promise<string[]> {
        return [
            // Standard voices
            'Joanna',
            'Matthew',
            'Amy',
            'Brian',
            'Joey',
            'Justin',
            'Kendra',
            'Kimberly',
            'Salli',
            'Kevin',
            'Stephen',
            // Neural voices
            'Emma',
            'Olivia',
            'Aria',
            'Ayanda',
            'Ivy',
            // Long-form voices
            'Danielle',
            'Gregory',
            'Burrow'
        ];
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