import { BaseTtsAdapter } from './baseTtsAdapter';
import { GoogleTtsAdapter } from './googleTtsAdapter';
import { PollyTtsAdapter } from './pollyTtsAdapter';

export type TtsProvider = 'google' | 'polly';

export class TtsAdapterFactory {
    private static adapters: Map<TtsProvider, BaseTtsAdapter> = new Map();
    private static currentProvider: TtsProvider = 'google';

    static async getAdapter(provider?: TtsProvider): Promise<BaseTtsAdapter | null> {
        const targetProvider = provider || this.currentProvider;
        
        if (!this.adapters.has(targetProvider)) {
            const adapter = await this.createAdapter(targetProvider);
            if (adapter) {
                this.adapters.set(targetProvider, adapter);
            }
        }

        return this.adapters.get(targetProvider) || null;
    }

    static async createAdapter(provider: TtsProvider): Promise<BaseTtsAdapter | null> {
        switch (provider) {
            case 'google':
                return new GoogleTtsAdapter();
            case 'polly':
                return new PollyTtsAdapter();
            default:
                console.error(`Unknown TTS provider: ${provider}`);
                return null;
        }
    }

    static setProvider(provider: TtsProvider): void {
        this.currentProvider = provider;
    }

    static getProvider(): TtsProvider {
        return this.currentProvider;
    }

    static async getAvailableProviders(): Promise<TtsProvider[]> {
        const providers: TtsProvider[] = [];
        
        for (const provider of ['google', 'polly'] as TtsProvider[]) {
            const adapter = await this.createAdapter(provider);
            if (adapter && await adapter.isAvailable()) {
                providers.push(provider);
            }
        }
        
        return providers;
    }
} 