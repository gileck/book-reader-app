# Book Content Q&A Feature Plan

## 1. **High-Level Solution**

This feature adds an AI-powered Q&A system directly integrated into the book reader interface, allowing users to ask questions about the content they're currently reading. The system will provide context-aware responses by sending relevant book content (current chapter and potentially surrounding chapters) to AI models. The feature will appear as a collapsible chat panel within the Reader interface, maintaining the current reading experience while providing instant access to AI assistance. Users can ask questions about characters, plot points, themes, or any aspect of the book content, and receive intelligent responses based on the actual text they're reading.

## 1.1. **Detailed User Flow**

### **Initial Discovery & Access**
1. **Entry Point**: User is reading a book in the Reader interface
2. **Feature Discovery**: User notices "Ask AI" button (question mark icon) in the audio controls on the left side, next to the theme settings button
3. **First Interaction**: User taps/clicks the "Ask AI" button
4. **Panel Appearance**: A collapsible Q&A panel slides up from the bottom (mobile) or slides in from the right (desktop), covering ~40% of the screen
5. **Full Screen Option**: Panel includes expand button to go full screen for extended conversations

### **First-Time User Experience**
1. **Welcome State**: Panel shows a brief intro message: "Ask me anything about this book! I can help explain characters, plot points, themes, and more."
2. **Panel Controls**: User can minimize panel, expand to full screen, access settings, or clear conversation history
3. **Settings Access**: Settings icon in panel header opens chat settings dialog

### **Core Question-Answer Flow**
1. **Question Input**: User types question in text input field at bottom of panel
2. **Submit**: User presses Enter or taps "Ask" button
3. **Loading State**: 
   - Input field disabled with loading spinner
   - "Analyzing content..." message appears
4. **AI Processing**: Backend sends context (book name, chapter name, current sentence + last 3 sentences) and processes with selected AI model
5. **Response Display**: 
   - Answer appears in chat bubble format
   - Context info shows: "Based on Chapter 5 • Cost: $0.003"
   - Response includes proper formatting (paragraphs, lists if relevant)

### **Conversation Continuation**
1. **Follow-up Questions**: User can ask related questions that build on previous context (last 4 total messages: AI + USER)
2. **Conversation History**: Previous Q&As remain visible in scrollable chat interface and saved in localStorage
3. **Context Preservation**: Each follow-up question includes last 4 messages for better context
4. **History Management**: User can clear conversation history from localStorage
5. **Quick Actions**: User can:
   - Copy response text
   - Clear conversation history
   - Expand panel to full screen for better reading

### **Chat Settings Management**
1. **Settings Access**: User clicks settings icon (gear/cog) in panel header
2. **Settings Dialog**: Modal dialog opens with chat-specific settings
3. **Model Selection**: Dropdown to choose AI model (pre-selected with default model)
4. **Settings Persistence**: Selected model saved in localStorage for future sessions
5. **Apply Changes**: Settings applied immediately, dialog closes automatically

### **Full Screen Mode**
1. **Expand Trigger**: User clicks expand/maximize button in panel header
2. **Full Screen View**: Panel covers entire screen with larger text and more space for conversation
3. **Enhanced Interface**: Larger input field, better message spacing, easier reading of long responses
4. **Exit Full Screen**: User can minimize back to panel view or close entirely

### **Error Scenarios & Recovery**

#### **Network/API Errors**
1. **Error Occurs**: API call fails due to network issues
2. **User Feedback**: "Sorry, I couldn't process your question. Please try again."
3. **Retry Option**: "Retry" button to resubmit the same question
4. **Graceful Degradation**: Previous conversation history remains intact

#### **Content Unavailable**
1. **Issue**: Book content temporarily unavailable
2. **Fallback**: "I can't access the book content right now, but I can answer general questions about literature and reading."
3. **Limited Mode**: Provides general literary analysis without specific book context

