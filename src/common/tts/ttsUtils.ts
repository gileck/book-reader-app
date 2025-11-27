export interface Voice {
    id: string;
    name: string;
    gender: 'Male' | 'Female';
    tier: 'standard' | 'wavenet' | 'neural' | 'neural2' | 'polyglot' | 'studio' | 'long-form' | 'generative';
}

export type TtsProvider = 'google' | 'polly' | 'elevenlabs';

/**
 * Voice mappings for all TTS providers (Updated November 2025)
 * 
 * Google Cloud TTS: https://cloud.google.com/text-to-speech/docs/voices
 * Amazon Polly: https://docs.aws.amazon.com/polly/latest/dg/voicelist.html
 * ElevenLabs: https://elevenlabs.io/docs/voices
 */
export const VOICE_MAPPINGS: Record<TtsProvider, Voice[]> = {
    google: [
        // Standard voices ($4/1M chars, 4M free/month) - Basic quality
        { id: 'en-US-Standard-A', name: 'Standard A', gender: 'Male', tier: 'standard' },
        { id: 'en-US-Standard-B', name: 'Standard B', gender: 'Male', tier: 'standard' },
        { id: 'en-US-Standard-C', name: 'Standard C', gender: 'Female', tier: 'standard' },
        { id: 'en-US-Standard-D', name: 'Standard D', gender: 'Male', tier: 'standard' },
        { id: 'en-US-Standard-E', name: 'Standard E', gender: 'Female', tier: 'standard' },
        { id: 'en-US-Standard-F', name: 'Standard F', gender: 'Female', tier: 'standard' },
        { id: 'en-US-Standard-G', name: 'Standard G', gender: 'Female', tier: 'standard' },
        { id: 'en-US-Standard-H', name: 'Standard H', gender: 'Female', tier: 'standard' },
        { id: 'en-US-Standard-I', name: 'Standard I', gender: 'Male', tier: 'standard' },
        { id: 'en-US-Standard-J', name: 'Standard J', gender: 'Male', tier: 'standard' },
        
        // WaveNet voices ($4/1M chars, 4M free/month) - High quality
        { id: 'en-US-Wavenet-A', name: 'Wavenet A', gender: 'Male', tier: 'wavenet' },
        { id: 'en-US-Wavenet-B', name: 'Wavenet B', gender: 'Male', tier: 'wavenet' },
        { id: 'en-US-Wavenet-C', name: 'Wavenet C', gender: 'Female', tier: 'wavenet' },
        { id: 'en-US-Wavenet-D', name: 'Wavenet D', gender: 'Male', tier: 'wavenet' },
        { id: 'en-US-Wavenet-E', name: 'Wavenet E', gender: 'Female', tier: 'wavenet' },
        { id: 'en-US-Wavenet-F', name: 'Wavenet F', gender: 'Female', tier: 'wavenet' },
        { id: 'en-US-Wavenet-G', name: 'Wavenet G', gender: 'Female', tier: 'wavenet' },
        { id: 'en-US-Wavenet-H', name: 'Wavenet H', gender: 'Female', tier: 'wavenet' },
        { id: 'en-US-Wavenet-I', name: 'Wavenet I', gender: 'Male', tier: 'wavenet' },
        { id: 'en-US-Wavenet-J', name: 'Wavenet J', gender: 'Male', tier: 'wavenet' },
        
        // Neural2 voices ($16/1M chars, 1M free/month) - Premium quality
        { id: 'en-US-Neural2-A', name: 'Neural2 A (Emma)', gender: 'Female', tier: 'neural2' },
        { id: 'en-US-Neural2-C', name: 'Neural2 C (Brian)', gender: 'Male', tier: 'neural2' },
        { id: 'en-US-Neural2-D', name: 'Neural2 D (Jenny)', gender: 'Female', tier: 'neural2' },
        { id: 'en-US-Neural2-E', name: 'Neural2 E (Davis)', gender: 'Male', tier: 'neural2' },
        { id: 'en-US-Neural2-F', name: 'Neural2 F (Clara)', gender: 'Female', tier: 'neural2' },
        { id: 'en-US-Neural2-G', name: 'Neural2 G (Jason)', gender: 'Male', tier: 'neural2' },
        { id: 'en-US-Neural2-H', name: 'Neural2 H (Tony)', gender: 'Male', tier: 'neural2' },
        { id: 'en-US-Neural2-I', name: 'Neural2 I (Nancy)', gender: 'Female', tier: 'neural2' },
        { id: 'en-US-Neural2-J', name: 'Neural2 J (Aaron)', gender: 'Male', tier: 'neural2' },
        
        // Studio voices ($160/1M chars, 1M free/month) - Highest quality
        { id: 'en-US-Studio-M', name: 'Studio M (Male)', gender: 'Male', tier: 'studio' },
        { id: 'en-US-Studio-O', name: 'Studio O (Female)', gender: 'Female', tier: 'studio' },
        { id: 'en-US-Studio-Q', name: 'Studio Q (Male)', gender: 'Male', tier: 'studio' }
    ],
    polly: [
        // Standard voices ($4/1M chars, 5M free/month for 12 months)
        { id: 'Joanna', name: 'Joanna', gender: 'Female', tier: 'standard' },
        { id: 'Matthew', name: 'Matthew', gender: 'Male', tier: 'standard' },
        { id: 'Amy', name: 'Amy', gender: 'Female', tier: 'standard' },
        { id: 'Brian', name: 'Brian', gender: 'Male', tier: 'standard' },
        { id: 'Joey', name: 'Joey', gender: 'Male', tier: 'standard' },
        { id: 'Justin', name: 'Justin', gender: 'Male', tier: 'standard' },
        { id: 'Kendra', name: 'Kendra', gender: 'Female', tier: 'standard' },
        { id: 'Kimberly', name: 'Kimberly', gender: 'Female', tier: 'standard' },
        { id: 'Salli', name: 'Salli', gender: 'Female', tier: 'standard' },
        { id: 'Kevin', name: 'Kevin', gender: 'Male', tier: 'standard' },
        { id: 'Ivy', name: 'Ivy (Standard)', gender: 'Female', tier: 'standard' },
        
        // Neural voices ($16/1M chars, 1M free/month for 12 months)
        { id: 'Joanna', name: 'Joanna (Neural)', gender: 'Female', tier: 'neural' },
        { id: 'Matthew', name: 'Matthew (Neural)', gender: 'Male', tier: 'neural' },
        { id: 'Amy', name: 'Amy (Neural)', gender: 'Female', tier: 'neural' },
        { id: 'Brian', name: 'Brian (Neural)', gender: 'Male', tier: 'neural' },
        { id: 'Olivia', name: 'Olivia', gender: 'Female', tier: 'neural' },
        { id: 'Aria', name: 'Aria', gender: 'Female', tier: 'neural' },
        { id: 'Ayanda', name: 'Ayanda', gender: 'Female', tier: 'neural' },
        { id: 'Ivy', name: 'Ivy (Neural)', gender: 'Female', tier: 'neural' },
        { id: 'Kendra', name: 'Kendra (Neural)', gender: 'Female', tier: 'neural' },
        { id: 'Kimberly', name: 'Kimberly (Neural)', gender: 'Female', tier: 'neural' },
        { id: 'Salli', name: 'Salli (Neural)', gender: 'Female', tier: 'neural' },
        { id: 'Joey', name: 'Joey (Neural)', gender: 'Male', tier: 'neural' },
        { id: 'Justin', name: 'Justin (Neural)', gender: 'Male', tier: 'neural' },
        { id: 'Kevin', name: 'Kevin (Neural)', gender: 'Male', tier: 'neural' },
        { id: 'Stephen', name: 'Stephen (Neural)', gender: 'Male', tier: 'neural' },
        
        // Long-form voices ($100/1M chars, 500K free/month for 12 months)
        { id: 'Danielle', name: 'Danielle', gender: 'Female', tier: 'long-form' },
        { id: 'Gregory', name: 'Gregory', gender: 'Male', tier: 'long-form' },
        
        // Generative voices ($30/1M chars, 100K free/month for 12 months)
        { id: 'Ruth', name: 'Ruth', gender: 'Female', tier: 'generative' },
        { id: 'Matthew', name: 'Matthew (Generative)', gender: 'Male', tier: 'generative' },
        { id: 'Stephen', name: 'Stephen (Generative)', gender: 'Male', tier: 'generative' }
    ],
    elevenlabs: [
        // ElevenLabs voices (10,000 chars free/month)
        // Premium AI voices with character-level alignment
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'Male', tier: 'neural' },
        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'Female', tier: 'neural' },
        { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'Male', tier: 'neural' },
        { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'Male', tier: 'neural' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'Female', tier: 'neural' },
        { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'Female', tier: 'neural' },
        { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', gender: 'Male', tier: 'neural' },
        { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'Male', tier: 'neural' },
        { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', gender: 'Male', tier: 'neural' },
        { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'Female', tier: 'neural' }
    ]
};

export const getVoicesForProvider = (provider: TtsProvider): Voice[] => {
    return VOICE_MAPPINGS[provider] || [];
};

export const getVoiceById = (provider: TtsProvider, voiceId: string): Voice | undefined => {
    return VOICE_MAPPINGS[provider]?.find(voice => voice.id === voiceId);
};

export const getVoiceTier = (provider: TtsProvider, voiceId: string): Voice['tier'] => {
    const voice = getVoiceById(provider, voiceId);
    return voice?.tier || 'standard';
};

export const getAllVoiceIds = (provider: TtsProvider): string[] => {
    return VOICE_MAPPINGS[provider]?.map(voice => voice.id) || [];
};

export const isValidVoiceForProvider = (provider: TtsProvider, voiceId: string): boolean => {
    const voiceIds = getAllVoiceIds(provider);
    return voiceIds.includes(voiceId);
};

export const getDefaultVoiceForProvider = (provider: TtsProvider): string => {
    switch (provider) {
        case 'polly':
            return 'Joanna';
        case 'elevenlabs':
            return 'pNInz6obpgDQGcFmaJgB'; // Adam voice
        case 'google':
        default:
            return 'en-US-Neural2-A'; // Emma voice
    }
}; 