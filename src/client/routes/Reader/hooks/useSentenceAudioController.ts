import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChapterClient, TextChunkClient } from '../../../../../src/apis/chapters/types';
import { generateTtsWithCache as generateTts } from '../../../tts/ttsCache';
import type { TtsProvider } from '../../../../../src/common/tts/ttsUtils';
import { WordHighlightingAPI } from '../utils/WordHighlightingAPI';

export interface SentenceAudioState {
    currentWordIndex: number;
    isPlaying: boolean;
    intendedPlay: boolean;
    ttsError: { message: string; sentenceIndex: number } | null;
    ttsServiceAvailable: boolean;
    isCurrentSentenceLoading: boolean;
}

export interface SentenceAudioApi {
    sentences: TextChunkClient[];
    currentSentenceIndex: number;
    currentWordIndex: number;
    isPlaying: boolean;
    isCurrentSentenceLoading: boolean;
    play: (userInitiated?: boolean) => void;
    pause: () => void;
    nextSentence: () => void;
    prevSentence: () => void;
    goToSentence: (index: number) => void;
    handleWordClick: (sentenceIndex: number, wordIndex: number) => void;
    preload: (sentenceIndex: number) => void | Promise<void>;
    retryFailed: (sentenceIndex: number) => void;
    clearError: () => void;
    ttsError: { message: string; sentenceIndex: number } | null;
    ttsServiceAvailable: boolean;
}

const getDefaultState = (): SentenceAudioState => ({
    currentWordIndex: 0,
    isPlaying: false,
    intendedPlay: false,
    ttsError: null,
    ttsServiceAvailable: true,
    isCurrentSentenceLoading: false
});

