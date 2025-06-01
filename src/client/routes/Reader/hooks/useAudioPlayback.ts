import { useState, useEffect, useRef, useCallback } from 'react';
import { generateTts } from '../../../../apis/tts/client';
import type { ChapterClient } from '../../../../apis/chapters/types';
import type { TTSTimepoint } from '../../../../apis/tts/types';

interface AudioPlaybackState {
    currentChunkIndex: number;
    currentWordIndex: number;
    isPlaying: boolean;
    audioChunks: { [key: number]: { audio: HTMLAudioElement; timepoints: TTSTimepoint[] } };
}

const getDefaultAudioPlaybackState = (): AudioPlaybackState => ({
    currentChunkIndex: 0,
    currentWordIndex: 0,
    isPlaying: false,
    audioChunks: {}
});

export const useAudioPlayback = (
    chapter: ChapterClient | null,
    selectedVoice: string,
    playbackSpeed: number,
    wordSpeedOffset: number,
    currentChapterNumber: number,
    onChunkChange?: (chunkIndex: number) => void,
    highlightColor?: string,
    sentenceHighlightColor?: string
) => {
    const [state, setState] = useState(getDefaultAudioPlaybackState());
    const pendingRequests = useRef<Set<number>>(new Set());

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

        updateState({
            audioChunks: {},
            currentChunkIndex: 0,
            currentWordIndex: 0,
            isPlaying: false
        });
        pendingRequests.current.clear();
    }, [selectedVoice, currentChapterNumber]);

    // Audio generation effect
    useEffect(() => {
        if (!chapter || state.currentChunkIndex >= textChunks.length) return;

        const fetchChunk = async (index: number) => {
            if (state.audioChunks[index] || pendingRequests.current.has(index)) {
                return;
            }

            const chunk = textChunks[index];
            if (!chunk) return;

            pendingRequests.current.add(index);

            try {
                const result = await generateTts({ text: chunk.text, voiceId: selectedVoice });

                if (result.data?.success && result.data.audioContent && result.data.timepoints) {
                    const audio = new Audio(`data:audio/mp3;base64,${result.data.audioContent}`);

                    updateState({
                        audioChunks: {
                            ...state.audioChunks,
                            [index]: {
                                audio,
                                timepoints: result.data.timepoints
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Error generating audio:', error);
            } finally {
                pendingRequests.current.delete(index);
            }
        };

        // Fetch current and next chunk
        fetchChunk(state.currentChunkIndex);
        if (state.currentChunkIndex < textChunks.length - 1) {
            fetchChunk(state.currentChunkIndex + 1);
        }
    }, [state.currentChunkIndex, textChunks, selectedVoice, currentChapterNumber]);

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

            for (let i = 0; i < timepoints.length; i++) {
                if (currentTime >= timepoints[i].timeSeconds &&
                    (i === timepoints.length - 1 || currentTime < timepoints[i + 1].timeSeconds)) {
                    updateState({ currentWordIndex: i });
                    break;
                }
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
            if (state.audioChunks[state.currentChunkIndex]) {
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
            if (state.audioChunks[state.currentChunkIndex].audio) {
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
        if (state.audioChunks[index] || pendingRequests.current.has(index)) return;

        const chunk = textChunks[index];
        if (!chunk) return;

        pendingRequests.current.add(index);

        try {
            const result = await generateTts({ text: chunk.text, voiceId: selectedVoice });

            if (result.data?.success && result.data.audioContent && result.data.timepoints) {
                const audio = new Audio(`data:audio/mp3;base64,${result.data.audioContent}`);

                updateState({
                    audioChunks: {
                        ...state.audioChunks,
                        [index]: {
                            audio,
                            timepoints: result.data.timepoints
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error preloading audio chunk:', error);
        } finally {
            pendingRequests.current.delete(index);
        }
    }, [chapter, textChunks, selectedVoice, state.audioChunks, updateState]);

    const getWordStyle = useCallback((chunkIndex: number, wordIndex: number) => {
        if (state.currentChunkIndex === chunkIndex) {
            if (state.isPlaying && state.currentWordIndex === wordIndex) {
                return {
                    backgroundColor: highlightColor || '#ff9800',
                    color: '#ffffff',
                    transition: 'all 0.1s ease',
                    borderRadius: '3px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                };
            }

            return {
                backgroundColor: 'transparent',
                borderRadius: '3px'
            };
        }

        return {
            backgroundColor: 'transparent',
            cursor: 'pointer',
            borderRadius: '3px'
        };
    }, [state.currentChunkIndex, state.isPlaying, state.currentWordIndex, highlightColor, sentenceHighlightColor]);

    const getSentenceStyle = useCallback((chunkIndex: number) => {
        if (state.currentChunkIndex === chunkIndex) {
            return {
                backgroundColor: sentenceHighlightColor || '#e3f2fd',
                borderRadius: '4px',
                padding: '2px 4px'
            };
        }

        return {
            backgroundColor: 'transparent'
        };
    }, [state.currentChunkIndex, sentenceHighlightColor]);

    return {
        currentChunkIndex: state.currentChunkIndex,
        currentWordIndex: state.currentWordIndex,
        isPlaying: state.isPlaying,
        textChunks,
        handlePlay,
        handlePause,
        handleWordClick,
        handlePreviousChunk,
        handleNextChunk,
        setCurrentChunkIndex,
        preloadChunk,
        getWordStyle,
        getSentenceStyle
    };
}; 