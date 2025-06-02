import * as textToSpeech from '@google-cloud/text-to-speech';
import type { TTSChunk } from '../../apis/tts/types';

export interface TTSTimepoint {
    markName: string;
    timeSeconds: number;
}

export interface TTSResult {
    audioContent: string; // base64 encoded audio
    timepoints: TTSTimepoint[];
}

function getClient() {
    try {
        const keyBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (!keyBase64) {
            throw new Error('GOOGLE_APPLICATION_CREDENTIALS not found');
        }
        const credentials = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'));
        const client = new textToSpeech.v1beta1.TextToSpeechClient({
            credentials,
        });
        return client;
    } catch (e) {
        console.error('Failed to initialize TTS client:', e);
        return null;
    }
}

function generateSSMLWithMarks(text: string): string {
    const words = text.split(' ').filter(word => word.length > 0);
    let ssml = '<speak>';

    words.forEach((word, index) => {
        ssml += ` <mark name="${word}-${index}"/> ${word}`;
    });

    ssml += '</speak>';
    return ssml;
}

// Text chunking removed - chunks are pre-processed during PDF import and stored in database

export async function synthesizeSpeechWithTiming(
    text: string,
    voiceId: string = 'en-US-Neural2-F'
): Promise<TTSResult | null> {
    const client = getClient();
    if (!client) {
        return null;
    }

    try {
        const ssmlText = generateSSMLWithMarks(text);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const request: any = {
            enableTimePointing: ['SSML_MARK'],
            input: { ssml: ssmlText },
            voice: {
                languageCode: 'en-US',
                name: voiceId
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.0,
                pitch: 0.0,
                volumeGainDb: 0.0
            }
        };

        const [response] = await client.synthesizeSpeech(request);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const timepoints: TTSTimepoint[] = (response as any)?.timepoints?.map((tp: any) => ({
            markName: tp.markName,
            timeSeconds: tp.timeSeconds
        })) || [];

        const audioContent = response.audioContent;
        return {
            audioContent: audioContent instanceof Uint8Array
                ? Buffer.from(audioContent).toString('base64')
                : audioContent?.toString() || '',
            timepoints
        };
    } catch (error) {
        console.error('TTS synthesis error:', error);
        return null;
    }
}

// processTextForTTS removed - text is pre-chunked during PDF import 