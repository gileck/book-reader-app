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