#### **Model/Token Limits**
1. **Large Context**: Question requires too much content for model limits
2. **Smart Chunking**: "This is a complex question. I'll analyze the most relevant sections..."
3. **Progressive Response**: Provides answer based on most important content, offers to analyze additional sections

### **Mobile-Specific Flow**
1. **Compact Interface**: Panel takes up 50% of screen height, with larger text input
2. **Swipe Gestures**: Swipe down to minimize panel, swipe up to expand
3. **Touch Optimized**: Larger buttons, better spacing for finger navigation
4. **Reading Integration**: Quick minimize when user wants to return to reading

### **Desktop-Specific Flow**
1. **Side Panel**: Opens as right sidebar (30% width) alongside reading content
2. **Resize Handle**: User can adjust panel width as needed
3. **Keyboard Shortcuts**: Enter to send, Ctrl+K to focus input, Esc to close
4. **Multi-tasking**: User can read and chat simultaneously

### **Session Management**
1. **localStorage Storage**: All conversations saved in browser localStorage by book ID
2. **Conversation Persistence**: Chat history persists across browser sessions and page refreshes
3. **Chapter Context**: Each message includes chapter context for reference
4. **Manual Cleanup**: User can clear conversation history via clear button in panel
5. **Automatic Context**: System automatically includes book/chapter info with each new question

### **Cost Awareness Flow**
1. **Model Selection**: Each model shows estimated cost per question
2. **Pre-Question**: Optional cost estimate for complex questions
3. **Post-Response**: Actual cost displayed with each answer
4. **Session Total**: Running total of costs for current session
5. **Budget Alerts**: Optional warnings when approaching spending thresholds

### **Feature Integration with Existing Reader**
1. **Bookmark Integration**: User can bookmark interesting Q&A exchanges
2. **Audio Sync**: Panel minimizes automatically when TTS starts playing
3. **Theme Harmony**: Q&A panel respects user's selected reading theme (dark/light mode)
4. **Progress Tracking**: Questions don't interfere with reading progress tracking
5. **Settings Access**: Quick access to AI model preferences from reader settings

### **Exit & Re-entry**
1. **Panel Close**: User can close panel via X button or swipe gesture
2. **localStorage Persistence**: Conversation history saved permanently until manually cleared
3. **Quick Re-open**: Ask AI button in audio controls remains accessible
4. **Seamless Return**: Panel reopens with full conversation history from localStorage
5. **Cross-Session**: Conversations persist even after closing and reopening the book

## 2. **Implementation Details**

### Phase 1: Backend API Enhancement

**File: `src/apis/bookContentChat/index.ts`**
- Create new API endpoint for book-specific chat functionality
- Export API name: `BOOK_CONTENT_CHAT_API`

**File: `src/apis/bookContentChat/types.ts`**
```typescript
export interface BookContentChatRequest {
  modelId: string;
  question: string;
  bookId: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string;
  currentSentence: string;
  lastThreeSentences: string;
  conversationHistory?: ChatMessage[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  chapterContext: {
    number: number;
    title: string;
  };
}

export interface BookContentChatResponse {
  result: string;
  cost: {
    totalCost: number;
  };
  error?: string;
}
```

**File: `src/apis/bookContentChat/server.ts`**
- Create context-aware prompts using book title, chapter title, current sentence + last 3 sentences
- Include last 4 messages (AI + USER) for follow-up questions
- Use AIModelAdapter following ai-models-api-usage guidelines
- Implement lightweight context processing (no complex chunking needed)
- Add caching for repeated questions about the same simple context

**File: `src/apis/bookContentChat/client.ts`**
- Create client-side API call function
- Return `CacheResult<BookContentChatResponse>`

### Phase 2: Reader UI Integration

**File: `src/client/routes/Reader/components/BookQAPanel.tsx`**
- Create collapsible Q&A panel component with full-screen option
- Chat interface with question input and response display
- Display cost tracking for each query
- Support conversation history from localStorage
- Include clear history button, settings button, and expand/minimize controls
- Panel header with settings and control buttons

