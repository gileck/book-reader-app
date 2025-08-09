import { useState, useEffect, useRef, useCallback } from 'react';
import { generateTts } from '../../../../apis/tts/client';
import type { ChapterClient } from '../../../../apis/chapters/types';
import type { TTSTimepoint, TtsErrorDetail } from '../../../../apis/tts/types';

interface AudioPlaybackState {
    currentWordIndex: number;
    isPlaying: boolean;
    intendedPlay: boolean; // Track if user wants to play but current chunk isn't ready
    audioChunks: { [key: number]: { audio: HTMLAudioElement; timepoints: TTSTimepoint[] } };
    ttsError: TtsErrorDetail | null;
    ttsServiceAvailable: boolean;
}

const getDefaultAudioPlaybackState = (): AudioPlaybackState => ({
    currentWordIndex: 0,
    isPlaying: false,
    intendedPlay: false,
    audioChunks: {},
    ttsError: null,
    ttsServiceAvailable: true
});

// DOM-BASED WORD HIGHLIGHTING SYSTEM
// Word highlighting runs outside React rendering flow via direct DOM manipulation

/**
 * DOM Highlighting API - manipulates word highlighting classes directly on DOM elements
 */
const WordHighlightingAPI = {


    // Add highlight class to a specific word
    highlightWord: (chunkIndex: number, wordIndex: number) => {
        const wordElement = document.querySelector(`[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`);
        if (wordElement) {
            wordElement.classList.add('highlight-word');
        }
    },

    // Remove highlight class from a specific word
    unhighlightWord: (chunkIndex: number, wordIndex: number) => {
        const wordElement = document.querySelector(`[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`);
        if (wordElement) {
            wordElement.classList.remove('highlight-word');
        }
    },

    // Clear all word highlights
    clearAllHighlights: () => {
        const highlightedWords = document.querySelectorAll('.highlight-word');
        highlightedWords.forEach(element => {
            element.classList.remove('highlight-word');
        });
    },



    // Check if a word element exists in DOM
    wordExists: (chunkIndex: number, wordIndex: number): boolean => {
        const wordElement = document.querySelector(`[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`);
        return !!wordElement;
    }
};


