# Reader Features Documentation

## Overview

This document provides a comprehensive list of all features supported in the Book Reader application, their implementation status, and how they work.

## Core Reading Features

### 1. Reading Modes
- ✅ **Full Reading Mode**: Traditional book reading with all content visible
- ✅ **Focus Reading Mode**: Minimalist view showing previous, current, and next sentences only
  - Click current sentence area to advance to next
  - Click previous sentence (when visible) to go back
  - Keyboard navigation: Arrow Right (next), Arrow Left (previous)

### 2. Audio Playback

#### Basic Controls
- ✅ **Play/Pause**: Start or pause audio narration
- ✅ **Next Sentence**: Skip to the next sentence
- ✅ **Previous Sentence**: Go back to the previous sentence
- ✅ **Auto-play Next**: Automatically plays the next sentence when current finishes
- ✅ **Playback Speed**: Adjustable speed (0.5x to 2.0x) from playback settings panel

#### Audio Configuration
- ✅ **TTS Provider Selection**: Choose between different TTS providers
- ✅ **Voice Selection**: Select from available voices for each provider
- ✅ **Playback Speed Control**: Real-time speed adjustment (applied to currently playing audio)

### 3. Text Highlighting

#### Word Highlighting
- ✅ **Real-time Word Highlighting**: Current word is highlighted during audio playback
- ✅ **Customizable Color**: User can change word highlight color from theme panel
- ✅ **Smooth Transitions**: CSS-based transitions for visual feedback
- ✅ **Focus Mode Word Highlighting**: Works in both full and focus modes

#### Sentence Highlighting
- ✅ **Current Sentence Background**: Current sentence has colored background
- ✅ **Customizable Color**: User can change sentence highlight color from theme panel
- ✅ **Works in Full Mode**: Paragraph-based layout with sentence-level highlighting

#### Line Highlighting (Focus Mode Only)
- ✅ **Line Overlay**: Straight line background across the current word line
- ✅ **Highlight Mode Toggle**: User can choose between word, line, or no highlighting in focus mode

### 4. Navigation

#### Chapter Navigation
- ✅ **Next Chapter**: Navigate to the next chapter
- ✅ **Previous Chapter**: Navigate to the previous chapter
- ✅ **Chapter List**: View and jump to any chapter from the chapter dialog
- ✅ **Reading Progress Persistence**: Automatically saves and restores reading position

#### Within-Chapter Navigation
- ✅ **Sentence-Level Navigation**: Navigate by individual sentences
- ✅ **Scroll to Current**: Button to scroll to currently playing sentence (full mode)
- ✅ **Word Click**: Click any word to start playback from that position

### 5. Bookmarks

- ✅ **Add Bookmark**: Save current reading position
- ✅ **Bookmark List**: View all bookmarks for the current book
- ✅ **Navigate to Bookmark**: Jump to any saved bookmark
- ✅ **Bookmark Persistence**: Bookmarks saved to user account

### 6. Theme Customization

#### Typography
- ✅ **Font Size**: Adjustable from 0.8rem to 2.0rem (applies to both full and focus modes)
- ✅ **Line Height**: Adjustable from 1.2 to 2.5 (applies to both full and focus modes)
- ✅ **Font Family**: Multiple font choices - Sans-serif, Serif, Monospace, Custom (applies to both full and focus modes)

#### Colors
- ✅ **Theme Mode**: Light, Dark, Sepia, Custom
- ✅ **Text Color**: Customizable text color (applies to both full and focus modes)
- ✅ **Background Color**: Customizable background color
- ✅ **Word Highlight Color**: Customizable word highlighting color
- ✅ **Sentence Highlight Color**: Customizable sentence highlighting color
- ✅ **Real-time Preview**: Changes apply instantly in both reading modes

### 7. Content Rendering

#### Text Chunks
- ✅ **Sentence-Level Chunks**: Each sentence is a separate playable unit
- ✅ **Paragraph Grouping**: Sentences grouped by paragraphs for visual organization
- ✅ **Word-Level Spans**: Each word wrapped for highlighting support

#### Headers
- ✅ **Semantic Headers**: Proper header rendering with Typography component
- ✅ **Visual-only**: Headers don't have audio playback (visual navigation only)

#### Images
- ✅ **Inline Images**: Images displayed in reading flow
- ✅ **Image Captions**: Alt text displayed as captions
- ✅ **Visual-only**: Images don't have audio playback

#### Links
- ✅ **Cross-References**: Clickable footnotes and page references
- ✅ **Chapter Navigation**: Links can navigate between chapters
- ✅ **Chunk Navigation**: Links can navigate to specific chunks

