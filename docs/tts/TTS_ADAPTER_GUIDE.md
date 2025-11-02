# TTS Adapter System

The book reader app now supports multiple Text-to-Speech (TTS) providers through an adapter pattern. This allows easy switching between different TTS services while maintaining the same word highlighting features.

## Supported Providers

### Google Text-to-Speech
- **Provider ID**: `google`
- **Features**: High-quality neural voices with precise word timing
- **Requirements**: `GOOGLE_APPLICATION_CREDENTIALS` environment variable
- **Voices**: en-US-Neural2-A through en-US-Neural2-J

### Amazon Polly
- **Provider ID**: `polly`
- **Features**: Natural-sounding AI voices with speech marks
- **Requirements**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` environment variables
- **Voices**: Joanna, Matthew, Amy, Brian, Emma, Olivia, Aria, Ayanda, Ivy, Kendra, Kimberly, Salli, Joey, Justin, Kevin, Stephen

## Environment Setup

### Google TTS
```bash
# Base64 encoded Google Cloud service account key
GOOGLE_APPLICATION_CREDENTIALS=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50...
```

### Amazon Polly
```bash
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1  # Optional, defaults to us-east-1
```

## Usage

### Switching Providers via UI
1. Open the Speed Control Modal in the reader
2. In the "TTS Provider" section, select your preferred provider
3. The app will automatically switch and clear the audio cache
4. Voice options will update based on the selected provider

### Programmatic Usage
```typescript
import { setTtsProvider, getTtsProviders } from '@/apis/tts/client';

// Get available providers
const result = await getTtsProviders();
console.log(result.data?.providers); // ['google', 'polly']

// Switch to Amazon Polly
await setTtsProvider({ provider: 'polly' });
```

## Word Highlighting Implementation

Both adapters support word-level highlighting through different mechanisms:

### Google TTS
- Uses SSML `<mark>` tags to generate timing data
- Returns precise `timeSeconds` for each word
- CSS animations synchronized with audio playback

### Amazon Polly
- Uses Speech Marks with SSML support
- Two API calls: one for speech marks (timing), one for audio
- Same highlighting interface as Google TTS

## Architecture

### Base Adapter
```typescript
abstract class BaseTtsAdapter {
    abstract synthesizeSpeech(text: string, config: TTSConfig): Promise<TTSResult | null>;
    abstract getSupportedVoices(): Promise<string[]>;
    abstract isAvailable(): Promise<boolean>;
}
```

### Adapter Factory
The `TtsAdapterFactory` manages adapter instances and provider switching:
- Singleton pattern for adapter instances
- Automatic provider availability detection
- Graceful fallback to available providers

### Integration Points
- **API Layer**: `src/apis/tts/` - Client/server communication
- **Service Layer**: `src/server/tts/ttsService.ts` - Unified interface
- **UI Components**: `src/client/components/TtsProviderSelector.tsx` - Provider selection
- **Audio Playback**: `src/client/routes/Reader/hooks/useAudioPlayback.ts` - Word highlighting

## Adding New Providers

To add a new TTS provider:

1. Create a new adapter class extending `BaseTtsAdapter`
2. Implement the required methods
3. Add the provider to `TtsAdapterFactory`
4. Update the `TtsProvider` type
5. Add voice mappings in the UI components

Example:
```typescript
export class CustomTtsAdapter extends BaseTtsAdapter {
    name = 'custom';
    
    async synthesizeSpeech(text: string, config: TTSConfig): Promise<TTSResult | null> {
        // Implementation here
    }
    
    async getSupportedVoices(): Promise<string[]> {
        return ['voice1', 'voice2'];
    }
    
    async isAvailable(): Promise<boolean> {
        return true; // Check if service is configured
    }
}
```

## Benefits

1. **Flexibility**: Easy switching between TTS providers
2. **Consistency**: Same word highlighting features across providers
3. **Extensibility**: Simple to add new providers
4. **Reliability**: Graceful fallback when providers are unavailable
5. **Performance**: Provider instances are cached and reused

## Troubleshooting

### Provider Not Available
- Check environment variables are set correctly
- Verify API credentials have proper permissions
- Check network connectivity to TTS services

### Word Highlighting Issues
- Ensure the adapter returns proper timepoint data
- Check that SSML marks are properly formatted
- Verify CSS animations are being generated correctly

### Audio Quality Issues
- Try different voices within the same provider
- Adjust playback speed and word timing offset
- Check if the provider supports the requested audio format 