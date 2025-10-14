# Theme Customization System

This document explains how users can customize their reading experience through the theme system in the Reader application.

## Overview

The theme customization system allows users to personalize their reading experience by adjusting colors, typography, and visual appearance. **All customizations are scoped to the book content within the Reader only** - they do not affect other parts of the application like the ThemeModal itself, navigation, or other UI components.

All customizations work in both **Full Reading Mode** and **Focus Reading Mode**, providing a consistent experience across both modes.

All customizations are managed through the **ThemeModal** component and are automatically saved to the user's preferences.

## Important: Scoped Theming

🎯 **Key Principle**: Theme customizations only apply to the book content area within the Reader. This ensures:
- The reading experience is fully customizable
- The app's UI remains consistent and usable
- Settings don't interfere with other components

## How It Works

### 1. User Interface
- **Access**: Users can open the theme modal via the settings button in the Reader
- **Component**: `src/client/components/ThemeModal.tsx`
- **Real-time preview**: Changes are applied immediately with a live preview

### 2. Data Flow

#### Full Reading Mode
```
ThemeModal → useUserSettings → ReaderContent → CSS Variables → Book Content
```

#### Focus Reading Mode
```
ThemeModal → useUserSettings → FocusReader → Direct Style Props → Book Content
```

**Process**:
1. User changes setting in `ThemeModal`
2. `onXXXChange` callback is triggered
3. `useUserSettings` hook updates state
4. Updated settings are passed to `ReaderContent` or `FocusReader` component
5. **Full mode**: CSS variables are set locally on the reader content container
6. **Focus mode**: Theme properties are applied directly via Material-UI `sx` props
7. Book content components consume styling
8. Settings are saved to backend storage

### 3. CSS Variables System
CSS variables are set immediately when users make changes, ensuring instant visual feedback. **Crucially, these variables are scoped to the reader content container only, not applied globally.**

**Location**: `src/client/routes/Reader/components/ReaderContent.tsx`

## Customizable Properties

### 1. Theme Mode
**Property**: `currentTheme`
**Type**: `'light' | 'dark'`
**Default**: `'light'`

**What it does**: Switches between light and dark mode for the entire application.

**Implementation**:
- Controlled by Material-UI theme provider
- Affects background colors, text colors, and component styling
- Auto-adjusts sentence highlight colors for better contrast

**Where it's used**:
- `src/client/components/UserThemeProvider.tsx` - Material-UI theme configuration
- Global application styling

### 2. Word Highlight Color
**Property**: `currentHighlightColor`
**Type**: `string` (hex color)
**Default**: `'#ffeb3b'` (yellow)
**CSS Variable**: `--word-highlight-color`

**What it does**: Sets the background color for the currently playing word during audio playback.

**Implementation**:
```typescript
// Set in ReaderContent.tsx - scoped to reader content only
container.style.setProperty('--word-highlight-color', highlightColor);
```

**Where it's consumed**:
```css
/* src/client/styles/globals.css */
.highlight-word {
  background-color: var(--word-highlight-color, transparent);
  color: inherit;
  border-radius: 3px;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}
```

**Usage**: Applied to individual words in `src/client/routes/Reader/components/EnhancedText.tsx` via the `highlight-word` CSS class.

### 3. Sentence Highlight Color
**Property**: `currentSentenceHighlightColor`
**Type**: `string` (hex color)
**Default**: `'#e3f2fd'` (light blue) for light mode, `'#1a237e'` (dark blue) for dark mode
**CSS Variable**: `--sentence-highlight-color`

**What it does**: Sets the background color for the entire text chunk that contains the currently playing sentence.

**Implementation**:
```typescript
// Set in ReaderContent.tsx - scoped to reader content only
container.style.setProperty('--sentence-highlight-color', sentenceHighlightColor);
```

**Where it's consumed**:
```typescript
// src/client/routes/Reader/components/chunks/TextChunk.tsx
backgroundColor: currentChunkIndex === chunkIndex ? 'var(--sentence-highlight-color, transparent)' : 'transparent'
```

**Auto-adjustment**: When switching themes, the sentence highlight color automatically adjusts for better contrast.

### 4. Font Size
**Property**: `currentFontSize`
**Type**: `number` (multiplier)
**Range**: `0.8` to `1.5`
**Default**: `1.0`
**CSS Variable**: `--reader-font-size`

**What it does**: Scales the font size of reading content.

**Implementation**:
```typescript
// Set in ReaderContent.tsx - scoped to reader content only
container.style.setProperty('--reader-font-size', `${fontSize}rem`);
```

