# Auto-Play Sentences - Technical Implementation

## Overview

This document explains how the application automatically advances to the next sentence when the current audio completes, creating a seamless audiobook-like experience without user interaction.

---

## Architecture

### Core Components

1. **Audio Event Listener**: Detects when audio finishes (`ended` event)
2. **Intent Tracking**: Distinguishes user-initiated play from programmatic play
3. **Navigation Logic**: Finds next playable sentence (skips images)
4. **Declarative Play Trigger**: Uses React effects instead of imperative callbacks

**File**: `src/client/routes/Reader/hooks/useSentenceAudioController.ts`

---

## State Management

### Intent Tracking

```typescript
interface AudioControllerState {
    isPlaying: boolean;      // Current playback state
    intendedPlay: boolean;   // User wants continuous play
    pendingPlay: boolean;    // Play requested, waiting for audio load
    currentWordIndex: number;
}

const [state, setState] = useState<AudioControllerState>({
    isPlaying: false,
    intendedPlay: false,
    pendingPlay: false,
    currentWordIndex: 0
});
```

**Why `intendedPlay` is needed:**

```typescript
// User clicks play button
const play = async () => {
    setState(prev => ({
        ...prev,
        intendedPlay: true,  // User wants continuous playback
        pendingPlay: true
    }));
};

// User clicks pause button
const pause = () => {
    setState(prev => ({
        ...prev,
        intendedPlay: false,  // User wants to stop
        isPlaying: false
    }));
};
```

**Difference between `isPlaying` and `intendedPlay`:**
- `isPlaying`: Audio is currently playing NOW
- `intendedPlay`: User wants playback to continue (survives navigation)

---

## Audio Ended Handler

### Core Auto-Play Logic

```typescript
const handleEnded = useCallback(() => {
    const { intendedPlay } = stateRef.current;
    const currentIndex = currentSentenceIndexRef.current;

    // Stop playing current sentence
    setState(prev => ({ ...prev, isPlaying: false }));

    // Auto-advance if user wants continuous playback
    if (intendedPlay && currentIndex < sentences.length - 1) {
        goToSentence(currentIndex + 1);
    }
}, [sentences.length, goToSentence]);
```

**Flow:**
1. Audio finishes → `ended` event fires
2. Check `intendedPlay` flag (did user click play or was it auto-triggered?)
3. If true AND not at chapter end → navigate to next sentence
4. Navigation triggers play via `pendingPlay` mechanism

---

## Navigation with Play Intent

### Go To Sentence Function

```typescript
const goToSentence = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= sentences.length) {
        return; // Out of bounds
    }

    const wasPlaying = stateRef.current.isPlaying;

    // Stop current audio
    const audio = audioRef.current;
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }

    // Navigate to target
    navigateToSentenceIndex(targetIndex, wasPlaying);
}, [sentences.length, navigateToSentenceIndex]);
```

### Navigate To Sentence Index

```typescript
const navigateToSentenceIndex = useCallback(
    (targetIndex: number, shouldAutoPlay: boolean) => {
        if (targetIndex < 0 || targetIndex >= sentences.length) {
            return;
        }

        // Find next playable chunk (skip images)
        const targetSentence = sentences[targetIndex];
        const isPlayable = targetSentence.type === 'text' ||
                          targetSentence.type === 'header';

        if (!isPlayable) {
            // Skip to next playable chunk
            const nextPlayable = findNextPlayableIndex(targetIndex);
            if (nextPlayable !== -1) {
                navigateToSentenceIndex(nextPlayable, shouldAutoPlay);
            }
            return;
        }

        // Update parent component's sentence index
        onSentenceIndexChange(targetIndex);

        // Set pending play if audio was playing
        if (shouldAutoPlay) {
            setState(prev => ({
                ...prev,
                pendingPlay: true,
                currentWordIndex: 0
            }));
        }
    },
    [sentences, onSentenceIndexChange, findNextPlayableIndex]
);
```

**Key features:**
- Skips non-playable chunks (images) automatically
- Preserves play intent through `shouldAutoPlay` parameter
- Updates parent state via callback (controlled component pattern)
- Sets `pendingPlay` flag to trigger audio load + play

---

## Finding Next Playable Chunk

### Skip Images During Auto-Play

```typescript
const findNextPlayableIndex = useCallback((startIndex: number): number => {
    for (let i = startIndex; i < sentences.length; i++) {
        const sentence = sentences[i];
        if (sentence.type === 'text' || sentence.type === 'header') {
            return i;
        }
    }
    return -1; // No more playable chunks
}, [sentences]);

const findPrevPlayableIndex = useCallback((startIndex: number): number => {
    for (let i = startIndex; i >= 0; i--) {
        const sentence = sentences[i];
        if (sentence.type === 'text' || sentence.type === 'header') {
            return i;
        }
    }
    return -1; // No previous playable chunks
}, [sentences]);
```

