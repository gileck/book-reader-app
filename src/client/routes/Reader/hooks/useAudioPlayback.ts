import { useState, useEffect, useRef, useCallback } from 'react';
import { generateTts } from '../../../../apis/tts/client';
import type { ChapterClient } from '../../../../apis/chapters/types';
import type { TTSTimepoint, TtsErrorDetail } from '../../../../apis/tts/types';

interface AudioPlaybackState {
    currentChunkIndex: number;
    currentWordIndex: number;
    isPlaying: boolean;
    audioChunks: { [key: number]: { audio: HTMLAudioElement; timepoints: TTSTimepoint[] } };
    ttsError: TtsErrorDetail | null;
    ttsServiceAvailable: boolean;
}

const getDefaultAudioPlaybackState = (): AudioPlaybackState => ({
    currentChunkIndex: 0,
    currentWordIndex: 0,
    isPlaying: false,
    audioChunks: {},
    ttsError: null,
    ttsServiceAvailable: true
});

// CSS animation utilities
const generateWordAnimationCSS = (
    chunkIndex: number,
    timepoints: TTSTimepoint[],
    highlightColor: string,
    wordSpeedOffset: number,
    isPlaying: boolean = false
) => {
    const keyframesName = `word-highlight-chunk-${chunkIndex}`;

    // Generate CSS for each word with calculated duration
    const wordStyles = timepoints.map((tp, wordIndex) => {
        const startTime = tp.timeSeconds - (wordSpeedOffset / 1000);

        // Calculate duration: time until next word or 0.8s default for last word
        const nextTimepoint = timepoints[wordIndex + 1];
        const duration = nextTimepoint
            ? (nextTimepoint.timeSeconds - tp.timeSeconds)
            : 0.8; // Default duration for last word

        // Ensure minimum duration of 0.2s and maximum of 2s
        const safeDuration = Math.max(0.2, Math.min(duration, 2));

        return `
            .chunk-${chunkIndex}-word-${wordIndex}.css-animated {
                animation: ${keyframesName} ${safeDuration}s ease-out ${startTime}s both;
                animation-play-state: ${isPlaying ? 'running' : 'paused'};
            }
        `;
    }).join('\n');

    // More subtle keyframes that stay highlighted for the duration
    const keyframes = `
        @keyframes ${keyframesName} {
            0% { 
                background-color: transparent;
                color: inherit;
            }
            5% { 
                background-color: ${highlightColor || '#fff3e0'};
                color: inherit;
                border-radius: 3px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            85% { 
                background-color: ${highlightColor || '#fff3e0'};
                color: inherit;
                border-radius: 3px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            100% { 
                background-color: transparent;
                color: inherit;
                box-shadow: none;
            }
        }
    `;

    return keyframes + '\n' + wordStyles;
};

const generateChunkAnimationCSS = (
    chunkIndex: number,
    sentenceHighlightColor: string
) => {

    // Static highlighting without animation - instant feedback
    const chunkStyle = `
        .chunk-${chunkIndex}.current-chunk.css-animated {
            background-color: ${sentenceHighlightColor || '#f8f9fa'};
            border-radius: 0 4px 4px 0;
            padding: 4px 8px 4px 8px;
            margin-left: -3px;
            transition: none; /* No animation for instant feedback */
        }
    `;

    return chunkStyle;
};

const injectCSS = (css: string, id: string) => {
    // Remove existing style element if present
    const existingStyle = document.getElementById(id);
    if (existingStyle) {
        existingStyle.remove();
    }

    // Create and inject new style element
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
};