export const useAudioPlayback = (
    chapter: ChapterClient | null,
    currentChunkIndex: number | null,
    selectedVoice: string,
    selectedProvider: string,
    playbackSpeed: number,
    wordSpeedOffset: number,
    currentChapterNumber: number,
    onCurrentChunkChange: (chunkIndex: number) => void
) => {
    const [state, setState] = useState(getDefaultAudioPlaybackState());
    const pendingRequests = useRef<Set<number>>(new Set());
    const failedChunks = useRef<Set<number>>(new Set());
    const stateRef = useRef(state);

    // Keep stateRef in sync
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const updateState = useCallback((partialState: Partial<AudioPlaybackState>) => {
        setState(prev => ({ ...prev, ...partialState }));
    }, []);

    // SIMPLIFIED: Use all chunks with absolute indexing, handle non-text gracefully
    const allChunks = chapter?.content.chunks.map(chunk => ({
        ...chunk,
        // Treat headers as playable text; only images are non-playable
        text: chunk.type !== 'image' ? (chunk.text.replaceAll('\n', ' ') || '') : ''
    })) || [];

    // Helpers to find next/previous playable (text) chunk indices, skipping images and other non-text chunks
    const findNextTextChunkIndex = useCallback((fromIndexExclusive: number | null): number | null => {
        if (fromIndexExclusive === null) return null;
        for (let i = fromIndexExclusive + 1; i < allChunks.length; i++) {
            const candidate = allChunks[i];
            if (candidate && candidate.type !== 'image' && candidate.text.trim().length > 0) {
                return i;
            }
        }
        return null;
    }, [allChunks]);

    const findPreviousTextChunkIndex = useCallback((fromIndexExclusive: number | null): number | null => {
        if (fromIndexExclusive === null) return null;
        for (let i = fromIndexExclusive - 1; i >= 0; i--) {
            const candidate = allChunks[i];
            if (candidate && candidate.type !== 'image' && candidate.text.trim().length > 0) {
                return i;
            }
        }
        return null;
    }, [allChunks]);

    // Clear audio cache when voice changes or chapter changes
    useEffect(() => {
        // Stop all existing audio first
        Object.values(state.audioChunks).forEach(({ audio }) => {
            audio.pause();
            audio.currentTime = 0;
            audio.src = '';
            audio.load();
        });

        // Clear all highlighting on voice/chapter change

        updateState({
            audioChunks: {},
            currentWordIndex: 0,
            isPlaying: false,
            intendedPlay: false
        });
        pendingRequests.current.clear();
        failedChunks.current.clear();
    }, [selectedVoice, currentChapterNumber]);



    // Audio generation effect - triggered by chunk index changes only
    useEffect(() => {
        if (!chapter || currentChunkIndex === null || currentChunkIndex >= allChunks.length) return;

        const fetchChunk = async (index: number) => {
            if (stateRef.current.audioChunks[index] || pendingRequests.current.has(index) || failedChunks.current.has(index)) {
                return;
            }

            const chunk = allChunks[index];
            if (!chunk || chunk.type === 'image' || !chunk.text?.trim()) return; // Skip images and empty text

            pendingRequests.current.add(index);

            try {
                const result = await generateTts({ text: chunk.text, voiceId: selectedVoice, provider: selectedProvider as 'google' | 'polly' | 'elevenlabs' });

                if (result.data?.success && result.data.audioContent && result.data.timepoints) {
                    const audio = new Audio(`data:audio/mp3;base64,${result.data.audioContent}`);

                    setState(prev => {
                        const newState = {
                            ...prev,
                            audioChunks: {
                                ...prev.audioChunks,
                                [index]: {
                                    audio,
                                    timepoints: result.data.timepoints!
                                }
                            },
                            ttsError: null,
                            ttsServiceAvailable: true
                        };

                        // Auto-play if this is the current chunk and user intended to play
                        if (index === currentChunkIndex && prev.intendedPlay) {
                            setTimeout(() => {
                                audio.playbackRate = playbackSpeed;
                                audio.play();
                            }, 100);
                            newState.isPlaying = true;
                            newState.intendedPlay = false;
                        }

                        return newState;
                    });
                } else if (!result.data?.success) {
                    // Handle TTS generation failure - mark chunk as failed to prevent infinite retries
                    failedChunks.current.add(index);
                    console.error('TTS generation failed:', result.data?.error, result.data?.errorDetail);
                    updateState({
                        ttsError: result.data?.errorDetail || {
                            code: 'UNKNOWN_ERROR',
                            message: result.data?.error || 'TTS generation failed',
                            timestamp: new Date().toISOString()
                        },
                        ttsServiceAvailable: false
                    });
                }
            } catch (error) {
                // Mark chunk as failed to prevent infinite retries on network errors
                failedChunks.current.add(index);
                console.error('Error generating audio:', error);
                updateState({
                    ttsError: {
                        code: 'NETWORK_ERROR',
                        message: 'Network error while generating TTS audio. Please check your connection.',
                        timestamp: new Date().toISOString(),
                        originalError: error instanceof Error ? error.message : String(error)
                    },
                    ttsServiceAvailable: false
                });
            } finally {
                pendingRequests.current.delete(index);
            }
        };

        // Fetch current and next 2 chunks
        fetchChunk(currentChunkIndex);
        if (currentChunkIndex < allChunks.length - 1) {
            fetchChunk(currentChunkIndex + 1);
        }
        if (currentChunkIndex < allChunks.length - 2) {
            fetchChunk(currentChunkIndex + 2);
        }
    }, [chapter, currentChunkIndex, allChunks, selectedVoice, selectedProvider, currentChapterNumber]);

    // Word highlighting logic
    useEffect(() => {
        if (currentChunkIndex === null) return;

        const audioData = state.audioChunks[currentChunkIndex];
        if (!audioData) return;

        const { audio, timepoints } = audioData;

        const handleTimeUpdate = () => {
            if (timepoints.length === 0) return;
            const currentTime = audio.currentTime + (wordSpeedOffset / 1000);

            if (currentTime < timepoints[0].timeSeconds) {
                updateState({ currentWordIndex: 0 });
                return;
            }

            let closestIndex = -1;
            for (let i = 0; i < timepoints.length; i++) {
                if (currentTime >= timepoints[i].timeSeconds &&
                    (i === timepoints.length - 1 || currentTime < timepoints[i + 1].timeSeconds)) {
                    closestIndex = i;
                    break;
                }
            }

            if (closestIndex !== -1) {
                updateState({ currentWordIndex: closestIndex });
            }
        };

        const handlePlay = () => updateState({ isPlaying: true });
        const handlePause = () => updateState({ isPlaying: false });
        const handleEnded = () => {
            updateState({ isPlaying: false, currentWordIndex: 0, intendedPlay: false });
            onAudioFinished();
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [state.audioChunks, currentChunkIndex, wordSpeedOffset, currentChapterNumber]);

    const onAudioFinished = useCallback(() => {
        if (currentChunkIndex === null) return;
        const nextIndex = findNextTextChunkIndex(currentChunkIndex);
        if (nextIndex === null) return; // No more playable chunks

        onCurrentChunkChange(nextIndex);

        setTimeout(() => {
            const nextAudioData = state.audioChunks[nextIndex];
            if (nextAudioData) {
                nextAudioData.audio.playbackRate = playbackSpeed;
                nextAudioData.audio.play();
                updateState({ isPlaying: true, intendedPlay: false });
            } else {
                // Next playable chunk not yet ready; mark intent to auto-play when ready
                updateState({ intendedPlay: true });
            }
        }, 100);
    }, [currentChunkIndex, state.audioChunks, playbackSpeed, updateState, onCurrentChunkChange, findNextTextChunkIndex]);

    const handlePlay = useCallback(async () => {
        if (currentChunkIndex === null) return;

        // If current chunk isn't playable text, jump to the next playable one
        const currentChunk = allChunks[currentChunkIndex];
        let targetIndex = currentChunkIndex;
        if (!currentChunk || currentChunk.type === 'image' || currentChunk.text.trim().length === 0) {
            const nextTextIndex = findNextTextChunkIndex(currentChunkIndex);
            if (nextTextIndex === null) return; // Nothing to play
            targetIndex = nextTextIndex;
            onCurrentChunkChange(targetIndex);
        }

        const audioData = state.audioChunks[targetIndex];
        if (audioData) {
            audioData.audio.playbackRate = playbackSpeed;
            audioData.audio.play();
            updateState({ isPlaying: true, intendedPlay: false });
        } else {
            // Target playable chunk isn't ready yet; auto-play when ready
            updateState({ intendedPlay: true });
        }
    }, [state.audioChunks, currentChunkIndex, playbackSpeed, updateState, allChunks, findNextTextChunkIndex, onCurrentChunkChange]);

    const handlePause = useCallback(() => {
        if (currentChunkIndex === null) return;

        const audioData = state.audioChunks[currentChunkIndex];
        if (audioData) {
            audioData.audio.pause();
        }
        updateState({ isPlaying: false, intendedPlay: false });
    }, [state.audioChunks, currentChunkIndex, updateState]);

    const handleWordClick = useCallback((chunkIndex: number, wordIndex: number) => {
        const audioData = state.audioChunks[chunkIndex];
        if (!audioData) return;

        const targetTimepoint = audioData.timepoints[wordIndex];
        if (targetTimepoint) {
            audioData.audio.currentTime = targetTimepoint.timeSeconds;
            updateState({ currentWordIndex: wordIndex });
        }
    }, [state.audioChunks, updateState]);

    const handlePreviousChunk = useCallback(() => {
        if (currentChunkIndex === null) return;
        const targetIndex = findPreviousTextChunkIndex(currentChunkIndex);
        if (targetIndex === null) return;

        const wasPlaying = state.isPlaying;
        handlePause();
        updateState({ currentWordIndex: 0 });
        if (state.audioChunks[currentChunkIndex]?.audio) {
            state.audioChunks[currentChunkIndex].audio.currentTime = 0;
        }

        onCurrentChunkChange(targetIndex);

        if (wasPlaying) {
            const waitForAudio = () => {
                const prevAudioData = state.audioChunks[targetIndex];
                if (prevAudioData) {
                    prevAudioData.audio.currentTime = 0;
                    prevAudioData.audio.playbackRate = playbackSpeed;
                    prevAudioData.audio.play();
                    updateState({ isPlaying: true, intendedPlay: false });
                } else {
                    updateState({ intendedPlay: true });
                    setTimeout(waitForAudio, 200);
                }
            };
            setTimeout(waitForAudio, 100);
        }
    }, [currentChunkIndex, state.isPlaying, state.audioChunks, playbackSpeed, handlePause, updateState, onCurrentChunkChange, findPreviousTextChunkIndex]);

    const handleNextChunk = useCallback(() => {
        if (currentChunkIndex === null) return;
        const targetIndex = findNextTextChunkIndex(currentChunkIndex);
        if (targetIndex === null) return;

        const wasPlaying = state.isPlaying;
        handlePause();
        updateState({ currentWordIndex: 0 });
        if (state.audioChunks[currentChunkIndex]?.audio) {
            state.audioChunks[currentChunkIndex].audio.currentTime = 0;
        }
        onCurrentChunkChange(targetIndex);

        if (wasPlaying) {
            const waitForAudio = () => {
                const nextAudioData = state.audioChunks[targetIndex];
                if (nextAudioData) {
                    nextAudioData.audio.currentTime = 0;
                    nextAudioData.audio.playbackRate = playbackSpeed;
                    nextAudioData.audio.play();
                    updateState({ isPlaying: true, intendedPlay: false });
                } else {
                    updateState({ intendedPlay: true });
                    setTimeout(waitForAudio, 200);
                }
            };
            setTimeout(waitForAudio, 100);
        }
    }, [currentChunkIndex, state.isPlaying, state.audioChunks, playbackSpeed, handlePause, updateState, onCurrentChunkChange, findNextTextChunkIndex]);

    const setCurrentChunkIndex = useCallback((index: number) => {
        onCurrentChunkChange(index);
        updateState({ currentWordIndex: 0 });
    }, [onCurrentChunkChange, updateState]);

    const preloadChunk = useCallback(async (index: number) => {
        if (!chapter || index >= allChunks.length || index < 0) return;
        if (stateRef.current.audioChunks[index] || pendingRequests.current.has(index) || failedChunks.current.has(index)) return;

        const chunk = allChunks[index];
        if (!chunk || chunk.type === 'image' || !chunk.text?.trim()) return; // Skip images and empty text

        pendingRequests.current.add(index);

        try {
            const result = await generateTts({ text: chunk.text, voiceId: selectedVoice, provider: selectedProvider as 'google' | 'polly' | 'elevenlabs' });

            if (result.data?.success && result.data.audioContent && result.data.timepoints) {
                const audio = new Audio(`data:audio/mp3;base64,${result.data.audioContent}`);

                setState(prev => ({
                    ...prev,
                    audioChunks: {
                        ...prev.audioChunks,
                        [index]: {
                            audio,
                            timepoints: result.data.timepoints!
                        }
                    },
                    ttsError: null,
                    ttsServiceAvailable: true
                }));
            } else if (!result.data?.success) {
                failedChunks.current.add(index);
                console.error('TTS preload failed:', result.data?.error, result.data?.errorDetail);
                updateState({
                    ttsError: result.data?.errorDetail || {
                        code: 'UNKNOWN_ERROR',
                        message: result.data?.error || 'TTS generation failed',
                        timestamp: new Date().toISOString()
                    },
                    ttsServiceAvailable: false
                });
            }
        } catch (error) {
            failedChunks.current.add(index);
            console.error('Error preloading audio chunk:', error);
            updateState({
                ttsError: {
                    code: 'NETWORK_ERROR',
                    message: 'Network error while preloading TTS audio. Please check your connection.',
                    timestamp: new Date().toISOString(),
                    originalError: error instanceof Error ? error.message : String(error)
                },
                ttsServiceAvailable: false
            });
        } finally {
            pendingRequests.current.delete(index);
        }
    }, [chapter, allChunks, selectedVoice, selectedProvider]);

    // DOM-BASED HIGHLIGHTING SYSTEM - runs outside React rendering flow
    const previousHighlightRef = useRef<{ chunkIndex: number; wordIndex: number } | null>(null);
    const highlightIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Set up interval-based word highlighting (100ms intervals) - only when playing
    useEffect(() => {


        // Clear any existing interval
        if (highlightIntervalRef.current) {
            clearInterval(highlightIntervalRef.current);
            highlightIntervalRef.current = null;
        }

        // Only start highlighting interval when playing
        if (state.isPlaying && currentChunkIndex !== null) {
            highlightIntervalRef.current = setInterval(() => {
                const currentChunk = currentChunkIndex;
                const currentWord = state.currentWordIndex;

                // Only update DOM if word position has changed
                if (!previousHighlightRef.current ||
                    previousHighlightRef.current.chunkIndex !== currentChunk ||
                    previousHighlightRef.current.wordIndex !== currentWord) {

                    // Clear previous highlight
                    if (previousHighlightRef.current) {
                        WordHighlightingAPI.unhighlightWord(
                            previousHighlightRef.current.chunkIndex,
                            previousHighlightRef.current.wordIndex
                        );
                    }

                    // Add new highlight if word exists in DOM
                    if (WordHighlightingAPI.wordExists(currentChunk, currentWord)) {
                        WordHighlightingAPI.highlightWord(currentChunk, currentWord);
                        previousHighlightRef.current = { chunkIndex: currentChunk, wordIndex: currentWord };
                    } else {
                        previousHighlightRef.current = null;
                    }
                }
            }, 100); // Update every 100ms
        }

        // Cleanup on unmount
        return () => {
            if (highlightIntervalRef.current) {
                clearInterval(highlightIntervalRef.current);
                highlightIntervalRef.current = null;
            }
            // Keep highlight visible when paused - only clear on unmount
        };
    }, [currentChunkIndex, state.currentWordIndex, state.isPlaying]);

    // Cleanup highlights on component unmount
    useEffect(() => {
        return () => {
            WordHighlightingAPI.clearAllHighlights();
        };
    }, []);



    // Check if current chunk is loading
    const isCurrentChunkLoading = currentChunkIndex !== null && pendingRequests.current.has(currentChunkIndex);



    const clearTtsError = useCallback(() => {
        updateState({
            ttsError: null,
            ttsServiceAvailable: true
        });
    }, [updateState]);

    const retryFailedChunk = useCallback((index: number) => {
        failedChunks.current.delete(index);
        // Clear any TTS error to allow retry
        updateState({
            ttsError: null,
            ttsServiceAvailable: true
        });
    }, [updateState]);

    return {
        currentChunkIndex: currentChunkIndex,
        currentWordIndex: state.currentWordIndex,
        isPlaying: state.isPlaying,
        isCurrentChunkLoading,
        textChunks: allChunks, // Now contains all chunks with absolute indexing
        handlePlay,
        handlePause,
        handleWordClick,
        handlePreviousChunk,
        handleNextChunk,
        setCurrentChunkIndex,
        preloadChunk,

        ttsError: state.ttsError,
        ttsServiceAvailable: state.ttsServiceAvailable,
        clearTtsError,
        retryFailedChunk,
        isChunkFailed: (index: number) => failedChunks.current.has(index)
    };
}; 