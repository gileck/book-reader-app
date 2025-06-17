import { TtsAdapterFactory, TtsProvider } from './adapters/ttsAdapterFactory';

export interface TTSTimepoint {
    markName: string;
    timeSeconds: number;
}

export interface TTSResult {
    audioContent: string; // base64 encoded audio
    timepoints: TTSTimepoint[];
}

export async function synthesizeSpeechWithTiming(
    text: string,
    voiceId: string = 'en-US-Neural2-F',
    provider?: TtsProvider
): Promise<TTSResult | null> {
    try {
        const adapter = await TtsAdapterFactory.getAdapter(provider);
        if (!adapter) {
            console.error('No TTS adapter available');
            return null;
        }

        // Determine voice tier from voiceId
        const getVoiceTier = (voiceId: string): 'standard' | 'neural' | 'long-form' | 'generative' => {
            const longFormVoices = ['Danielle', 'Gregory', 'Burrow'];
            const neuralVoices = ['Emma', 'Olivia', 'Aria', 'Ayanda', 'Ivy'];
            const standardVoices = ['Joanna', 'Matthew', 'Amy', 'Brian', 'Joey', 'Justin', 'Kendra', 'Kimberly', 'Salli', 'Kevin', 'Stephen'];
            
            if (longFormVoices.includes(voiceId)) return 'long-form';
            if (neuralVoices.includes(voiceId)) return 'neural';
            if (standardVoices.includes(voiceId)) return 'standard';
            
            // For Google voices or fallback
            if (voiceId.includes('Neural2')) return 'neural';
            return 'standard';
        };

        return await adapter.synthesizeSpeech(text, {
            voiceId,
            languageCode: 'en-US',
            speakingRate: 1.0,
            pitch: 0.0,
            volumeGainDb: 0.0,
            voiceTier: getVoiceTier(voiceId)
        });
    } catch (error) {
        console.error('TTS synthesis error:', error);
        return null;
    }
}

export async function getAvailableTtsProviders(): Promise<TtsProvider[]> {
    return await TtsAdapterFactory.getAvailableProviders();
}

export function setTtsProvider(provider: TtsProvider): void {
    TtsAdapterFactory.setProvider(provider);
}

export function getCurrentTtsProvider(): TtsProvider {
    return TtsAdapterFactory.getProvider();
}

// processTextForTTS removed - text is pre-chunked during PDF import 