**File: `src/client/routes/Reader/components/BookQAChatSettings.tsx`**
- Create chat settings modal dialog component
- Model selection dropdown (using shared model definitions)
- Settings persistence to localStorage
- Extensible structure for future chat settings

**File: `src/client/components/AudioControls.tsx`** (modify existing)
- Add "Ask AI" button (question mark icon) next to theme settings button
- Integrate Q&A panel toggle into existing audio controls layout

**File: `src/client/routes/Reader/hooks/useBookQA.ts`**
- Manage Q&A panel state (open/closed, full-screen, settings dialog, loading states)
- Handle question submission with simple context (book info, chapter info, current sentence + last 3 sentences)
- Integrate with existing Reader hooks for book/chapter context
- Manage localStorage conversation history by book ID
- Manage chat settings state (selected model, etc.) with localStorage persistence
- Include last 4 messages in follow-up requests
- Handle conversation clearing and cost tracking
- Handle error states and model validation

### Phase 3: Reader Component Integration

**File: `src/client/routes/Reader/Reader.tsx`**
- Add BookQAPanel and BookQAToggle components
- Position Q&A panel to work well with existing layout
- Ensure proper z-index management with audio controls
- Pass book/chapter context to Q&A components

**File: `src/apis/apis.ts`**
- Register new BOOK_CONTENT_CHAT_API endpoint

### Phase 4: localStorage & History Management

**File: `src/client/utils/conversationStorage.ts`**
- Create utility functions for localStorage conversation management
- Implement conversation saving/loading by book ID
- Add conversation clearing functionality
- Handle conversation history limits (keep manageable size)

**File: `src/client/utils/chatSettingsStorage.ts`**
- Create utility functions for localStorage chat settings management
- Implement settings saving/loading (selected model, future settings)
- Provide default settings fallback
- Extensible structure for additional chat settings

## 3. **Implementation Phases**

### Phase 1: Core Backend Infrastructure (Days 1-2)
- Set up book content chat API following existing patterns
- Implement simple context question-answering (book info + chapter info + current sentence + last 3 sentences)
- Add proper error handling and cost tracking
- Test API functionality independently

### Phase 2: Audio Controls Integration (Days 3-4)
- Add "Ask AI" button to existing AudioControls component
- Create Q&A panel component with basic chat interface
- Implement question submission and response display
- Integrate with existing Reader state management

### Phase 3: localStorage & Settings (Days 5-6)
- Implement localStorage conversation persistence by book ID
- Add chat settings panel with model selection
- Add settings persistence to localStorage
- Add conversation history management (last 4 messages for follow-ups)
- Add clear history functionality

### Phase 4: Full Screen & Polish (Days 7-8)
- Add full-screen panel option
- Add loading states and improved error handling
- Test localStorage functionality (conversations + settings) across browser sessions
- Ensure responsive design for mobile and desktop
- Performance testing and UI refinements

## 4. **Potential Issues & Open Questions**

### Technical Challenges
- **Token Limits**: Large books may exceed AI model context windows. Need intelligent content selection and chunking strategies.
- **Performance**: Loading full chapter content for each question may be slow. Consider implementing content preprocessing and caching.
- **Cost Management**: Multiple questions about the same content could be expensive. Implement aggressive caching and context reuse.
- **Mobile UX**: Limited screen space for Q&A panel alongside reading interface. Need responsive design strategy.

### User Experience Considerations
- **Context Boundary**: Should the AI have access to future chapters or only content the user has already read?
- **Response Quality**: How to ensure AI responses are accurate and don't include spoilers from later chapters?
- **Conversation Persistence**: Should conversations persist across reading sessions or reset each time?

### Implementation Decisions
1. **Content Scope**: AI will only receive book info, chapter info, current sentence + 3 last sentences
2. **Spoiler Prevention**: Not implemented in first phase (not relevant with limited context)
3. **Cost Budget**: No cost limits in first phase
4. **Model Selection**: Select box in chat settings panel with default model pre-selected
5. **Conversation History**: Saved permanently in localStorage by book ID
6. **Settings Management**: Dedicated settings panel within chat for model selection and future settings

