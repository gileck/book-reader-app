# Text Translation Feature Plan

## 1. **High-Level Solution**

This feature adds AI-powered text translation directly integrated into the book reader interface, allowing users to translate selected text or the current sentence being read. The system will leverage existing AI models to provide high-quality translations in multiple languages. Users can select text with mouse/touch, trigger translation via context menu or floating button, and view translations in an elegant tooltip or modal interface. The feature maintains the current reading experience while providing instant access to translations, making foreign language books more accessible to readers.

The core strategy involves implementing text selection handlers that work seamlessly with the existing Reader interface, adding translation API endpoints that use the current AI model infrastructure, and creating intuitive UI components for displaying translations. The user flow centers around natural text selection gestures (click-drag, long-press) followed by instant translation delivery through floating tooltips or modals, with comprehensive language preference management and translation history.

## 1.1. **Detailed User Flow**

### **Initial Discovery & Access**
1. **Entry Point**: User is reading a book in the Reader interface with foreign text
2. **Text Selection Method 1**: User selects text by dragging mouse or long-pressing on mobile
3. **Text Selection Method 2**: User double-clicks on a sentence to translate current sentence
4. **Translation Trigger**: Small floating translate button appears near selected text, or context menu shows translate option
5. **Quick Access**: Optional translate button in audio controls for current sentence translation

### **Text Selection & Translation Flow**

#### **Method 1: Selected Text Translation**
1. **Text Selection**: User drags to select text (desktop) or long-presses and drags (mobile)
2. **Selection UI**: Selected text is highlighted with translation-specific styling
3. **Translate Button**: Small floating button with language icon appears near selection
4. **Button Interaction**: User clicks/taps the translate button
5. **Loading State**: Button shows loading spinner, text selection remains highlighted
6. **Translation Display**: Tooltip or modal appears with translated text
7. **Original Text Reference**: Translation includes reference to original text for context

#### **Method 2: Current Sentence Translation**
1. **Quick Access**: User clicks dedicated translate button in audio controls
2. **Auto Selection**: Current sentence (based on audio playback position) is automatically selected
3. **Instant Translation**: Translation request sent immediately without additional confirmation
4. **Display**: Translation appears in floating panel near current reading position
5. **Audio Integration**: Translation doesn't interfere with audio playback

#### **Method 3: Word-Level Translation**
1. **Double-Click/Tap**: User double-clicks on a specific word (desktop) or double-taps (mobile)
2. **Word Highlight**: Single word is highlighted with translation styling
3. **Quick Translation**: Immediate translation request for single word
4. **Tooltip Display**: Small tooltip appears directly above the word with translation
5. **Context Preservation**: Word translation includes basic context from surrounding sentence

### **Translation Settings & Languages**

#### **First-Time Setup**
1. **Auto-Detection**: System attempts to detect book language from metadata
2. **Target Language Selection**: User prompted to select preferred target language
3. **Settings Persistence**: Language preferences saved to localStorage
4. **Default Behavior**: English set as default target language if detection fails

#### **Language Management**
1. **Settings Access**: Translation settings available in Reader settings modal
2. **Source Language**: Auto-detect or manual selection of book's language
3. **Target Language**: Dropdown with popular languages (English, Spanish, French, German, etc.)
4. **Model Selection**: Choose AI model for translation (different models for different language pairs)
5. **Quality Settings**: Options for translation speed vs quality trade-offs

### **Translation Display & Interaction**

#### **Tooltip Mode (Default)**
1. **Positioning**: Tooltip appears above selected text, automatically positioned to stay in viewport
2. **Content Display**: Translated text with source language indicator
3. **Actions**: Copy translation, hear pronunciation (future), close tooltip
4. **Auto-Dismiss**: Tooltip closes when user clicks elsewhere or selects new text
5. **Multiple Selections**: New translation replaces previous tooltip

#### **Modal Mode (Long Text)**
1. **Trigger**: Automatically used for text selections longer than 100 characters
2. **Full Screen Option**: Modal can expand to full screen for very long translations
3. **Comparison View**: Side-by-side display of original and translated text
4. **Text Formatting**: Proper paragraph breaks and formatting preserved
5. **Actions**: Copy translation, bookmark translation, share translation