#### Lists
- ✅ **Bullet List Rendering**: Automatic detection and formatting of bullet lists using `•` or `*` characters
- ✅ **Line Break Insertion**: Inserts line breaks before each bullet for proper list display
- ✅ **Full Mode Support**: Lists render with proper line breaks in full reading mode
- ✅ **Focus Mode Support**: Lists render with line breaks and center alignment in focus mode
- ✅ **Preserves Highlighting**: Word-by-word highlighting works across list items
- ✅ **Consistent Styling**: List sentences maintain same font size, weight, and styling as regular text

### 8. Settings Persistence

- ✅ **User Settings**: All theme and playback settings saved to user account
- ✅ **Reading Progress**: Current chapter and sentence automatically saved
- ✅ **Cross-Device Sync**: Settings and progress sync across devices

### 9. Offline Support

- ✅ **Offline Reading**: Downloaded chapters readable without internet
- ✅ **Chapter Downloads**: Users can download chapters for offline access
- ✅ **Offline Indicator**: Clear indication when reading offline content

### 10. AI Features

- ✅ **Ask AI Panel**: Chat with AI about the book content
- ✅ **Context-Aware**: AI has access to current chapter and sentence
- ✅ **Conversation History**: Previous questions and answers maintained

## Architecture Overview

### Audio System
- **Unified Controller**: `useSentenceAudioController` manages all audio playback
- **Single Audio Element**: One `HTMLAudioElement` reused for all sentences
- **Sentence-Based**: Operates at sentence granularity (no chunk-based logic)
- **Preloading**: Automatically preloads adjacent sentences (±1) for smooth playback
- **Caching**: Audio and timepoints cached per sentence to avoid redundant API calls

### Highlighting System
- **Word Highlighting**: DOM-based with `WordHighlightingAPI` for direct manipulation
- **Sentence Highlighting**: React-based using conditional className
- **Line Highlighting**: CSS overlay positioned based on word measurements (focus mode)

### State Management
- **Reading Progress**: Managed by `useReadingProgress` hook with auto-save
- **User Settings**: Managed by `useUserSettings` hook with backend persistence
- **Bookmarks**: Managed by `useBookmarks` hook with CRUD operations

### Rendering
- **Parser v2 Output**: Sentence-level text chunks with paragraph metadata
- **Mixed Content**: Supports text, headers, and images in unified chunk array
- **Semantic HTML**: Proper elements for accessibility

## Implementation Status

### ✅ Completed Features (35/37)
- All core reading modes
- Audio playback with auto-advance
- Playback speed control
- Word highlighting (full & focus)
- Sentence highlighting
- Line highlighting (focus mode)
- Chapter navigation
- Sentence-level navigation (keyboard + click)
- Bookmarks system
- Complete theme customization (both modes)
- Settings persistence
- Cross-reference links
- Mixed content rendering
- Offline support
- AI chat integration
- Focus mode theme integration
- Bullet list rendering (both modes)

### ✅ Recently Verified
- ✅ **Focus Mode Theme Integration**: All theme settings (font size, line height, font family, text color) now apply to focus mode (October 2025)
- ✅ **Focus Mode Navigation**: Click interactions for previous/next sentence navigation (October 2025)

### ⚠️ To Be Verified (2/36)
- Sentence background highlighting (verify styling)
- TTS voice selection (verify voice is applied)

### 🚀 Future Enhancements (Phase 6)
- Viewport-driven word-span hydration for performance
- Batch highlight DOM updates with `requestAnimationFrame`
- Blob URLs for audio instead of base64
- LRU cache with size limits
- Stable sentence ID generation
- Mobile gesture controls
- E2E test coverage

## Key Files

### Audio & Playback
- `src/client/routes/Reader/hooks/useSentenceAudioController.ts` - Unified audio controller
- `src/client/routes/Reader/utils/WordHighlightingAPI.ts` - Word highlighting API

### Components
- `src/client/routes/Reader/Reader.tsx` - Main reader container
- `src/client/routes/Reader/FocusReader.tsx` - Focus mode UI
- `src/client/routes/Reader/components/ReaderContent.tsx` - Full mode content renderer
- `src/client/routes/Reader/components/AudioControls.tsx` - Playback controls

### Hooks
- `src/client/routes/Reader/hooks/useReader.ts` - Main reader orchestration
- `src/client/routes/Reader/hooks/useUserSettings.ts` - Theme & settings management
- `src/client/routes/Reader/hooks/useBookmarks.ts` - Bookmark CRUD operations
- `src/client/routes/Reader/hooks/useReadingProgress.ts` - Progress tracking & auto-save

### Styling
- `src/client/styles/globals.css` - Global styles including `.highlight-word`
- `src/client/routes/Reader/styles/linkStyles.ts` - Link styling CSS

## Testing Checklist

### Audio Playback
- [ ] Play button starts audio
- [ ] Pause button stops audio
- [ ] Next sentence button advances correctly
- [ ] Previous sentence button goes back correctly
- [ ] Auto-play advances to next sentence when current ends
- [ ] Playback speed control changes audio speed in real-time
- [ ] Speed changes persist across sentences

