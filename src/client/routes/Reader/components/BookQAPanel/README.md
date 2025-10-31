# BookQAPanel Component Library

This library contains all components related to the Book QA (Question & Answer) functionality in the book reader application.

## Components

### Main Components

- **BookQAPanel**: Main container component that orchestrates the QA panel
- **BookQAChatSettings**: Settings dialog for configuring QA behavior

### UI Components

- **ChatContent**: Displays chat messages and empty state
- **ChatInput**: Input area with quick actions and controls
- **MessageBubble**: Individual message rendering with markdown support
- **PanelHeader**: Header toolbar with action buttons
- **TypingIndicator**: Loading indicator during AI responses

### Shared

- **types.ts**: TypeScript interfaces and types for all components
- **index.ts**: Main export file for the library

## Architecture

This library follows the container/presentation pattern:

- **Container Components**: Handle business logic, state management, and data fetching
  - `BookQAPanel`, `BookQAChatSettings`

- **Presentation Components**: Focus on UI rendering based on props
  - `ChatContent`, `ChatInput`, `MessageBubble`, `PanelHeader`, `TypingIndicator`

### Important: Shared Component Usage

**`ChatContent` is a SHARED component** used in multiple contexts:

1. **QA Chat Tab** (in `ReaderUI.tsx`) - Rendered directly as a full tab view
2. **BookQAPanel** - Floating panel mode (small popup window)
3. **BookQAPanel** - Fullscreen dialog mode (expanded view)

This means:
- Any changes to `ChatContent.tsx` will affect ALL three rendering contexts
- Bug fixes related to message display or scrolling should be made in `ChatContent.tsx`, not in the parent wrappers
- Always test changes in all three contexts to ensure consistent behavior

**Parent components are primarily wrappers** that:
- Provide layout and positioning
- Manage local UI state (e.g., question input)
- Pass props to the shared components
- Should NOT contain message rendering or scrolling logic

## Usage

```typescript
import { BookQAPanel, BookQAChatSettings } from './components/BookQAPanel';

// Use the main QA panel
<BookQAPanel 
  open={isOpen}
  messages={messages}
  onSubmitQuestion={handleQuestion}
  // ... other props
/>
```

## File Organization

```
BookQAPanel/
├── index.ts                 # Library exports
├── types.ts                 # Shared TypeScript types
├── BookQAPanel.tsx          # Main container component
├── BookQAChatSettings.tsx   # Settings dialog
├── ChatContent.tsx          # Message display component
├── ChatInput.tsx            # Input and controls component
├── MessageBubble.tsx        # Individual message component
├── PanelHeader.tsx          # Header toolbar component
├── TypingIndicator.tsx      # Loading indicator component
└── README.md               # This documentation
```

Each component is focused on a single responsibility and can be tested and developed independently. 