export const useAudioPlayback = (
    chapter: ChapterClient | null,
    selectedVoice: string,
    selectedProvider: string,
    playbackSpeed: number,
    wordSpeedOffset: number,
    currentChapterNumber: number,
    onChunkChange?: (chunkIndex: number) => void,
    highlightColor?: string,
    sentenceHighlightColor?: string
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

    const textChunks = chapter?.content.chunks.filter(chunk => chunk.type === 'text') || [];

    // Clear audio cache when voice changes or chapter changes
    useEffect(() => {
        // Stop all existing audio first
        Object.values(state.audioChunks).forEach(({ audio }) => {
            audio.pause();
            audio.currentTime = 0;
            audio.src = '';
            audio.load();
        });

        // Clear all CSS animations
        const existingWordStyles = document.querySelectorAll('style[id^="word-animation-chunk-"]');
        existingWordStyles.forEach(style => style.remove());
        const existingChunkStyles = document.querySelectorAll('style[id^="chunk-animation-chunk-"]');
        existingChunkStyles.forEach(style => style.remove());

        updateState({
            audioChunks: {},
            currentChunkIndex: 0,
            currentWordIndex: 0,
            isPlaying: false
        });
        pendingRequests.current.clear();
        failedChunks.current.clear();
    }, [selectedVoice, currentChapterNumber]);

    // Update CSS animation state when playing/paused
    useEffect(() => {
        const currentAudioData = state.audioChunks[state.currentChunkIndex];
        if (currentAudioData) {
            // Regenerate CSS for current chunk with updated play state
            const wordCSS = generateWordAnimationCSS(
                state.currentChunkIndex,
                currentAudioData.timepoints,
                highlightColor || '#ff9800',
                wordSpeedOffset,
                state.isPlaying
            );
            injectCSS(wordCSS, `word-animation-chunk-${state.currentChunkIndex}`);
        }
    }, [state.isPlaying, state.currentChunkIndex, state.audioChunks, highlightColor, wordSpeedOffset]);

    // Audio generation effect - triggered by chunk index changes only
    useEffect(() => {
        if (!chapter || state.currentChunkIndex >= textChunks.length) return;

        const fetchChunk = async (index: number) => {
            if (stateRef.current.audioChunks[index] || pendingRequests.current.has(index) || failedChunks.current.has(index)) {
                return;
            }

            const chunk = textChunks[index];
            if (!chunk) return;

            pendingRequests.current.add(index);

            try {
                const result = await generateTts({ text: chunk.text, voiceId: selectedVoice, provider: selectedProvider as 'google' | 'polly' | 'elevenlabs' });

                if (result.data?.success && result.data.audioContent && result.data.timepoints) {
                    const audio = new Audio(`data:audio/mp3;base64,${result.data.audioContent}`);

                    // Generate and inject CSS animations for this chunk
                    const wordCSS = generateWordAnimationCSS(
                        index,
                        result.data.timepoints,
                        highlightColor || '#ff9800',
                        wordSpeedOffset,
                        false
                    );
                    injectCSS(wordCSS, `word-animation-chunk-${index}`);

                    // Generate and inject chunk highlighting CSS
                    const chunkCSS = generateChunkAnimationCSS(
                        index,
                        sentenceHighlightColor || '#e3f2fd'
                    );
                    injectCSS(chunkCSS, `chunk-animation-chunk-${index}`);

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

        // Fetch current and next chunk
        fetchChunk(state.currentChunkIndex);
        if (state.currentChunkIndex < textChunks.length - 1) {
            fetchChunk(state.currentChunkIndex + 1);
        }
    }, [chapter, state.currentChunkIndex, textChunks, selectedVoice, selectedProvider, currentChapterNumber]);

    // Word highlighting logic
    useEffect(() => {
        const audioData = state.audioChunks[state.currentChunkIndex];
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
            updateState({ isPlaying: false, currentWordIndex: 0 });
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
    }, [state.audioChunks, state.currentChunkIndex, wordSpeedOffset, currentChapterNumber]);

    const onAudioFinished = useCallback(() => {
        if (state.currentChunkIndex < textChunks.length - 1) {
            const nextIndex = state.currentChunkIndex + 1;
            updateState({ currentChunkIndex: nextIndex });
            onChunkChange?.(nextIndex);

            setTimeout(() => {
                const nextAudioData = state.audioChunks[nextIndex];
                if (nextAudioData) {
                    nextAudioData.audio.playbackRate = playbackSpeed;
                    nextAudioData.audio.play();
                    updateState({ isPlaying: true });
                }
            }, 100);
        }
    }, [state.currentChunkIndex, state.audioChunks, textChunks.length, playbackSpeed, updateState, onChunkChange]);

    const handlePlay = useCallback(async () => {
        const audioData = state.audioChunks[state.currentChunkIndex];
        if (audioData) {
            audioData.audio.playbackRate = playbackSpeed;
            audioData.audio.play();
            updateState({ isPlaying: true });
        }
    }, [state.audioChunks, state.currentChunkIndex, playbackSpeed, updateState]);

    const handlePause = useCallback(() => {
        const audioData = state.audioChunks[state.currentChunkIndex];
        if (audioData) {
            audioData.audio.pause();
        }
        updateState({ isPlaying: false });
    }, [state.audioChunks, state.currentChunkIndex, updateState]);

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
        if (state.currentChunkIndex > 0) {
            const wasPlaying = state.isPlaying;
            handlePause();
            updateState({ currentWordIndex: 0 });
            if (state.audioChunks[state.currentChunkIndex]?.audio) {
                state.audioChunks[state.currentChunkIndex].audio.currentTime = 0;
            }

            const prevIndex = state.currentChunkIndex - 1;
            updateState({ currentChunkIndex: prevIndex });
            onChunkChange?.(prevIndex);

            if (wasPlaying) {
                const waitForAudio = () => {
                    const prevAudioData = state.audioChunks[prevIndex];
                    if (prevAudioData) {
                        prevAudioData.audio.currentTime = 0;
                        prevAudioData.audio.playbackRate = playbackSpeed;
                        prevAudioData.audio.play();
                        updateState({ isPlaying: true });
                    } else {
                        setTimeout(waitForAudio, 200);
                    }
                };
                setTimeout(waitForAudio, 100);
            }
        }
    }, [state.currentChunkIndex, state.isPlaying, state.audioChunks, playbackSpeed, handlePause, updateState, onChunkChange]);

    const handleNextChunk = useCallback(() => {
        if (state.currentChunkIndex < textChunks.length - 1) {
            const wasPlaying = state.isPlaying;
            handlePause();
            updateState({ currentWordIndex: 0 });
            if (state.audioChunks[state.currentChunkIndex]?.audio) {
                state.audioChunks[state.currentChunkIndex].audio.currentTime = 0;
            }
            const nextIndex = state.currentChunkIndex + 1;
            updateState({ currentChunkIndex: nextIndex });
            onChunkChange?.(nextIndex);

            if (wasPlaying) {
                const waitForAudio = () => {
                    const nextAudioData = state.audioChunks[nextIndex];
                    if (nextAudioData) {
                        nextAudioData.audio.currentTime = 0;
                        nextAudioData.audio.playbackRate = playbackSpeed;
                        nextAudioData.audio.play();
                        updateState({ isPlaying: true });
                    } else {
                        setTimeout(waitForAudio, 200);
                    }
                };
                setTimeout(waitForAudio, 100);
            }
        }
    }, [state.currentChunkIndex, state.isPlaying, state.audioChunks, textChunks.length, playbackSpeed, handlePause, updateState, onChunkChange]);

    const setCurrentChunkIndex = useCallback((index: number) => {
        updateState({ currentChunkIndex: index, currentWordIndex: 0 });
    }, [updateState]);

    const preloadChunk = useCallback(async (index: number) => {
        if (!chapter || index >= textChunks.length || index < 0) return;
        if (stateRef.current.audioChunks[index] || pendingRequests.current.has(index) || failedChunks.current.has(index)) return;

        const chunk = textChunks[index];
        if (!chunk) return;

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
    }, [chapter, textChunks, selectedVoice, selectedProvider]);

    const getWordStyle = useCallback((chunkIndex: number, wordIndex: number) => {
        // CSS handles highlighting for current chunk with loaded audio
        // Only provide fallback for chunks without loaded audio
        if (state.currentChunkIndex === chunkIndex && !state.audioChunks[chunkIndex]) {
            if (state.isPlaying && state.currentWordIndex === wordIndex) {
                return {
                    backgroundColor: highlightColor || '#fff3e0',
                    color: 'inherit',
                    transition: 'all 0.2s ease',
                    borderRadius: '3px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                };
            }
        }

        // Basic styling for all words
        return {
            backgroundColor: 'transparent',
            cursor: 'pointer',
            borderRadius: '3px'
        };
    }, [state.currentChunkIndex, state.isPlaying, state.currentWordIndex, highlightColor, state.audioChunks]);

    const getSentenceStyle = useCallback((chunkIndex: number) => {
        // CSS handles highlighting for current chunk with loaded audio
        // Only provide fallback styling for chunks without loaded audio
        if (state.currentChunkIndex === chunkIndex && !state.audioChunks[chunkIndex]) {
            return {
                backgroundColor: sentenceHighlightColor || '#f8f9fa',
                borderRadius: '0 4px 4px 0',
                padding: '4px 8px 4px 8px',
                marginLeft: '-3px'
            };
        }

        // Apply same padding to non-highlighted sentences to prevent layout shifts
        return {
            backgroundColor: 'transparent',
            padding: '4px 8px 4px 8px',
            marginLeft: '-3px'
        };
    }, [state.currentChunkIndex, sentenceHighlightColor, state.audioChunks]);

    // New function to get CSS class for sentence highlighting
    const getSentenceClassName = useCallback((chunkIndex: number) => {
        // For current chunk with loaded audio, use CSS animation
        if (state.currentChunkIndex === chunkIndex && state.audioChunks[chunkIndex]) {
            return `chunk-${chunkIndex} current-chunk css-animated`;
        }
        return '';
    }, [state.currentChunkIndex, state.audioChunks]);

    // New function to get CSS class for words
    const getWordClassName = useCallback((chunkIndex: number, wordIndex: number) => {
        // For current chunk with loaded audio, use CSS animation
        if (state.currentChunkIndex === chunkIndex && state.audioChunks[chunkIndex]) {
            return `chunk-${chunkIndex}-word-${wordIndex} css-animated`;
        }
        return '';
    }, [state.currentChunkIndex, state.audioChunks]);

    // Check if current chunk is loading
    const isCurrentChunkLoading = pendingRequests.current.has(state.currentChunkIndex);

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
        currentChunkIndex: state.currentChunkIndex,
        currentWordIndex: state.currentWordIndex,
        isPlaying: state.isPlaying,
        isCurrentChunkLoading,
        textChunks,
        handlePlay,
        handlePause,
        handleWordClick,
        handlePreviousChunk,
        handleNextChunk,
        setCurrentChunkIndex,
        preloadChunk,
        getWordStyle,
        getSentenceStyle,
        getWordClassName, // New function for CSS classes
        getSentenceClassName, // New function for sentence CSS classes
        ttsError: state.ttsError,
        ttsServiceAvailable: state.ttsServiceAvailable,
        clearTtsError,
        retryFailedChunk,
        isChunkFailed: (index: number) => failedChunks.current.has(index)
    };
}; 