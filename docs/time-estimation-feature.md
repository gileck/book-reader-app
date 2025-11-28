# Time Estimation Feature

## Overview

Added a reading time estimation feature to the audio player that calculates and displays the estimated time remaining to finish reading/listening to the current chapter.

## Implementation Details

### 1. Time Estimation Utility (`src/client/routes/Reader/utils/timeEstimation.ts`)

Created three utility functions:

- **`calculateTimeRemaining(chunks, currentSentenceIndex, playbackSpeed)`**: Calculates the estimated time in seconds based on:
  - Word count in remaining chunks (excluding current sentence)
  - Average speaking rate of ~150 words per minute at 1x speed
  - Current playback speed adjustment (e.g., 1.5x speed = 1.5x faster)

- **`formatTimeRemaining(seconds)`**: Formats seconds into human-readable strings:
  - `"45s"` for less than 1 minute
  - `"4m"` for minutes only
  - `"1h 23m"` for hours and minutes

- **`getFormattedTimeRemaining(chunks, currentSentenceIndex, playbackSpeed)`**: Convenience function that combines calculation and formatting. Returns empty string if less than 10 seconds remaining.

### 2. AudioControls Component Update (`src/client/components/AudioControls.tsx`)

- Added new optional prop: `estimatedTimeRemaining?: string`
- Updated sentence counter display to show time estimation in blue next to the sentence count
- Format: `"100 of 135 sentences (4m)"`

### 3. ReaderUI Component Update (`src/client/routes/Reader/ReaderUI.tsx`)

- Imported `getFormattedTimeRemaining` utility
- Added `useMemo` hook to calculate estimated time remaining
- Dependencies: sentences, currentSentenceIndex, playbackSpeed (recalculates when any change)
- Passed `estimatedTimeRemaining` to AudioControls component

## User Experience

### Display Location
The time estimation appears in the audio player controls at the bottom of the screen, next to the sentence counter:
```
100 of 135 sentences (4m)
```

### Visual Design
- Time is displayed in blue color (`#4285f4`) to distinguish it from the sentence count
- Bold font weight for emphasis
- Only shows when there's 10+ seconds remaining
- Automatically updates as user progresses through the chapter

### Time Calculation Logic
- Based on average speaking rate: ~150 words per minute at 1x speed
- **Includes realistic inter-sentence pauses** based on actual measurements:
  - **At 1x speed**: ~900ms pause
  - **At 1.5x speed**: ~700ms pause  
  - **At 2x speed**: ~500ms pause
  - Includes: programmatic delay (100ms) + audio startup (~300-400ms) + buffering (~200-300ms) + browser latency (~100-200ms)
  - Linear scaling: pause = 900ms - (speed - 1) × 400ms
- Automatically adjusts audio time for playback speed:
  - 1.5x speed → reads faster → less time remaining
  - 0.5x speed → reads slower → more time remaining
- Only counts text and header chunks (excludes images)
- Calculates from NEXT sentence onward (current sentence not included)

### Example Calculation

**For 100 remaining sentences with 3000 words at 1x speed:**
- Audio time: 3000 words ÷ 150 words/min = 20 minutes
- Pause time: 100 sentences × 900ms = **90 seconds (1.5 minutes)**
- **Total: ~21m 30s**

**At 1.5x speed:**
- Audio time: 3000 words ÷ (150 × 1.5) words/min = ~13.3 minutes
- Pause time: 100 sentences × 700ms = **70 seconds (~1.2 minutes)**
- **Total: ~14m 30s**

**At 2x speed:**
- Audio time: 3000 words ÷ (150 × 2) words/min = 10 minutes
- Pause time: 100 sentences × 500ms = **50 seconds**
- **Total: ~10m 50s**

## Technical Notes

- **Performance**: Uses `useMemo` to avoid recalculation on every render
- **Type Safety**: Full TypeScript support with proper types throughout
- **Zero Dependencies**: No additional packages required
- **Responsive**: Updates immediately when speed changes or user navigates