#### **History & Bookmarking**
1. **Translation History**: Recent translations saved in localStorage
2. **Bookmark Translations**: Users can save important translations
3. **History Access**: View translation history in Reader settings
4. **Search History**: Find previous translations by original text or translation
5. **Export Options**: Export saved translations as text file

### **Cost Management & Efficiency**

#### **Smart Caching**
1. **Translation Cache**: Identical text translations cached locally
2. **Intelligent Chunking**: Large text broken into semantic chunks for better caching
3. **Language Pair Optimization**: Different caching strategies for different language pairs
4. **Cache Expiry**: Translations cached for 30 days, then refreshed

#### **Cost Awareness**
1. **Cost Display**: Estimated cost shown before translation (for large selections)
2. **Batch Processing**: Multiple small selections combined into single API call
3. **Free Tier**: First 1000 characters per day free, then show costs
4. **Budget Warnings**: Optional spending limits and warnings

### **Mobile-Specific Enhancements**
1. **Touch Optimization**: Long-press to select, double-tap for quick word translation
2. **Gesture Support**: Swipe gestures for dismissing translations
3. **Haptic Feedback**: Subtle vibration feedback for translation actions
4. **Floating UI**: Translation UI adapts to on-screen keyboard and mobile constraints
5. **Accessibility**: VoiceOver/TalkBack support for translation content

### **Desktop-Specific Features**
1. **Keyboard Shortcuts**: Ctrl+T for quick translation of selected text
2. **Context Menu**: Right-click context menu with "Translate" option
3. **Multiple Monitors**: Translation modals properly handle multi-monitor setups
4. **Cursor States**: Visual feedback for translatable text and selection states
5. **Window Management**: Translation windows remember position and size preferences

### **Error Handling & Offline Support**

#### **Network Issues**
1. **Offline Detection**: Detect when user is offline
2. **Cache Fallback**: Show previously translated text if available in cache
3. **Retry Logic**: Automatic retry with exponential backoff for failed requests
4. **User Feedback**: Clear error messages with retry options

#### **Language Detection Failures**
1. **Manual Override**: Allow users to manually specify source language
2. **Multiple Attempts**: Try different detection methods if first attempt fails
3. **Fallback Strategy**: Default to English-to-User's-Language if detection fails completely
4. **Learning System**: Remember user corrections to improve future detection

### **Integration with Existing Features**

#### **Audio Playback Integration**
1. **Sync Preservation**: Translation doesn't interrupt audio playback
2. **Current Position**: Translation button uses current audio position for context
3. **TTS Integration**: Future feature to speak translations using TTS system
4. **Timing Awareness**: Translations timed to not interfere with word highlighting

#### **Reading Progress**
1. **Non-Intrusive**: Translation activity doesn't affect reading progress tracking
2. **Context Preservation**: Translations maintain chapter and position context
3. **Bookmark Integration**: Translated text can be bookmarked with translation included
4. **Note Taking**: Future integration with note-taking features

#### **Theme Integration**
1. **Theme Consistency**: Translation UI follows user's selected reading theme
2. **Color Harmony**: Translation highlighting uses theme-appropriate colors
3. **Dark Mode**: Full dark mode support for all translation UI elements
4. **Font Matching**: Translation text uses same font family as reading interface

## 2. **Implementation Details**

### Backend Translation API Structure

**File: `src/apis/textTranslation/index.ts`**
- Export API name: `TEXT_TRANSLATION_API`

**File: `src/apis/textTranslation/types.ts`**
```typescript
export interface TextTranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  modelId: string;
  context?: string;
}

export interface TextTranslationResponse {
  translatedText: string;
  detectedSourceLanguage: string;
  confidence: number;
  cost: { totalCost: number };
  error?: string;
}
```

**File: `src/apis/textTranslation/server.ts`**
- Implement translation using AIModelAdapter
- Add language detection using AI models
- Implement caching for cost reduction

**File: `src/apis/textTranslation/client.ts`**
- Create client-side API call function
- Return `CacheResult<TextTranslationResponse>`

### UI Components

**File: `src/client/routes/Reader/components/TextSelectionHandler.tsx`**
- Handle text selection events (mouse drag, touch)
- Manage selection state and highlighting
- Coordinate with existing Reader text handling

**File: `src/client/routes/Reader/components/TranslationTooltip.tsx`**
- Floating tooltip for translation display
- Smart positioning logic
- Copy translation functionality

**File: `src/client/routes/Reader/components/TranslationButton.tsx`**
- Floating translate button near selections
- Language icon and loading states

