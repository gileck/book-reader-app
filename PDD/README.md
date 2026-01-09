# Product Design Document (PDD)
## E-Book Reader Application - Complete Feature Documentation

**Version:** 1.0
**Last Updated:** January 2026
**Document Type:** Comprehensive Product Specification

---

## About This Documentation

This PDD provides complete product-level documentation for every user-facing feature in the e-book reader application. Each document focuses on what users see, how they interact with features, and the visual/behavioral design—without diving into code implementation (except where noted for complex technical features like TTS).

---

## Table of Contents

### ⭐ Core Concepts (START HERE)

**[CORE-CONCEPTS.md](CORE-CONCEPTS.md)** - **READ THIS FIRST!** Essential product-specific implementation details that are unique to this app and affect every feature:
- **Chunks vs Sentences** - The fundamental data model (NOT 1:1!)
- **Sentence Splitting Algorithm** - 50+ protected abbreviations and edge cases
- **TTS Playability Rules** - What chunks can/cannot be played
- **Reading Mode State Sharing** - How 5 modes share position seamlessly
- **Q&A Context Selection** - Which sentences are sent to AI
- **Bookmark Navigation** - Exact behavior on navigation
- **Chapter Completion** - What happens at chapter end

### Core Documentation

1. **[Overview](1-overview.md)** - Application introduction, value proposition, target users
2. **[Book Library](2-book-library.md)** - Book management hub with progress tracking
3. **[Upload Book](3-upload-book.md)** - PDF upload and parsing workflow

### Reader Experience (Most Detailed)

4. **[Reader Page](4-reader/)** - Core reading experience with 5 modes
   - [4.1 Reading Modes Overview](4-reader/4.1-reading-modes-overview.md)
   - [4.2 Full Reading Mode](4-reader/4.2-full-reading-mode.md)
   - [4.3 Focus Reading Mode](4-reader/4.3-focus-reading-mode.md)
   - [4.4 Q&A Chat Mode](4-reader/4.4-qa-chat-mode.md)
   - [4.5 Search Mode](4-reader/4.5-search-mode.md)
   - [4.6 Overview Mode](4-reader/4.6-overview-mode.md)
   - [4.7 Text-to-Speech System](4-reader/4.7-text-to-speech.md)
   - [4.8 Audio Controls](4-reader/4.8-audio-controls.md)
   - [4.9 Translation Feature](4-reader/4.9-translation.md)
   - [4.10 Bookmarks](4-reader/4.10-bookmarks.md)
   - [4.11 Navigation & Progress](4-reader/4.11-navigation-progress.md)
   - [4.12 Customization](4-reader/4.12-customization.md)

### Text-to-Speech Deep Dive

5. **[TTS System](5-tts-system/)** - Comprehensive TTS documentation (product + technical)
   - [5.1 Product Features](5-tts-system/5.1-product-features.md) - User-facing TTS capabilities
   - [5.2 Technical Overview](5-tts-system/5.2-technical-overview.md) - How TTS works (product perspective)
   - [5.3 Synchronization](5-tts-system/5.3-synchronization.md) - Audio-text sync concepts
   - [5.4 Performance](5-tts-system/5.4-performance.md) - Why TTS is fast
   - **Technical Implementation** (Code-level documentation):
     - [Word-Audio Synchronization](5-tts-system/technical/word-audio-synchronization.md)
     - [Word Highlighting CSS](5-tts-system/technical/word-highlighting-css.md)
     - [Auto-Play Sentences](5-tts-system/technical/auto-play-sentences.md)
     - [Preload & Cache Audio](5-tts-system/technical/preload-cache-audio.md)

### Supporting Features

6. **[Bookmarks Page](6-bookmarks-page.md)** - Bookmark management across books
7. **[Reading History](7-reading-history.md)** - Session tracking and statistics
8. **[Usage Tracking](8-usage-tracking.md)** - TTS and Translation cost monitoring
9. **[File Storage](9-file-storage.md)** - S3/Vercel Blob file management

---

## Documentation Structure

Each feature document follows this consistent format:

### Purpose
High-level goal and user value (1-2 sentences)

### Design/Layout
- Visual organization and component structure
- Color schemes and styling
- Layout patterns (desktop vs mobile)
- Special states (loading, empty, error)

### User Interactions
- Step-by-step user flows
- Click/tap behaviors and responses
- State transitions and feedback
- Edge cases and error handling

---

## Key Features at a Glance

### 🎯 Core Capabilities
- **5 Reading Modes**: Full, Focus, Q&A, Search, Overview
- **Professional TTS**: 100+ voices from Google, Polly, ElevenLabs
- **Perfect Sync**: Word-level audio highlighting
- **AI Integration**: Context-aware Q&A and summaries
- **16 Languages**: Instant translation support

### 🎨 Design Philosophy
- **Apple Books Inspired**: Warm, elegant themes
- **Accessibility First**: Customizable typography and colors
- **Mobile Optimized**: Touch-friendly with responsive design
- **60fps Performance**: Smooth animations and interactions

### 📊 Reading Support
- **Progress Tracking**: Auto-save with session history
- **Smart Bookmarks**: Visual indicators with quick navigation
- **Offline Support**: Download chapters for offline reading
- **Usage Analytics**: Monitor TTS/translation costs

---

## Documentation Notes

### Excluded Content
Per user request, these areas are NOT documented:
- Authentication flows
- Navigation patterns
- Standalone AI Chat page
- Settings page
- Profile page

### Technical Sections
Section 5 (TTS System) includes deep technical documentation due to complexity. This is the only section with implementation-level details, covering:
- SSML mark insertion algorithms
- Provider-specific timing metadata parsing
- Race condition handling
- CSS rendering pipeline optimization
- Performance profiling techniques

---

## Navigation Tips

- **Quick Reference**: Use the table of contents to jump to specific features
- **Reader Focus**: Section 4 contains the most detailed documentation
- **TTS Deep Dive**: Section 5 for technical understanding of audio synchronization
- **Cross-References**: Documents link to related features when relevant

---

## Version History

- **v1.0** (January 2026) - Initial comprehensive documentation release

---

*This documentation represents the product as designed and implemented. For technical implementation details, API documentation, or development guides, please refer to the separate technical documentation repository.*
