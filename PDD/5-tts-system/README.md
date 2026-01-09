# 5. Text-to-Speech System

## Overview

The TTS (Text-to-Speech) system is a core feature that provides professional voice narration synchronized with visual text highlighting. This section documents both the user-facing product features and the key technical concepts that make the system work.

## Why This Section Exists

While most of this PDD focuses exclusively on product features, the TTS system warrants technical explanation because:
- Its complexity directly impacts product behavior
- Understanding the technical foundation helps explain user-facing limitations
- Synchronization quality depends on technical implementation choices
- Performance characteristics affect the user experience

## Sub-Sections

### Product Features
- **[5.1 Product Features](5.1-product-features.md)** - All user-facing TTS capabilities

### Technical Understanding (Product Perspective)
- **[5.2 Technical Overview](5.2-technical-overview.md)** - How TTS works from a product perspective
- **[5.3 Synchronization](5.3-synchronization.md)** - How audio-text sync works
- **[5.4 Performance](5.4-performance.md)** - Why TTS is fast and smooth

### Technical Implementation (Code-Level)
Deep technical documentation with actual source code examples:
- **[Word-Audio Synchronization](technical/word-audio-synchronization.md)** - SSML marks, timepoint extraction, real-time sync
- **[Word Highlighting CSS](technical/word-highlighting-css.md)** - Performance-optimized CSS implementation
- **[Auto-Play Sentences](technical/auto-play-sentences.md)** - Seamless sentence transitions without user interaction
- **[Preload & Cache Audio](technical/preload-cache-audio.md)** - Multi-layer caching and preloading strategy

## Key Product Capabilities

**Multi-Provider Support:**
- Google Cloud TTS (45+ voices)
- Amazon Polly (26+ voices)
- ElevenLabs (10+ ultra-realistic voices)

**Perfect Synchronization:**
- Word-level highlighting matches audio precisely
- No lag or delay
- Smooth transitions between words
- Adjustable timing offset for fine-tuning

**Intelligent Features:**
- Auto-play advances automatically through chapter
- Preloading ensures instant playback
- Caching prevents redundant API calls
- Error recovery maintains reading flow

**Customization:**
- Playback speed (0.5x - 2.0x)
- Voice selection per provider
- Highlight modes (word, line, off)
- Timing offset adjustment

---

[← Back to Reader](../4-reader/README.md) | [Main README](../README.md) | [Next: Product Features →](5.1-product-features.md)
