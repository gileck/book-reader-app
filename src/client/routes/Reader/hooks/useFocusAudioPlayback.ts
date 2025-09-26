import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { generateTts } from '@/apis/tts/client';
import type { ChapterClient } from '@/apis/chapters/types';
import type { TTSTimepoint, TtsErrorDetail } from '@/apis/tts/types';

export interface FocusSentenceUnit {
    text: string;
    chunkIndex: number; // underlying chunk index for compatibility with bookmarks/progress
    wordStart: number;
    wordEnd: number;
    paragraphIndex?: number;
}

interface FocusAudioState {
    currentSentenceIndex: number;
    currentWordIndex: number;
    isPlaying: boolean;
    intendedPlay: boolean;
    audioCache: { [index: number]: { src: string; timepoints: TTSTimepoint[] } };
    ttsError: TtsErrorDetail | null;
    ttsServiceAvailable: boolean;
}

const getDefaultFocusAudioState = (): FocusAudioState => ({
    currentSentenceIndex: 0,
    currentWordIndex: 0,
    isPlaying: false,
    intendedPlay: false,
    audioCache: {},
    ttsError: null,
    ttsServiceAvailable: true
});

export interface FocusAudioApi {
    sentences: FocusSentenceUnit[];
    currentSentenceIndex: number;
    currentWordIndex: number;
    isPlaying: boolean;
    handlePlay: () => void;
    handlePause: () => void;
    handleNextSentence: () => void;
    handlePreviousSentence: () => void;
    handleWordClick: (sentenceIndex: number, wordIndex: number) => void;
    setCurrentSentenceIndex: (index: number) => void;
    preloadSentence: (index: number) => void | Promise<void>;
    ttsError: TtsErrorDetail | null;
    ttsServiceAvailable: boolean;
    clearTtsError: () => void;
    retryFailedSentence: (index: number) => void;
}

