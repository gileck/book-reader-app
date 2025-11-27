export interface TTSTimepoint {
    markName: string;
    timeSeconds: number;
}

export interface TTSResult {
    audioContent: string; // base64 encoded audio
    timepoints: TTSTimepoint[];
}

export interface TTSConfig {
    voiceId: string;
    languageCode?: string;
    speakingRate?: number;
    pitch?: number;
    volumeGainDb?: number;
    voiceTier?: 'standard' | 'wavenet' | 'neural' | 'neural2' | 'polyglot' | 'studio' | 'chirp3-hd' | 'long-form' | 'generative' | 'gemini-flash' | 'gemini-pro' | 'gemini-flash-lite';
}

export abstract class BaseTtsAdapter {
    abstract name: string;
    
    abstract synthesizeSpeech(
        text: string,
        config: TTSConfig
    ): Promise<TTSResult | null>;
    
    abstract getSupportedVoices(): Promise<string[]>;
    
    abstract isAvailable(): Promise<boolean>;
    
    protected generateSSMLWithMarks(text: string): string {
        const words = text.split(' ').filter(word => word.length > 0);
        let ssml = '<speak>';

        words.forEach((word, index) => {
            ssml += ` <mark name="${word}-${index}"/> ${word}`;
        });

        ssml += '</speak>';
        return ssml;
    }

    /**
     * Generate plain SSML without mark tags.
     * Used for voices that don't support SSML marks (e.g., Google Studio, AWS Polly Generative).
     */
    protected generatePlainSSML(text: string): string {
        return `<speak>${text}</speak>`;
    }
} 