**Where it's consumed**:
```typescript
// src/client/routes/Reader/components/chunks/TextChunk.tsx (full mode)
fontSize: 'var(--reader-font-size, 1rem)'

// src/client/routes/Reader/FocusReader.tsx (focus mode)
fontSize: `${fontSize}rem` // Base container
fontSize: `${fontSize * 1.5}rem` // Main sentence (scaled for emphasis)
```

### 5. Line Height
**Property**: `currentLineHeight`
**Type**: `number`
**Range**: `1.2` to `2.0`
**Default**: `1.5`

**What it does**: Controls the spacing between lines of text.

**Implementation**:
```typescript
// Set in ReaderContent.tsx - scoped to reader content only
container.style.setProperty('--reader-line-height', lineHeight.toString());
```

**Where it's consumed**:
```typescript
// src/client/routes/Reader/components/chunks/TextChunk.tsx (full mode)
lineHeight: 'var(--reader-line-height, 1.6)'

// src/client/routes/Reader/FocusReader.tsx (focus mode)
lineHeight: lineHeight
```

### 6. Font Family
**Property**: `currentFontFamily`
**Type**: `string`
**Default**: `'Inter, system-ui, sans-serif'`

**What it does**: Changes the typeface used for reading content.

**Available options**:
- Inter (default)
- Georgia
- Times New Roman
- Arial
- Helvetica
- Roboto
- Open Sans
- Lato
- Montserrat
- Merriweather
- Crimson Text
- Fira Sans

**Implementation**:
```typescript
// Set in ReaderContent.tsx - scoped to reader content only
container.style.setProperty('--reader-font-family', fontFamily);
```

**Where it's consumed**:
```typescript
// src/client/routes/Reader/components/chunks/TextChunk.tsx (full mode)
fontFamily: 'var(--reader-font-family, inherit)'

// src/client/routes/Reader/FocusReader.tsx (focus mode)
fontFamily: fontFamily
```

### 7. Text Color
**Property**: `currentTextColor`
**Type**: `string` (hex color)
**Default**: `'#000000'` (black)

**What it does**: Sets the color for reading text content.

**Implementation**:
```typescript
// Set in ReaderContent.tsx - scoped to reader content only
container.style.setProperty('--reader-text-color', textColor);
```

**Where it's consumed**:
```typescript
// src/client/routes/Reader/components/chunks/TextChunk.tsx (full mode)
color: 'var(--reader-text-color, inherit)'

// src/client/routes/Reader/FocusReader.tsx (focus mode)
color: textColor
```

## Code Architecture

### Key Files

1. **`src/client/components/ThemeModal.tsx`**
   - User interface for theme customization
   - Real-time preview functionality
   - Color presets and sliders

2. **`src/client/routes/Reader/hooks/useUserSettings.ts`**
   - State management for user preferences
   - Backend persistence
   - ⚠️ No longer sets CSS variables globally

3. **`src/client/routes/Reader/components/ReaderContent.tsx`**
   - **Core**: Sets CSS variables scoped to reader content only (full mode)
   - Receives theme settings as props
   - Applies styling to reading container

3b. **`src/client/routes/Reader/FocusReader.tsx`**
   - **Core**: Applies theme settings directly via inline styles (focus mode)
   - Receives theme settings from `useUserTheme()` context
   - Scales font size by 1.5x for emphasis in focus mode

4. **`src/client/components/UserThemeProvider.tsx`**
   - Material-UI theme configuration for app-wide styling
   - ⚠️ No longer includes typography settings (scoped to reader only)

5. **`src/client/routes/Reader/components/chunks/TextChunk.tsx`**
   - Consumer of all reader-specific CSS variables

6. **`src/client/styles/globals.css`**
   - CSS class definitions for word highlighting

### CSS Variables Used

| Variable | Purpose | Set By | Consumed By | Scope |
|----------|---------|--------|-------------|-------|
| `--word-highlight-color` | Word highlight background | `ReaderContent.tsx` | `.highlight-word` class | Reader content only |
| `--sentence-highlight-color` | Sentence background | `ReaderContent.tsx` | `TextChunk.tsx` | Reader content only |
| `--reader-font-size` | Base font size | `ReaderContent.tsx` | `TextChunk.tsx` | Reader content only |
| `--reader-line-height` | Line spacing | `ReaderContent.tsx` | `TextChunk.tsx` | Reader content only |
| `--reader-font-family` | Font typeface | `ReaderContent.tsx` | `TextChunk.tsx` | Reader content only |
| `--reader-text-color` | Text color | `ReaderContent.tsx` | `TextChunk.tsx` | Reader content only |