export const useFocusAudioPlayback = (
    chapter: ChapterClient | null,
    selectedVoice: string,
    selectedProvider: string,
    playbackSpeed: number,
    ttsEnabled: boolean,
    initialChunkIndex: number | null,
    initialWordIndex: number | null
): FocusAudioApi => {
    const [state, setState] = useState<FocusAudioState>(getDefaultFocusAudioState());
    const stateRef = useRef(state);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timepointsRef = useRef<TTSTimepoint[]>([]);
    const pendingRequests = useRef<Set<number>>(new Set());
    const failedSentences = useRef<Set<number>>(new Set());
    const shouldStartAtBeginningRef = useRef<boolean>(false);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Initialize a single Audio element used for all sentences
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }
    }, []);

    // Build sentences across all text chunks, merging short sentences to a minimum length
    const sentences: FocusSentenceUnit[] = useMemo(() => {
        if (!chapter) return [];
        const out: FocusSentenceUnit[] = [];
        const MIN_SENTENCE_WORDS = 15;
        for (let i = 0; i < chapter.content.chunks.length; i++) {
            const c = chapter.content.chunks[i];
            if (c.type !== 'text' || !c.text?.trim()) continue;
            const useSegmenter = typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === 'function';
            const parts: string[] = useSegmenter
                ? Array.from(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    new (Intl as unknown as { Segmenter: new (locale: string, options: { granularity: 'sentence' }) => any }).Segmenter('en', { granularity: 'sentence' }).segment(c.text),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (seg: any) => String(seg.segment)
                )
                : c.text.split(/(?<=[.!?])\s+/);

            let wordCursor = 0;
            let bufferText = '';
            let bufferWordCount = 0;
            let bufferStart = 0;

            const flushBuffer = () => {
                const text = bufferText.trim();
                if (!text) return;
                const start = bufferStart;
                const end = Math.max(start + bufferWordCount - 1, start);
                out.push({
                    text,
                    chunkIndex: i,
                    wordStart: start,
                    wordEnd: end,
                    paragraphIndex: c.paragraphIndex
                });
                bufferText = '';
                bufferWordCount = 0;
            };

            for (const part of parts) {
                const t = part.trim();
                if (!t) continue;
                const wc = t.split(/\s+/).filter(Boolean).length;

                if (bufferWordCount === 0) {
                    bufferStart = wordCursor;
                }

                bufferText += (bufferText ? ' ' : '') + t;
                bufferWordCount += wc;
                wordCursor += wc;

                // If buffer reached the minimum words or this is the last part, flush
                if (bufferWordCount >= MIN_SENTENCE_WORDS) {
                    flushBuffer();
                }
            }
            // Flush any remaining text for this chunk
            flushBuffer();
        }
        return out;
    }, [chapter]);

    // Initialize current sentence from chunk/word context if available
    useEffect(() => {
        if (!chapter || sentences.length === 0) return;
        if (initialChunkIndex == null) return;
        const wi = initialWordIndex ?? 0;
        let idx = sentences.findIndex(s => s.chunkIndex === initialChunkIndex && wi >= s.wordStart && wi <= s.wordEnd);
        if (idx < 0) idx = sentences.findIndex(s => s.chunkIndex === initialChunkIndex);
        setState(prev => ({ ...prev, currentSentenceIndex: Math.max(0, idx), currentWordIndex: 0 }));
    }, [chapter, sentences, initialChunkIndex, initialWordIndex]);

    const updateState = useCallback((partial: Partial<FocusAudioState>) => {
        setState(prev => ({ ...prev, ...partial }));
    }, []);

    const preloadSentence = useCallback(async (index: number) => {
        if (!chapter || index < 0 || index >= sentences.length) return;
        if (!ttsEnabled) return;
        if (stateRef.current.audioCache[index] || pendingRequests.current.has(index) || failedSentences.current.has(index)) return;

        const s = sentences[index];
        if (!s.text?.trim()) return;

        pendingRequests.current.add(index);
        try {
            const result = await generateTts({ text: s.text, voiceId: selectedVoice, provider: selectedProvider as 'google' | 'polly' | 'elevenlabs' });
            if (result.data?.success && result.data.audioContent && result.data.timepoints) {
                const src = `data:audio/mp3;base64,${result.data.audioContent}`;
                setState(prev => ({
                    ...prev,
                    audioCache: {
                        ...prev.audioCache,
                        [index]: { src, timepoints: result.data.timepoints! }
                    },
                    ttsError: null,
                    ttsServiceAvailable: true
                }));

                // If user intends to play this sentence, auto-start when ready
                const shouldAutoplay = stateRef.current.intendedPlay && stateRef.current.currentSentenceIndex === index;
                if (shouldAutoplay) {
                    try {
                        if (audioRef.current) {
                            audioRef.current.src = src;
                            audioRef.current.playbackRate = playbackSpeed;
                            if (shouldStartAtBeginningRef.current) {
                                audioRef.current.currentTime = 0;
                                shouldStartAtBeginningRef.current = false;
                            }
                            await audioRef.current.play();
                        }
                        updateState({ isPlaying: true, intendedPlay: false });
                    } catch {
                        // Ignore autoplay issues
                    }
                }
            } else if (!result.data?.success) {
                failedSentences.current.add(index);
                updateState({
                    ttsError: result.data?.errorDetail || {
                        code: 'UNKNOWN_ERROR',
                        message: result.data?.error || 'TTS generation failed',
                        timestamp: new Date().toISOString()
                    },
                    ttsServiceAvailable: false
                });
            }
        } catch {
            failedSentences.current.add(index);
        } finally {
            pendingRequests.current.delete(index);
        }
    }, [chapter, sentences, selectedVoice, selectedProvider, ttsEnabled, updateState]);

    // Preload current and neighbors when sentence changes
    useEffect(() => {
        const i = state.currentSentenceIndex;
        preloadSentence(i);
        preloadSentence(i + 1);
        preloadSentence(i - 1);
    }, [state.currentSentenceIndex, preloadSentence]);

    const setCurrentSentenceIndex = useCallback((index: number) => {
        if (index < 0 || index >= sentences.length) return;
        shouldStartAtBeginningRef.current = true;
        updateState({ currentSentenceIndex: index, currentWordIndex: 0 });
    }, [sentences.length, updateState]);

    // Attach listeners to the single audio element and update based on current sentence timepoints
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const handleTimeUpdate = () => {
            const t = audio.currentTime;
            const tps = timepointsRef.current;
            let closest = 0;
            for (let i = 0; i < tps.length; i++) {
                if (tps[i].timeSeconds <= t) closest = i; else break;
            }
            updateState({ currentWordIndex: closest });
        };
        const handleEnded = () => {
            const i = stateRef.current.currentSentenceIndex;
            if (i < sentences.length - 1) {
                const next = i + 1;
                shouldStartAtBeginningRef.current = true;
                setCurrentSentenceIndex(next);
                // If already loaded, play immediately
                const loaded = stateRef.current.audioCache[next];
                if (loaded) {
                    try {
                        audio.src = loaded.src;
                        timepointsRef.current = loaded.timepoints;
                        audio.playbackRate = playbackSpeed;
                        audio.currentTime = 0;
                        audio.play();
                        updateState({ isPlaying: true, intendedPlay: false, currentWordIndex: 0 });
                    } catch {
                        // Fallback to preload+intent
                        updateState({ intendedPlay: true });
                        preloadSentence(next);
                    }
                } else {
                    // Not loaded yet - preload and auto-start when ready
                    updateState({ intendedPlay: true });
                    preloadSentence(next);
                }
            } else {
                updateState({ isPlaying: false, intendedPlay: false, currentWordIndex: 0 });
            }
        };
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [updateState, sentences.length, setCurrentSentenceIndex, ttsEnabled, preloadSentence, playbackSpeed]);

    const handlePlay = useCallback(() => {
        if (!ttsEnabled) return;
        const entry = stateRef.current.audioCache[stateRef.current.currentSentenceIndex];
        const audio = audioRef.current;
        if (entry && audio) {
            // Switch source if needed
            if (audio.src !== entry.src) {
                audio.src = entry.src;
                timepointsRef.current = entry.timepoints;
            }
            audio.playbackRate = playbackSpeed;
            if (shouldStartAtBeginningRef.current) {
                audio.currentTime = 0;
                shouldStartAtBeginningRef.current = false;
            }
            audio.play();
            updateState({ isPlaying: true, intendedPlay: false });
        } else {
            updateState({ intendedPlay: true });
            // Ensure it gets preloaded; will auto-play if desired next time
            preloadSentence(stateRef.current.currentSentenceIndex);
        }
    }, [playbackSpeed, ttsEnabled, preloadSentence, updateState]);

    const handlePause = useCallback(() => {
        const audio = audioRef.current;
        if (audio) audio.pause();
        updateState({ isPlaying: false, intendedPlay: false });
    }, [updateState]);

    // note: setCurrentSentenceIndex defined above to satisfy dependency order for effects

    const handleNextSentence = useCallback(() => {
        const i = stateRef.current.currentSentenceIndex;
        if (i >= sentences.length - 1) return;
        const wasPlaying = stateRef.current.isPlaying;
        handlePause();
        shouldStartAtBeginningRef.current = true;
        const next = i + 1;
        setCurrentSentenceIndex(next);
        if (wasPlaying) {
            const loaded = stateRef.current.audioCache[next];
            if (loaded) {
                if (audioRef.current) {
                    audioRef.current.src = loaded.src;
                    timepointsRef.current = loaded.timepoints;
                    audioRef.current.playbackRate = playbackSpeed;
                    audioRef.current.currentTime = 0;
                    audioRef.current.play();
                }
                updateState({ isPlaying: true, intendedPlay: false, currentWordIndex: 0 });
            } else {
                updateState({ intendedPlay: true });
                preloadSentence(next);
                setTimeout(handlePlay, 150);
            }
        }
    }, [sentences.length, handlePause, setCurrentSentenceIndex, handlePlay, playbackSpeed, preloadSentence, updateState]);

    const handlePreviousSentence = useCallback(() => {
        const i = stateRef.current.currentSentenceIndex;
        if (i <= 0) return;
        const wasPlaying = stateRef.current.isPlaying;
        handlePause();
        shouldStartAtBeginningRef.current = true;
        const prev = i - 1;
        setCurrentSentenceIndex(prev);
        if (wasPlaying) {
            const loaded = stateRef.current.audioCache[prev];
            if (loaded) {
                if (audioRef.current) {
                    audioRef.current.src = loaded.src;
                    timepointsRef.current = loaded.timepoints;
                    audioRef.current.playbackRate = playbackSpeed;
                    audioRef.current.currentTime = 0;
                    audioRef.current.play();
                }
                updateState({ isPlaying: true, intendedPlay: false, currentWordIndex: 0 });
            } else {
                updateState({ intendedPlay: true });
                preloadSentence(prev);
                setTimeout(handlePlay, 150);
            }
        }
    }, [handlePause, setCurrentSentenceIndex, handlePlay, playbackSpeed, preloadSentence, updateState]);

    const handleWordClick = useCallback((sentenceIndex: number) => {
        // Always jump to sentence start when switching
        const isDifferent = sentenceIndex !== stateRef.current.currentSentenceIndex;
        if (isDifferent) {
            const wasPlaying = stateRef.current.isPlaying;
            if (wasPlaying) handlePause();
            shouldStartAtBeginningRef.current = true;
            setCurrentSentenceIndex(sentenceIndex);
            if (wasPlaying) {
                const loaded = stateRef.current.audioCache[sentenceIndex];
                if (loaded) {
                    if (audioRef.current) {
                        audioRef.current.src = loaded.src;
                        timepointsRef.current = loaded.timepoints;
                        audioRef.current.playbackRate = playbackSpeed;
                        audioRef.current.currentTime = 0;
                        audioRef.current.play();
                    }
                    updateState({ isPlaying: true, intendedPlay: false, currentWordIndex: 0 });
                } else {
                    updateState({ intendedPlay: true });
                    preloadSentence(sentenceIndex);
                    setTimeout(handlePlay, 120);
                }
            }
        } else {
            // Same sentence: reset to start
            const audio = audioRef.current;
            if (audio) {
                audio.currentTime = 0;
                updateState({ currentWordIndex: 0 });
            }
        }
    }, [handlePause, setCurrentSentenceIndex, preloadSentence, handlePlay, updateState, playbackSpeed]);

    const clearTtsError = useCallback(() => updateState({ ttsError: null }), [updateState]);
    const retryFailedSentence = useCallback((index: number) => {
        failedSentences.current.delete(index);
        updateState({ ttsError: null, ttsServiceAvailable: true });
    }, [updateState]);

    return {
        sentences,
        currentSentenceIndex: state.currentSentenceIndex,
        currentWordIndex: state.currentWordIndex,
        isPlaying: state.isPlaying,
        handlePlay,
        handlePause,
        handleNextSentence,
        handlePreviousSentence,
        handleWordClick,
        setCurrentSentenceIndex,
        preloadSentence,
        ttsError: state.ttsError,
        ttsServiceAvailable: state.ttsServiceAvailable,
        clearTtsError,
        retryFailedSentence
    };
};