export function useSentenceAudioController(
    chapter: ChapterClient | null,
    selectedVoice: string,
    selectedProvider: TtsProvider,
    playbackSpeed: number,
    ttsEnabled: boolean,
    currentSentenceIndex: number,                      // ← PROP: Parent's state (single source of truth)
    onSentenceIndexChange: (index: number) => void,    // ← CALLBACK: Request parent state update
    initialWordIndex: number | null,
    highlightMode: 'word' | 'line' | 'off' = 'word',
    wordTimingOffset: number = 0
): SentenceAudioApi {
    /**
     * TRULY CONTROLLED COMPONENT PATTERN (like <input value={x} onChange={...}>)
     * 
     * Architecture:
     * 1. NO internal state for currentSentenceIndex - uses prop directly
     * 2. When controller needs to change index → calls onSentenceIndexChange(newIndex)
     * 3. Parent updates state → component re-renders with new prop value
     * 4. Single source of truth: parent's state.currentChunkIndex
     * 
     * Benefits:
     * - No state duplication
     * - No sync effects needed
     * - Simpler navigation (just update parent state)
     * - Impossible to have drift between controller and parent
     */

    // Internal state ONLY for: word index, playback state, loading, errors
    // Does NOT include currentSentenceIndex (that's controlled by parent)
    const [state, setState] = useState<SentenceAudioState>(() => {
        const defaultState = getDefaultState();
        return {
            ...defaultState,
            currentWordIndex: initialWordIndex ?? 0
        };
    });

    const stateRef = useRef(state);

    /**
     * IMPORTANT: currentSentenceIndexRef
     * 
     * Why we need this:
     * - Event listeners (handleEnded, handleError) are set up once in useEffect
     * - They capture the currentSentenceIndex value from when the effect ran (stale closure)
     * - Ref always has the latest value via .current without re-creating listeners
     * - Performance: Avoid removing/re-adding listeners on every sentence change
     * 
     * Pattern: Keep ref in sync with prop, access ref in event handlers
     */
    const currentSentenceIndexRef = useRef(currentSentenceIndex);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timepointsRef = useRef<Array<{ time: number; wordIndex: number }>>([]);
    const cacheRef = useRef<Record<number, { src: string; timepoints: Array<{ time: number; wordIndex: number }> }>>({});
    const previousHighlightRef = useRef<{ sentenceIndex: number; wordIndex: number } | null>(null);

    // Keep refs in sync with their values (cheap operations, no re-renders)
    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { currentSentenceIndexRef.current = currentSentenceIndex; }, [currentSentenceIndex]);

    // Use ALL chunks - sentence indices will match chunk indices (no mapping needed!)
    const sentences: TextChunkClient[] = useMemo(() => {
        return chapter?.content?.chunks || [];
    }, [chapter]);

    const update = useCallback((patch: Partial<SentenceAudioState>) => setState(prev => ({ ...prev, ...patch })), []);

    const loadSentence = useCallback(async (index: number, isCurrentSentence: boolean = false) => {
        if (!ttsEnabled || !chapter) return;

        // Check if already cached
        if (cacheRef.current[index]) {
            // If this is the current sentence and it's already cached, clear loading state
            if (isCurrentSentence) {
                update({ isCurrentSentenceLoading: false });
            }
            return;
        }

        const chunk = sentences[index];
        if (!chunk) return;

        // Skip TTS for images only - play both text and headers
        if (chunk.type === 'image' || !chunk.text?.trim()) return;

        // Mark as loading if this is the current sentence
        if (isCurrentSentence) {
            update({ isCurrentSentenceLoading: true });
        }

        try {
            const result = await generateTts({
                text: chunk.text,
                provider: selectedProvider,
                voiceId: selectedVoice
            });
            const data = result.data;
            if (!data || !data.success || !data.audioContent) {
                throw new Error(data?.error || 'TTS failed');
            }
            cacheRef.current[index] = {
                src: `data:audio/mp3;base64,${data.audioContent}`,
                timepoints: (data.timepoints || []).map((tp, i) => ({ time: tp.timeSeconds, wordIndex: i }))
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'TTS error';
            // Track which sentence this error is for - only show errors for current sentence
            update({ ttsError: { message: errorMessage, sentenceIndex: index } });
        } finally {
            // Clear loading state if this was the current sentence
            if (isCurrentSentence) {
                update({ isCurrentSentenceLoading: false });
            }
        }
    }, [chapter, selectedProvider, selectedVoice, sentences, ttsEnabled, update]);

    const play = useCallback(async (userInitiated: boolean = false) => {
        // IMPORTANT: Use ref to get latest value, not prop (avoids stale closure in setTimeout callbacks)
        // The prop value gets captured when the callback is created, but the ref always has current value
        const index = currentSentenceIndexRef.current;
        const chunk = sentences[index];

        // Skip playback for images only - play both text and headers
        if (!chunk || chunk.type === 'image' || !chunk.text?.trim()) {
            // Auto-advance to next playable chunk (text or header)
            const nextPlayableIndex = sentences.findIndex((c, i) =>
                i > index && (c.type === 'text' || c.type === 'header') && c.text?.trim()
            );
            if (nextPlayableIndex !== -1) {
                // CRITICAL: Update ref SYNCHRONOUSLY before state update
                // This ensures the recursive play() call sees the new index
                currentSentenceIndexRef.current = nextPlayableIndex;
                // CONTROLLED: Request parent to update state via callback
                onSentenceIndexChange(nextPlayableIndex);
                // Retry play with new index (preserve userInitiated flag)
                setTimeout(() => void play(userInitiated), 50);
            }
            return;
        }

        await loadSentence(index);
        const audio = audioRef.current;
        const entry = cacheRef.current[index];
        if (!audio || !entry) return;
        audio.src = entry.src;
        audio.playbackRate = playbackSpeed; // Apply playback speed
        timepointsRef.current = entry.timepoints;
        try {
            await audio.play();
            // Only clear errors on user-initiated play (not on auto-advance)
            if (userInitiated) {
                update({ isPlaying: true, intendedPlay: true, ttsError: null });
            } else {
                update({ isPlaying: true, intendedPlay: true });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Playback failed';

            // Filter expected browser errors that occur when changing audio source or autoplay
            // iOS Safari commonly throws "The operation was aborted" even when playback succeeds
            const lowerMessage = errorMessage.toLowerCase();
            const isExpectedBrowserError =
                lowerMessage.includes('interrupted') ||
                lowerMessage.includes('abort') ||  // Catches "aborted", "AbortError", etc.
                lowerMessage.includes('notallowederror'); // Autoplay policy errors

            if (!isExpectedBrowserError) {
                // Only report unexpected errors to the user
                update({ ttsError: { message: errorMessage, sentenceIndex: index }, isPlaying: false });
            }
            // For expected errors, just log them for debugging but don't show to user
            if (isExpectedBrowserError) {
                console.debug('Expected browser audio interruption:', errorMessage);
            }
        }
    }, [loadSentence, playbackSpeed, update, sentences, onSentenceIndexChange]);

    const pause = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        update({ isPlaying: false, intendedPlay: false });
    }, [update]);

    /**
     * Core navigation helper that handles audio state transitions consistently.
     * 
     * CONTROLLED COMPONENT FLOW:
     * 1. Stop current audio (internal state update)
     * 2. Reset word index (internal state update)
     * 3. Call onSentenceIndexChange(newIndex) → parent updates state
     * 4. Parent re-renders component with new currentSentenceIndex prop
     * 5. If audio was playing, resume at new index
     * 
     * This function coordinates:
     * - Internal state (word index, playback state)
     * - Parent state (sentence index via callback)
     * - Audio element (pause/play operations)
     */
    const navigateToSentenceIndex = useCallback((newIndex: number) => {
        const { intendedPlay } = stateRef.current;
        const clamped = Math.max(0, Math.min(sentences.length - 1, newIndex));

        // Stop current audio if playing
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            update({ isPlaying: false });
        }

        // Reset word index when navigating to new sentence
        update({ currentWordIndex: 0 });

        // CRITICAL: Update ref SYNCHRONOUSLY before triggering state update
        // This ensures play() will read the correct index even if React hasn't re-rendered yet.
        // The useEffect that syncs the ref runs AFTER React commits, which may be after the setTimeout fires.
        // By updating the ref here, we guarantee play() sees the new index.
        currentSentenceIndexRef.current = clamped;

        // CONTROLLED: Request parent to update sentence index
        // Parent will update state → component re-renders → prop changes
        onSentenceIndexChange(clamped);

        // If audio was playing, start playing the new chunk
        if (intendedPlay) {
            setTimeout(() => {
                void play();
            }, 50);
        }
    }, [sentences.length, update, play, onSentenceIndexChange]);

    const goToSentence = useCallback((index: number) => {
        navigateToSentenceIndex(index);
    }, [navigateToSentenceIndex]);

    const nextSentence = useCallback(() => {
        // Find next playable chunk (text or header)
        const nextPlayableIndex = sentences.findIndex((c, i) =>
            i > currentSentenceIndex && (c.type === 'text' || c.type === 'header') && c.text?.trim()
        );
        if (nextPlayableIndex !== -1) {
            navigateToSentenceIndex(nextPlayableIndex);
        }
    }, [sentences, navigateToSentenceIndex, currentSentenceIndex]);

    const prevSentence = useCallback(() => {
        // Find previous playable chunk (text or header)
        let foundIndex = -1;
        for (let i = currentSentenceIndex - 1; i >= 0; i--) {
            const chunk = sentences[i];
            if (chunk && (chunk.type === 'text' || chunk.type === 'header') && chunk.text?.trim()) {
                foundIndex = i;
                break;
            }
        }

        if (foundIndex !== -1) {
            navigateToSentenceIndex(foundIndex);
        }
    }, [sentences, navigateToSentenceIndex, currentSentenceIndex]);

    const handleWordClick = useCallback((sentenceIndex: number, wordIndex: number) => {
        goToSentence(sentenceIndex);
        update({ currentWordIndex: Math.max(0, wordIndex) });
    }, [goToSentence, update]);

    const preload = useCallback((sentenceIndex: number) => {
        return loadSentence(sentenceIndex);
    }, [loadSentence]);

    const retryFailed = useCallback((sentenceIndex: number) => {
        delete cacheRef.current[sentenceIndex];
        void loadSentence(sentenceIndex);
    }, [loadSentence]);

    const clearError = useCallback(() => {
        update({ ttsError: null });
    }, [update]);

    // Preload current sentence and next 3 sentences for smooth playback
    const hasInitiallyLoadedRef = useRef(false);
    const prevTtsEnabledRef = useRef(ttsEnabled);

    useEffect(() => {
        // Reset flag when TTS is toggled on (from false to true)
        if (ttsEnabled && !prevTtsEnabledRef.current) {
            hasInitiallyLoadedRef.current = false;
        }
        prevTtsEnabledRef.current = ttsEnabled;

        if (!hasInitiallyLoadedRef.current && sentences.length > 0 && ttsEnabled) {
            // On initial load: First load current + next sentence (priority)
            const currentLoad = loadSentence(currentSentenceIndex, true);
            const nextLoad = currentSentenceIndex + 1 < sentences.length
                ? loadSentence(currentSentenceIndex + 1)
                : Promise.resolve();
            hasInitiallyLoadedRef.current = true;

            // Then background prefetch sentences +2 and +3 after priority loads are done
            void Promise.all([currentLoad, nextLoad]).then(() => {
                const furtherIndexes = [
                    currentSentenceIndex + 2,
                    currentSentenceIndex + 3
                ].filter(i => i >= 0 && i < sentences.length);
                furtherIndexes.forEach(i => void loadSentence(i));
            });
        } else if (hasInitiallyLoadedRef.current && ttsEnabled) {
            // When moving to a new sentence: check if it's cached, if not mark as loading
            const isCached = !!cacheRef.current[currentSentenceIndex];
            if (!isCached) {
                void loadSentence(currentSentenceIndex, true);
            }

            // Preload the next sentence (rolling window)
            // (the 2 after should already be prefetched from previous moves)
            const nextIndex = currentSentenceIndex + 3;
            if (nextIndex >= 0 && nextIndex < sentences.length) {
                void loadSentence(nextIndex);
            }

            // Also preload previous sentence for backward navigation
            const prevIndex = currentSentenceIndex - 1;
            if (prevIndex >= 0 && prevIndex < sentences.length) {
                void loadSentence(prevIndex);
            }
        }
    }, [currentSentenceIndex, sentences.length, loadSentence, ttsEnabled]);

    // Reset and cleanup when chapter changes (but not on initial mount)
    const isInitialMount = useRef(true);
    const prevChapterNumber = useRef(chapter?.chapterNumber);

    useEffect(() => {
        const currentChapterNumber = chapter?.chapterNumber;

        // Skip reset on initial mount - lazy initialization already set correct position
        if (isInitialMount.current) {
            isInitialMount.current = false;
            prevChapterNumber.current = currentChapterNumber;
            return;
        }

        // Only reset if chapter actually changed
        if (currentChapterNumber !== prevChapterNumber.current) {
            hasInitiallyLoadedRef.current = false;

            // Stop any playing audio from previous chapter
            const audio = audioRef.current;
            if (audio) {
                audio.pause();
                audio.src = '';
                audio.currentTime = 0;
            }

            // Reset playback state to beginning of new chapter
            update({ isPlaying: false, intendedPlay: false, currentWordIndex: 0 });
            // CONTROLLED: Request parent to reset to first sentence of new chapter
            onSentenceIndexChange(0);

            // Clear audio cache for previous chapter
            cacheRef.current = {};
            timepointsRef.current = [];

            // Clear any word highlights
            const previous = previousHighlightRef.current;
            if (previous) {
                WordHighlightingAPI.unhighlightWord(previous.sentenceIndex, previous.wordIndex);
                previousHighlightRef.current = null;
            }

            prevChapterNumber.current = currentChapterNumber;
        }
    }, [chapter?.chapterNumber, update, onSentenceIndexChange]);

    // Update playback speed when it changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed]);

    // Clear audio cache when voice or provider changes
    // This ensures new voice settings take effect immediately
    const prevVoiceRef = useRef<string | undefined>(undefined);
    const prevProviderRef = useRef<TtsProvider | undefined>(undefined);

    useEffect(() => {
        // On first render with actual values, just store them
        if (prevVoiceRef.current === undefined && prevProviderRef.current === undefined) {
            prevVoiceRef.current = selectedVoice;
            prevProviderRef.current = selectedProvider;
            return;
        }

        // Voice or provider changed - clear all cached audio
        const hasChanged = prevVoiceRef.current !== selectedVoice || prevProviderRef.current !== selectedProvider;

        if (hasChanged) {
            const audio = audioRef.current;
            const wasPlaying = state.isPlaying;

            // Stop current audio if playing
            if (audio && wasPlaying) {
                audio.pause();
                audio.src = '';
                audio.currentTime = 0;
            }

            // Clear the entire audio cache
            cacheRef.current = {};
            timepointsRef.current = [];

            // Reset preloading flag to trigger fresh load
            hasInitiallyLoadedRef.current = false;

            // Update state - stop playback but preserve intendedPlay for auto-resume
            update({ isPlaying: false });

            // If audio was playing, reload and resume with new voice
            if (wasPlaying) {
                // Small delay to ensure cache is cleared
                setTimeout(() => {
                    void loadSentence(currentSentenceIndex, true).then(() => {
                        // Resume playback with new voice if user intended continuous play
                        if (stateRef.current.intendedPlay) {
                            void play();
                        }
                    });
                }, 50);
            }

            prevVoiceRef.current = selectedVoice;
            prevProviderRef.current = selectedProvider;
        }
    }, [selectedVoice, selectedProvider, state.isPlaying, loadSentence, play, update]);

    // Handle word highlighting when word index changes
    useEffect(() => {
        // Clear highlights when TTS is disabled
        if (!ttsEnabled) {
            const previous = previousHighlightRef.current;
            if (previous) {
                WordHighlightingAPI.unhighlightWord(previous.sentenceIndex, previous.wordIndex);
                previousHighlightRef.current = null;
            }
            return;
        }

        // Only apply word highlighting when highlightMode is 'word' and TTS is enabled
        if (highlightMode !== 'word') return;
        if (!state.isPlaying) return;

        const { currentWordIndex } = state;
        const previous = previousHighlightRef.current;

        // No mapping needed - sentence index IS chunk index!
        // Remove previous highlight
        if (previous) {
            WordHighlightingAPI.unhighlightWord(previous.sentenceIndex, previous.wordIndex);
        }

        // Add new highlight (sentence index = chunk index)
        WordHighlightingAPI.highlightWord(currentSentenceIndex, currentWordIndex);
        previousHighlightRef.current = { sentenceIndex: currentSentenceIndex, wordIndex: currentWordIndex };

        // Clean up when playback stops
        return () => {
            if (!stateRef.current.isPlaying && previousHighlightRef.current) {
                WordHighlightingAPI.unhighlightWord(
                    previousHighlightRef.current.sentenceIndex,
                    previousHighlightRef.current.wordIndex
                );
            }
        };
    }, [state.isPlaying, currentSentenceIndex, state.currentWordIndex, highlightMode, ttsEnabled]);

    // Setup audio element and event listeners
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }

        const audio = audioRef.current;

        // Handle timeupdate for word highlighting
        const handleTimeUpdate = () => {
            const currentTime = audio.currentTime;
            const timepoints = timepointsRef.current;
            if (timepoints.length === 0) return;

            // Apply word timing offset (convert ms to seconds)
            // Positive offset = highlight earlier, negative = highlight later
            const adjustedTime = currentTime + (wordTimingOffset / 1000);

            // Find the current word index based on timepoints
            let newWordIndex = 0;
            for (let i = 0; i < timepoints.length; i++) {
                if (adjustedTime >= timepoints[i].time) {
                    newWordIndex = timepoints[i].wordIndex;
                } else {
                    break;
                }
            }

            if (stateRef.current.currentWordIndex !== newWordIndex) {
                setState(prev => ({ ...prev, currentWordIndex: newWordIndex }));
            }
        };

        // Handle ended event for auto-play next sentence
        const handleEnded = () => {
            const { intendedPlay } = stateRef.current;

            /**
             * IMPORTANT: Use ref instead of prop for event handlers
             * 
             * Why: This event listener is set up once.
             * If we used the currentSentenceIndex prop directly, it would be stale
             * (captured from when the effect ran). The ref always has the latest value.
             * 
             * Example: User navigates from sentence 10 → 50 during playback
             * - Without ref: handleEnded would still see index 10 (stale)
             * - With ref: handleEnded sees index 50 (fresh) ✅
             */
            const currentIndex = currentSentenceIndexRef.current;
            setState(prev => ({ ...prev, isPlaying: false }));

            // Auto-play next sentence if user intended continuous play
            // Note: goToSentence → navigateToSentenceIndex already schedules play() if intendedPlay is true
            // No need to schedule another play() here (was causing duplicate/stale playback)
            if (intendedPlay && currentIndex < sentences.length - 1) {
                goToSentence(currentIndex + 1);
            }
        };

        // Handle audio element errors (especially iOS Safari quirks)
        const handleError = (event: Event) => {
            const target = event.target as HTMLAudioElement;
            const error = target.error;

            // iOS Safari often fires MEDIA_ERR_ABORTED (code 1) even when playback succeeds
            // This happens during source changes or autoplay scenarios - filter these out
            if (error?.code === 1) { // MEDIA_ERR_ABORTED
                console.debug('iOS Safari audio error (benign):', error.message);
                return;
            }

            // Filter out empty src errors - these happen during chapter transitions when we cleanup
            // An empty src will trigger MEDIA_ERR_SRC_NOT_SUPPORTED which is expected during cleanup
            if (audio.src === '' || audio.src === window.location.href) {
                console.debug('Audio error during cleanup (benign):', error?.message);
                return;
            }

            // Only report real errors that affect playback
            // MEDIA_ERR_NETWORK (2), MEDIA_ERR_DECODE (3), MEDIA_ERR_SRC_NOT_SUPPORTED (4)
            if (error && error.code >= 2) {
                const errorMessage = error.message || `Media error (code ${error.code})`;
                const currentIndex = currentSentenceIndexRef.current;
                update({
                    ttsError: { message: errorMessage, sentenceIndex: currentIndex },
                    isPlaying: false
                });
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
        };
    }, [sentences.length, goToSentence, play, wordTimingOffset, update]);

    /**
     * Return API
     * 
     * CONTROLLED COMPONENT: currentSentenceIndex comes directly from prop (parent state)
     * Not from internal state - we just clamp it and return it back to caller
     * This ensures parent and controller always agree on the current sentence
     */
    const clampedCurrentSentenceIndex = Math.max(0, Math.min(sentences.length - 1, currentSentenceIndex));

    return {
        sentences,
        currentSentenceIndex: clampedCurrentSentenceIndex,  // ← From prop, not internal state!
        currentWordIndex: state.currentWordIndex,           // ← From internal state
        isPlaying: state.isPlaying,                         // ← From internal state
        isCurrentSentenceLoading: state.isCurrentSentenceLoading,  // ← From internal state
        play,
        pause,
        nextSentence,      // Calls onSentenceIndexChange internally
        prevSentence,      // Calls onSentenceIndexChange internally
        goToSentence,      // Calls onSentenceIndexChange internally
        handleWordClick,
        preload,
        retryFailed,
        clearError,
        ttsError: state.ttsError,
        ttsServiceAvailable: state.ttsServiceAvailable
    };
}
