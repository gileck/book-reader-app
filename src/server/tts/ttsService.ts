import { TtsAdapterFactory, TtsProvider } from './adapters/ttsAdapterFactory';
import { getVoiceTier, isValidVoiceForProvider, getDefaultVoiceForProvider } from '../../common/tts/ttsUtils';

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
        // Use the provider parameter or fallback to current provider
        const targetProvider = provider || TtsAdapterFactory.getProvider();
        
        // Validate that the voice ID is compatible with the target provider
        if (!isValidVoiceForProvider(targetProvider, voiceId)) {
            console.warn(`Voice ID ${voiceId} is not valid for provider ${targetProvider}. Using default voice.`);
            voiceId = getDefaultVoiceForProvider(targetProvider);
        }
        
        const adapter = await TtsAdapterFactory.getAdapter(targetProvider);
        if (!adapter) {
            console.error('No TTS adapter available');
            return null;
        }

        // Determine voice tier from voiceId and the SAME provider being used for synthesis
        const voiceTier = getVoiceTier(targetProvider, voiceId);

        console.log(`TTS Synthesis - Provider: ${targetProvider}, Voice: ${voiceId}, Tier: ${voiceTier}`);

        return await adapter.synthesizeSpeech(text, {
            voiceId,
            languageCode: 'en-US',
            speakingRate: 1.0,
            pitch: 0.0,
            volumeGainDb: 0.0,
            voiceTier: voiceTier
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