**Usage in next/prev:**

```typescript
const goNext = useCallback(() => {
    const currentIndex = currentSentenceIndexRef.current;
    const nextIndex = findNextPlayableIndex(currentIndex + 1);

    if (nextIndex !== -1) {
        goToSentence(nextIndex);
    }
}, [findNextPlayableIndex, goToSentence]);

const goPrevious = useCallback(() => {
    const currentIndex = currentSentenceIndexRef.current;
    const prevIndex = findPrevPlayableIndex(currentIndex - 1);

    if (prevIndex !== -1) {
        goToSentence(prevIndex);
    }
}, [findPrevPlayableIndex, goToSentence]);
```

---

## Declarative Play Trigger

### Why Not Imperative?

**Old approach (problematic):**

```typescript
// ❌ BAD: Race condition with React state updates
const navigateToSentenceIndex = (index: number, shouldAutoPlay: boolean) => {
    onSentenceIndexChange(index);

    if (shouldAutoPlay) {
        setTimeout(() => {
            play(); // May run before React state commits
        }, 0);
    }
};
```

**Problems:**
- `play()` may run before state updates committed
- Race condition with audio loading
- Hard to trace in React DevTools
- Unpredictable execution order

### New Approach: Effect-Based

```typescript
const navigateToSentenceIndex = useCallback(
    (targetIndex: number, shouldAutoPlay: boolean) => {
        onSentenceIndexChange(targetIndex);

        if (shouldAutoPlay) {
            setState(prev => ({
                ...prev,
                pendingPlay: true  // Set flag, effect will handle play
            }));
        }
    },
    [onSentenceIndexChange]
);

// Effect watches pendingPlay flag
useEffect(() => {
    if (state.pendingPlay) {
        void play(); // Guaranteed to run after state committed
    }
}, [state.pendingPlay, play]);
```

**Benefits:**
- Runs after React commit phase
- Audio element guaranteed to exist
- Proper dependency tracking
- Visible in React DevTools

---

## Complete Auto-Play Flow

### Step-by-Step Execution

```
1. User clicks play button
   ↓
2. play() sets intendedPlay = true, pendingPlay = true
   ↓
3. Effect detects pendingPlay → loads audio + plays
   ↓
4. Audio plays for N seconds
   ↓
5. Audio ends → 'ended' event fires
   ↓
6. handleEnded() checks intendedPlay (true)
   ↓
7. goToSentence(currentIndex + 1)
   ↓
8. navigateToSentenceIndex() finds next playable chunk
   ↓
9. Sets pendingPlay = true (preserves play intent)
   ↓
10. Effect detects pendingPlay → plays next sentence
    ↓
11. Loop continues until user pauses or chapter ends
```

---

## Audio Element Event Listeners

### Setup and Cleanup

```typescript
useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Register event handlers
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);

    // Cleanup on unmount
    return () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('error', handleError);
    };
}, [handleEnded, handleCanPlay, handleTimeUpdate, handleError]);
```

### Can Play Handler

```typescript
const handleCanPlay = useCallback(() => {
    // Audio loaded and ready to play
    if (state.pendingPlay) {
        setState(prev => ({
            ...prev,
            isPlaying: true,
            pendingPlay: false
        }));

        audioRef.current?.play().catch(error => {
            console.error('Failed to play audio:', error);
            setState(prev => ({
                ...prev,
                isPlaying: false,
                intendedPlay: false
            }));
        });
    }
}, [state.pendingPlay]);
```

**Note**: `canplay` event ensures audio is ready before calling `play()`.

---

## Play Function Implementation

### Loading and Playing Audio

```typescript
const play = useCallback(async () => {
    const currentIndex = currentSentenceIndexRef.current;

    // Load sentence audio if not cached
    await loadSentence(currentIndex, true);

    // Get cached audio
    const cached = cacheRef.current[currentIndex];
    if (!cached) {
        console.error('Audio not loaded');
        return;
    }

    // Create or update audio element
    let audio = audioRef.current;
    if (!audio) {
        audio = new Audio();
        audioRef.current = audio;
    }

    // Set source and timepoints
    audio.src = cached.src;
    timepointsRef.current = cached.timepoints;

    // Set pending play (actual play happens in 'canplay' event)
    setState(prev => ({
        ...prev,
        intendedPlay: true,
        pendingPlay: true
    }));
}, [loadSentence]);
```

**Flow:**
1. Load sentence audio (from cache or API)
2. Get audio source from cache
3. Create/reuse Audio element
4. Set src and timepoints
5. Set `pendingPlay` flag
6. `canplay` event → actual `audio.play()`

---

## Pause Function

### Stopping Auto-Play

```typescript
const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
        audio.pause();
    }

    setState(prev => ({
        ...prev,
        isPlaying: false,
        intendedPlay: false  // Clears auto-play intent
    }));
}, []);
```

**Key point**: Sets `intendedPlay = false` to stop auto-advancement.