### Highlighting
- [ ] Word highlighting appears during playback (full mode)
- [ ] Word highlighting appears during playback (focus mode)
- [ ] Line highlighting works in focus mode when selected
- [ ] Sentence background highlighting shows current sentence
- [ ] Custom colors apply correctly from theme panel
- [ ] Highlighting clears when playback stops

### Navigation
- [ ] Chapter navigation works (next/previous)
- [ ] Sentence navigation works (next/previous buttons)
- [ ] Focus mode: Click current area to advance
- [ ] Focus mode: Click previous sentence to go back
- [ ] Focus mode: Arrow Right/Left keyboard navigation
- [ ] Scroll to current button works in full mode
- [ ] Word click starts playback from that word
- [ ] Bookmarks navigate correctly
- [ ] Reading progress restores on page load

### Theme Customization
- [ ] Font size changes apply immediately (full mode)
- [ ] Font size changes apply immediately (focus mode)
- [ ] Line height changes apply immediately (full mode)
- [ ] Line height changes apply immediately (focus mode)
- [ ] Font family changes apply immediately (full mode)
- [ ] Font family changes apply immediately (focus mode)
- [ ] Text color changes apply immediately (both modes)
- [ ] Theme mode changes (light/dark/sepia) apply
- [ ] Word highlight color changes work
- [ ] Sentence highlight color changes work
- [ ] Settings persist across sessions

### Content Rendering
- [ ] Text chunks render correctly
- [ ] Headers display with proper styling
- [ ] Images display inline with captions
- [ ] Links are clickable and navigate correctly
- [ ] Paragraphs grouped visually
- [ ] Bullet lists (`•` or `*`) render with line breaks (full mode)
- [ ] Bullet lists render with line breaks (focus mode)
- [ ] Word highlighting works across bullet list items
- [ ] List styling matches regular text (font size, weight)

### Edge Cases
- [ ] First sentence in chapter plays correctly
- [ ] Last sentence in chapter stops correctly
- [ ] Chapter boundary navigation works
- [ ] Empty chapters handled gracefully
- [ ] TTS errors handled gracefully
- [ ] Offline mode works correctly

## Troubleshooting

### Audio Not Playing
1. Check TTS is enabled in settings
2. Verify internet connection (TTS requires API access)
3. Check browser console for TTS API errors
4. Try different TTS provider/voice

### Highlighting Not Working
1. Verify highlight colors are not transparent
2. Check browser console for JavaScript errors
3. Ensure word elements have correct `data-word-id` attributes
4. Verify CSS class `.highlight-word` exists in globals.css

### Playback Speed Not Applying
1. Open playback settings and verify speed is set
2. Check that audio element exists (`audioRef.current`)
3. Verify `playbackSpeed` is being passed to controller

### Progress Not Saving
1. Check user is logged in
2. Verify network connection
3. Check browser console for API errors
4. Verify `useReadingProgress` hook is active

## Related Documentation

- [Highlighting Systems](./highlighting-systems.md) - Detailed highlighting implementation
- [Theme Customization](./theme-customization.md) - Theme system documentation
- [Parser v2 Schema](./README-v2-schema-and-rendering.md) - Content structure and rendering
- [Sentence Audio Refactor Plan](../feature-plans/reader-sentence-audio-refactor.md) - Architecture decisions

---

**Last Updated**: October 17, 2025  
**Implementation Status**: ✅ 35/37 features complete (95%)  
**Next Steps**: Verify remaining 2 features, then proceed with Phase 6 optimizations

## Recent Updates

### October 17, 2025
- ✅ **Bullet List Rendering**: Implemented automatic detection and rendering of bullet lists
  
### October 26, 2025
- ✅ **TTS Usage Dashboard**: Added 30/60/90-day range selector. API returns only in-range data. Free Tier Usage is based on current calendar month and exposed as `freeTierMonthUsage` in the summary response. Recent records list returns only the last 24 hours for a compact UI.
  - Detects `•` and `*` characters as bullet markers
  - Inserts `<br/>` elements before each bullet for proper line breaks
  - Works in both full reading mode and focus mode
  - Maintains word-by-word highlighting across list items
  - Preserves consistent styling (font size, weight, alignment) with regular text
  - Implementation in `EnhancedText.tsx` and `FocusReader.tsx`

### October 14, 2025
- ✅ **Focus Mode Theme Integration**: Fixed FocusReader to properly apply all theme settings including fontSize, lineHeight, and fontFamily from Theme & Appearance Settings
- ✅ **Focus Mode Click Navigation**: Added click handlers for previous sentence navigation in focus mode
- ✅ **Focus Mode Previous Click Bug Fix**: Fixed issue where clicking previous sentence was going forward instead of backward by adding proper event propagation handling
- Updated testing checklist to include focus mode theme verification

