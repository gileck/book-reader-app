export interface Voice {
    id: string;
    name: string;
    gender: 'Male' | 'Female';
    tier: 'standard' | 'neural' | 'long-form' | 'generative';
}

export type TtsProvider = 'google' | 'polly' | 'elevenlabs';

export const VOICE_MAPPINGS: Record<TtsProvider, Voice[]> = {
    google: [
        // Google TTS Neural2 voices (all neural tier)
        { id: 'en-US-Neural2-A', name: 'Emma', gender: 'Female', tier: 'neural' },
        { id: 'en-US-Neural2-C', name: 'Brian', gender: 'Male', tier: 'neural' },
        { id: 'en-US-Neural2-D', name: 'Jenny', gender: 'Female', tier: 'neural' },
        { id: 'en-US-Neural2-E', name: 'Davis', gender: 'Male', tier: 'neural' },
        { id: 'en-US-Neural2-F', name: 'Clara', gender: 'Female', tier: 'neural' },
        { id: 'en-US-Neural2-G', name: 'Jason', gender: 'Male', tier: 'neural' },
        { id: 'en-US-Neural2-H', name: 'Tony', gender: 'Male', tier: 'neural' },
        { id: 'en-US-Neural2-I', name: 'Nancy', gender: 'Female', tier: 'neural' },
        { id: 'en-US-Neural2-J', name: 'Aaron', gender: 'Male', tier: 'neural' }
    ],
    polly: [
        // Standard voices ($4/1M chars, 5M free/month)
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
        { id: 'Stephen', name: 'Stephen', gender: 'Male', tier: 'standard' },
        // Neural voices ($16/1M chars, 1M free/month)
        { id: 'Emma', name: 'Emma', gender: 'Female', tier: 'neural' },
        { id: 'Olivia', name: 'Olivia', gender: 'Female', tier: 'neural' },
        { id: 'Aria', name: 'Aria', gender: 'Female', tier: 'neural' },
        { id: 'Ayanda', name: 'Ayanda', gender: 'Female', tier: 'neural' },
        { id: 'Ivy', name: 'Ivy', gender: 'Female', tier: 'neural' },
        // Long-form voices ($100/1M chars, 500K free/month)
        { id: 'Danielle', name: 'Danielle', gender: 'Female', tier: 'long-form' },
        { id: 'Gregory', name: 'Gregory', gender: 'Male', tier: 'long-form' },
        { id: 'Burrow', name: 'Burrow', gender: 'Male', tier: 'long-form' }
    ],
    elevenlabs: [
        // ElevenLabs voices (premium neural tier)
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'Male', tier: 'neural' },
        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'Female', tier: 'neural' },
        { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'Male', tier: 'neural' },
        { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'Male', tier: 'neural' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'Female', tier: 'neural' },
        { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'Female', tier: 'neural' },
        { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', gender: 'Male', tier: 'neural' }
    ]
};

export const getVoicesForProvider = (provider: TtsProvider): Voice[] => {
    return VOICE_MAPPINGS[provider] || [];
};

export const getVoiceById = (provider: TtsProvider, voiceId: string): Voice | undefined => {
    return VOICE_MAPPINGS[provider]?.find(voice => voice.id === voiceId);
};

export const getVoiceTier = (provider: TtsProvider, voiceId: string): 'standard' | 'neural' | 'long-form' | 'generative' => {
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