---

## Edge Cases

### Chapter End

```typescript
const handleEnded = useCallback(() => {
    const { intendedPlay } = stateRef.current;
    const currentIndex = currentSentenceIndexRef.current;

    setState(prev => ({ ...prev, isPlaying: false }));

    // Check if at chapter end
    if (currentIndex >= sentences.length - 1) {
        // Don't auto-advance past chapter end
        setState(prev => ({ ...prev, intendedPlay: false }));
        return;
    }

    // Normal auto-play
    if (intendedPlay) {
        goToSentence(currentIndex + 1);
    }
}, [sentences.length, goToSentence]);
```

### Error Handling

```typescript
const handleError = useCallback((error: Event) => {
    console.error('Audio playback error:', error);

    setState(prev => ({
        ...prev,
        isPlaying: false,
        intendedPlay: false,  // Stop auto-play on error
        pendingPlay: false
    }));

    // Could show error notification to user
}, []);
```

### User Jumps Ahead

```typescript
// User clicks sentence 50 while sentence 10 is playing
const goToSentence = useCallback((targetIndex: number) => {
    const wasPlaying = stateRef.current.isPlaying;

    // Stop current audio immediately
    const audio = audioRef.current;
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }

    // Navigate preserves play intent
    navigateToSentenceIndex(targetIndex, wasPlaying);
}, [navigateToSentenceIndex]);
```

**Preserves play intent**: If user was listening and jumps ahead, playback continues.

---

## Controlled Component Pattern

### Parent-Child State Management

```typescript
// Parent component (Reader)
const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

<SentenceAudioController
    currentSentenceIndex={currentSentenceIndex}
    onSentenceIndexChange={setCurrentSentenceIndex}
    sentences={sentences}
/>
```

**Inside useSentenceAudioController:**

```typescript
const useSentenceAudioController = (props: AudioControllerProps) => {
    const {
        currentSentenceIndex,      // Prop from parent
        onSentenceIndexChange,     // Callback to parent
        sentences
    } = props;

    // Use ref to track current index (avoid stale closures)
    const currentSentenceIndexRef = useRef(currentSentenceIndex);

    useEffect(() => {
        currentSentenceIndexRef.current = currentSentenceIndex;
    }, [currentSentenceIndex]);

    // Request index change from parent
    const navigateToSentenceIndex = useCallback((newIndex: number) => {
        onSentenceIndexChange(newIndex);
    }, [onSentenceIndexChange]);
};
```

**Why this pattern:**
- Single source of truth (parent state)
- No state duplication
- Parent can control navigation externally
- Child requests changes via callback

---

## Performance Considerations

### Avoiding Unnecessary Renders

```typescript
// Use refs for frequently accessed values
const stateRef = useRef(state);
const currentSentenceIndexRef = useRef(currentSentenceIndex);

useEffect(() => {
    stateRef.current = state;
}, [state]);

useEffect(() => {
    currentSentenceIndexRef.current = currentSentenceIndex;
}, [currentSentenceIndex]);

// Event handlers read from refs (no dependency on state)
const handleEnded = useCallback(() => {
    const { intendedPlay } = stateRef.current;
    const currentIndex = currentSentenceIndexRef.current;
    // ... rest of logic
}, []);  // Empty deps → stable reference
```

**Why refs:**
- Event handlers don't re-create on every state change
- Avoids removing/re-adding event listeners
- Stable callback references

---

## Testing Auto-Play

### Manual Test Flow

1. Load chapter with multiple sentences
2. Click play button
3. Wait for sentence to finish
4. Verify next sentence starts automatically
5. Click pause button
6. Verify auto-play stops
7. Click play again
8. Verify resumes from current position

### Debug Logging

```typescript
const handleEnded = useCallback(() => {
    const { intendedPlay } = stateRef.current;
    const currentIndex = currentSentenceIndexRef.current;

    console.log('Audio ended', {
        currentIndex,
        intendedPlay,
        hasNext: currentIndex < sentences.length - 1
    });

    if (intendedPlay && currentIndex < sentences.length - 1) {
        console.log('Auto-advancing to:', currentIndex + 1);
        goToSentence(currentIndex + 1);
    }
}, [sentences.length, goToSentence]);
```

---

## Summary

The auto-play system relies on:

1. **Intent Tracking**: `intendedPlay` flag distinguishes user play from programmatic play
2. **Event-Driven**: `ended` event triggers auto-advance
3. **Skip Logic**: Automatically skips non-playable chunks (images)
4. **Declarative**: Effect-based play triggering avoids race conditions
5. **Controlled Pattern**: Parent controls sentence index, child requests changes

**Key invariants:**
- `intendedPlay = true` → auto-advance on `ended` event
- `intendedPlay = false` → stop after current sentence
- `pendingPlay = true` → play when audio loads
- Navigation preserves play intent

This architecture creates a seamless listening experience with no gaps between sentences.