**File: `src/client/routes/Reader/hooks/useTextTranslation.ts`**
- Manage translation state and operations
- Handle text selection and translation triggering
- Integrate with existing Reader hooks

### Reader Integration

**File: `src/client/components/AudioControls.tsx`** (modify)
- Add translate button for current sentence

**File: `src/client/routes/Reader/Reader.tsx`** (modify)
- Add translation components to layout
- Ensure proper z-index management

**File: `src/apis/apis.ts`** (modify)
- Register TEXT_TRANSLATION_API endpoint

## 3. **Implementation Phases**

### Phase 1: Core Translation Backend (Days 1-2)
- Set up translation API following existing patterns
- Implement AI-powered translation using existing model adapter
- Add language detection and text preprocessing
- Test translation quality and basic caching

### Phase 2: Text Selection & Basic UI (Days 3-4)
- Implement text selection handling in Reader
- Create floating translate button component
- Create basic tooltip for translation display
- Add translate button to audio controls

### Phase 3: Advanced UI & Settings (Days 5-6)
- Create translation modal for long text
- Implement translation settings panel
- Add translation history management
- Implement localStorage persistence

### Phase 4: Polish & Integration (Days 7-8)
- Optimize caching and performance
- Add cost management and user feedback
- Implement error handling and offline support
- Ensure responsive design and accessibility

## 4. **Potential Issues & Open Questions**

### Technical Challenges
- Text selection complexity across different browsers and devices
- Translation quality for literary text maintaining style and meaning
- Performance with large text selections requiring chunking
- Language detection accuracy for mixed-language content
- Cost management as translation usage can accumulate quickly

### Implementation Decisions
1. Use existing AI models rather than dedicated translation APIs
2. Aggressive localStorage caching to minimize costs
3. Start with popular languages, expand based on usage
4. Tooltip for short text, modal for long text
5. Support both text selection and current sentence translation

## 5. **Task List**

### Core Backend Development
- [ ] Create `src/apis/textTranslation/` API structure with types, client, server, and index files
- [ ] Implement AI-powered translation using existing model adapter system
- [ ] Add language detection logic using AI models
- [ ] Implement text chunking for large selections
- [ ] Add translation caching layer
- [ ] Add comprehensive error handling and cost tracking
- [ ] Register new API in `src/apis/apis.ts`

### Text Selection & Basic UI
- [ ] Create `TextSelectionHandler.tsx` component for selection management
- [ ] Implement text selection event handling in `ReaderContent.tsx`
- [ ] Create `TranslationButton.tsx` floating button component
- [ ] Create `TranslationTooltip.tsx` for translation display
- [ ] Add translate button to `AudioControls.tsx` for current sentence
- [ ] Test text selection across browsers and devices

### Translation UI Components
- [ ] Create `TranslationModal.tsx` for long text translations
- [ ] Implement smart positioning logic for translation UI
- [ ] Add copy translation functionality
- [ ] Implement side-by-side comparison view
- [ ] Add loading states and error handling to UI components
- [ ] Ensure accessibility support for all translation UI

### Settings & History Management
- [ ] Create `TranslationSettings.tsx` settings panel component
- [ ] Create `translationStorage.ts` utility for localStorage management
- [ ] Implement translation history persistence
- [ ] Add language preferences management
- [ ] Implement translation caching logic
- [ ] Create `useTextTranslation.ts` hook for state management

### Reader Integration
- [ ] Modify `Reader.tsx` to include translation components
- [ ] Ensure proper z-index management with existing modals
- [ ] Test integration with existing audio and bookmark features
- [ ] Verify compatibility with theme system
- [ ] Test responsive design on mobile and desktop

### Testing & Polish
- [ ] Test translation quality across different language pairs
- [ ] Performance test with large text selections
- [ ] Test localStorage persistence across browser sessions
- [ ] Verify cost tracking accuracy
- [ ] Test error handling for network failures and API errors
- [ ] Ensure no breaking changes to existing Reader functionality
- [ ] Run `yarn checks` to ensure no TypeScript or linting errors

**Note**: Mark tasks as `[✅]` when completed during implementation. Update this task list as progress is made to track overall progress and ensure nothing is missed.

This feature will significantly enhance the reading experience for users engaging with foreign language content, making the book reader more inclusive and accessible to a global audience. 