## Implementation Details

### Setting CSS Variables (Scoped to Reader)
CSS variables are set locally on the reader content container to ensure instant visual feedback without affecting the rest of the app:

```typescript
// src/client/routes/Reader/components/ReaderContent.tsx

// Applied only to the reader content container
useEffect(() => {
  const container = readerContentRef.current;
  if (container) {
    container.style.setProperty('--reader-font-size', `${fontSize}rem`);
    container.style.setProperty('--reader-line-height', lineHeight.toString());
    container.style.setProperty('--reader-font-family', fontFamily);
    container.style.setProperty('--reader-text-color', textColor);
    container.style.setProperty('--word-highlight-color', highlightColor);
    container.style.setProperty('--sentence-highlight-color', sentenceHighlightColor);
  }
}, [fontSize, lineHeight, fontFamily, textColor, highlightColor, sentenceHighlightColor]);
```

**Key Benefits**:
- ✅ Changes only affect book content
- ✅ Instant visual feedback
- ✅ App UI remains unaffected
- ✅ No global style pollution

### Consumption Pattern
Components consume CSS variables with fallback values:

```typescript
// Example: Using CSS variable with fallback
style={{
  fontSize: 'var(--reader-font-size, 1rem)',
  backgroundColor: 'var(--sentence-highlight-color, transparent)'
}}
```

### Persistence
All theme settings are automatically saved to the user's backend preferences and restored on subsequent visits.

## User Experience Features

### Real-time Preview
The ThemeModal includes a preview section that demonstrates how changes will look:
- Shows sample text with sentence highlighting
- Displays word highlighting effect
- Updates instantly as users adjust settings

### Reset to Defaults
Users can quickly restore all theme settings to their original values:
- **"Reset to Defaults" button** in the theme modal
- Restores all typography and color settings at once
- Immediately applies changes and saves to backend

**Default values** restored by reset:
- Theme: Light mode
- Highlight color: `#ffeb3b` (yellow)
- Sentence highlight color: `#e3f2fd` (light blue)
- Font size: `1.0x`
- Line height: `1.5`
- Font family: `Inter, system-ui, sans-serif`
- Text color: `#000000` (black)

### Smart Defaults
- Sentence highlight colors automatically adjust when switching between light/dark themes
- Color presets provide good contrast ratios
- Font size and line height ranges are optimized for readability

### Accessibility
- High contrast options available
- Font size scaling supports users with visual impairments
- Color combinations tested for readability

## Extending the System

To add new customizable properties:

1. Add the property to `ThemeModalProps` interface
2. Add UI controls in `ThemeModal.tsx`
3. Add handler function in `useUserSettings.ts`
4. Pass the setting as prop to `ReaderContent.tsx`
5. Set CSS variable in `ReaderContent.tsx` scoped to reader container
6. Update backend storage schema
7. Consume the setting in relevant reader components

Example:
```typescript
// 1. Add to ThemeModal interface
interface ThemeModalProps {
  currentNewProperty: string;
  onNewPropertyChange: (value: string) => void;
}

// 2. Add handler in useUserSettings.ts
const handleNewPropertyChange = async (newProperty: string) => {
  updateState({ newProperty });
  // Save to backend...
};

// 3. Pass to ReaderContent.tsx
<ReaderContent newProperty={settings.newProperty} ... />

// 4. Set CSS variable in ReaderContent.tsx
container.style.setProperty('--reader-new-property', newProperty);

// 5. Consume in reader components
style={{ someProperty: 'var(--reader-new-property, defaultValue)' }}
```

**Important**: Always scope new CSS variables to the reader content container to maintain the principle of isolated theming.

## Reading Mode Support

### Full Reading Mode
- Theme settings applied via CSS variables on the reader content container
- CSS variables provide separation and instant updates
- All chunk components consume CSS variables

### Focus Reading Mode
- Theme settings retrieved from `useUserTheme()` context
- Applied directly as inline styles via Material-UI `sx` props
- Font size scaled by 1.5x for the main sentence to create visual emphasis
- All typography settings (font size, line height, font family) fully supported
- Color settings (text color, highlight color) fully supported

Both modes receive the same settings from `useUserSettings`, ensuring consistent theming across the entire reader experience.

---

**Last Updated**: October 14, 2025  
**Recent Changes**: Added focus mode theme integration - all theme settings now work in both full and focus reading modes