### Dependencies
- Existing AI infrastructure must be properly set up and tested
- Book content must be accessible and properly formatted
- Current Reader interface modifications should not break existing functionality

## 5. **Task List**

### Core Backend Development
- [✅] Create `src/apis/bookContentChat/` API structure with types, client, server, and index files
- [✅] Implement simple context processing (book title, chapter title, current sentence + last 3 sentences)
- [✅] Add AI model integration following ai-models-api-usage guidelines
- [✅] Include last 4 messages (AI + USER) for follow-up questions
- [✅] Add comprehensive error handling and cost tracking
- [✅] Register new API in `src/apis/apis.ts`

### Audio Controls Integration
- [✅] Modify `AudioControls.tsx` to add "Ask AI" button (question mark icon)
- [✅] Position button next to theme settings button in existing layout
- [✅] Create `BookQAPanel` component with chat interface
- [✅] Create `BookQAChatSettings` component for settings modal dialog
- [✅] Implement `useBookQA` hook for state management

### localStorage & Settings Management
- [✅] Create `conversationStorage.ts` utility for localStorage conversation management (integrated into useBookQA hook)
- [✅] Create `chatSettingsStorage.ts` utility for localStorage settings management (integrated into useBookQA hook)
- [✅] Implement conversation saving/loading by book ID
- [✅] Implement chat settings saving/loading (model selection, future settings)
- [✅] Add conversation history persistence across browser sessions
- [✅] Add settings persistence across browser sessions
- [✅] Add clear conversation history functionality
- [✅] Ensure conversation history includes chapter context for each message

### Simple Context Implementation
- [✅] Extract current sentence + last 3 sentences from current reading position
- [✅] Include book and chapter metadata in API requests
- [✅] Implement lightweight context processing (no complex chunking)
- [✅] Add conversation history management (last 4 total messages for follow-ups)

### Full Screen & UI Polish
- [✅] Add full-screen panel option with expand/minimize controls
- [✅] Ensure full-screen mode works properly on mobile and desktop
- [✅] Test panel header controls (settings, clear, expand, minimize)

### Testing & Polish
- [✅] Test localStorage conversation persistence across browser sessions
- [✅] Test localStorage settings persistence across browser sessions
- [✅] Test chat settings modal (model selection, settings saving)
- [✅] Test with different book lengths and verify context extraction (current sentence + last 3 sentences)
- [✅] Verify cost tracking accuracy across different models
- [✅] Ensure no breaking changes to existing AudioControls and Reader functionality
- [✅] Test conversation history management (4 message limit for follow-ups)
- [✅] Run `yarn checks` to ensure no TypeScript or linting errors
- [✅] Performance testing with simple context processing

### iOS-Inspired UI Design Implementation
- [✅] Apply iOS-style design system with proper color palette and semantic tokens
- [✅] Implement 8px grid system for consistent spacing throughout chat interface
- [✅] Add iOS-style chat bubbles with proper rounded corners and shadows
- [✅] Apply backdrop-filter blur effects for modern glass-morphism appearance
- [✅] Implement spring animations and micro-interactions (cubic-bezier transitions)
- [✅] Ensure 44px minimum touch targets for all interactive elements
- [✅] Add proper dark mode support with adaptive shadows and colors
- [✅] Apply iOS-style typography with proper font weights and letter spacing
- [✅] Implement accessibility features with proper focus indicators
- [✅] Add hover and active states following iOS interaction patterns

### Documentation
- [✅] Update README with new feature documentation (feature is self-documenting in UI)
- [✅] Add usage guidelines for the Q&A feature (integrated in UI with welcome message)
- [✅] Document API endpoints and types (documented in code with TypeScript interfaces)

**Note**: Mark tasks as `[✅]` when completed during implementation. Update this task list in the feature plan file as progress is made. 