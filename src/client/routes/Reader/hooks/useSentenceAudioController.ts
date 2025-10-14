import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChapterClient, TextChunkClient } from '../../../../../src/apis/chapters/types';
import { generateTts } from '../../../../../src/apis/tts/client';
import type { TtsProvider } from '../../../../../src/common/tts/ttsUtils';
import { WordHighlightingAPI } from '../utils/WordHighlightingAPI';

export interface SentenceAudioState {
    currentSentenceIndex: number;
    currentWordIndex: number;
    isPlaying: boolean;
    intendedPlay: boolean;
    ttsError: string | null;
    ttsServiceAvailable: boolean;
}

export interface SentenceAudioApi {
    sentences: TextChunkClient[];
    currentSentenceIndex: number;
    currentWordIndex: number;
    isPlaying: boolean;
    play: () => void;
    pause: () => void;
    nextSentence: () => void;
    prevSentence: () => void;
    goToSentence: (index: number) => void;
    handleWordClick: (sentenceIndex: number, wordIndex: number) => void;
    preload: (sentenceIndex: number) => void | Promise<void>;
    retryFailed: (sentenceIndex: number) => void;
    ttsError: string | null;
    ttsServiceAvailable: boolean;
}

const getDefaultState = (): SentenceAudioState => ({
    currentSentenceIndex: 0,
    currentWordIndex: 0,
    isPlaying: false,
    intendedPlay: false,
    ttsError: null,
    ttsServiceAvailable: true
});

export function useSentenceAudioController(
    chapter: ChapterClient | null,
    selectedVoice: string,
    selectedProvider: TtsProvider,
    playbackSpeed: number,
    ttsEnabled: boolean,
    initialSentenceIndex: number | null,
    initialWordIndex: number | null,
    highlightMode: 'word' | 'line' | 'off' = 'word'
): SentenceAudioApi {
    const [state, setState] = useState<SentenceAudioState>(getDefaultState());
    const stateRef = useRef(state);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timepointsRef = useRef<Array<{ time: number; wordIndex: number }>>([]);
    const cacheRef = useRef<Record<number, { src: string; timepoints: Array<{ time: number; wordIndex: number }> }>>({});
    const previousHighlightRef = useRef<{ sentenceIndex: number; wordIndex: number } | null>(null);

    useEffect(() => { stateRef.current = state; }, [state]);

    // Use ALL chunks - sentence indices will match chunk indices (no mapping needed!)
    const sentences: TextChunkClient[] = useMemo(() => {
        return chapter?.content?.chunks || [];
    }, [chapter]);

    useEffect(() => {
        if (initialSentenceIndex !== null && Number.isFinite(initialSentenceIndex)) {
            setState(prev => ({ ...prev, currentSentenceIndex: Math.max(0, Math.min(sentences.length - 1, initialSentenceIndex as number)) }));
        }
        if (initialWordIndex !== null && Number.isFinite(initialWordIndex)) {
            setState(prev => ({ ...prev, currentWordIndex: Math.max(0, initialWordIndex as number) }));
        }
    }, [initialSentenceIndex, initialWordIndex, sentences.length]);

    const update = useCallback((patch: Partial<SentenceAudioState>) => setState(prev => ({ ...prev, ...patch })), []);

    const loadSentence = useCallback(async (index: number) => {
        if (!ttsEnabled || !chapter) return;
        if (cacheRef.current[index]) return;
        const chunk = sentences[index];
        if (!chunk) return;

        // Skip TTS for non-text chunks (headers, images)
        if (chunk.type !== 'text' || !chunk.text?.trim()) return;

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
            update({ ttsError: errorMessage });
        }
    }, [chapter, selectedProvider, selectedVoice, sentences, ttsEnabled, update]);

    const play = useCallback(async () => {
        const { currentSentenceIndex } = stateRef.current;
        const chunk = sentences[currentSentenceIndex];

        // Skip playback for non-text chunks
        if (!chunk || chunk.type !== 'text' || !chunk.text?.trim()) {
            // Auto-advance to next text chunk
            const nextTextIndex = sentences.findIndex((c, i) => i > currentSentenceIndex && c.type === 'text' && c.text?.trim());
            if (nextTextIndex !== -1) {
                update({ currentSentenceIndex: nextTextIndex });
                // Retry play with new index
                setTimeout(() => void play(), 50);
            }
            return;
        }

        await loadSentence(currentSentenceIndex);
        const audio = audioRef.current;
        const entry = cacheRef.current[currentSentenceIndex];
        if (!audio || !entry) return;
        audio.src = entry.src;
        audio.playbackRate = playbackSpeed; // Apply playback speed
        timepointsRef.current = entry.timepoints;
        try {
            await audio.play();
            update({ isPlaying: true, intendedPlay: true });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Playback failed';
            update({ ttsError: errorMessage, isPlaying: false });
        }
    }, [loadSentence, playbackSpeed, update, sentences]);

    const pause = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        update({ isPlaying: false, intendedPlay: false });
    }, [update]);

    const goToSentence = useCallback((index: number) => {
        const clamped = Math.max(0, Math.min(sentences.length - 1, index));
        update({ currentSentenceIndex: clamped, currentWordIndex: 0 });
    }, [sentences.length, update]);

    const nextSentence = useCallback(() => {
        const { currentSentenceIndex } = stateRef.current;
        // Find next text chunk
        const nextTextIndex = sentences.findIndex((c, i) =>
            i > currentSentenceIndex && c.type === 'text' && c.text?.trim()
        );
        if (nextTextIndex !== -1) {
            goToSentence(nextTextIndex);
        }
    }, [goToSentence, sentences]);

    const prevSentence = useCallback(() => {
        const { currentSentenceIndex } = stateRef.current;
        // Find previous text chunk
        for (let i = currentSentenceIndex - 1; i >= 0; i--) {
            if (sentences[i]?.type === 'text' && sentences[i]?.text?.trim()) {
                goToSentence(i);
                break;
            }
        }
    }, [goToSentence, sentences]);

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

    useEffect(() => {
        const { currentSentenceIndex } = stateRef.current;
        const windowIndexes = [currentSentenceIndex - 1, currentSentenceIndex + 1].filter(i => i >= 0 && i < sentences.length);
        windowIndexes.forEach(i => void loadSentence(i));
    }, [state.currentSentenceIndex, sentences.length, loadSentence]);

    // Update playback speed when it changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed]);

    // Handle word highlighting when word index changes
    useEffect(() => {
        // Only apply word highlighting when highlightMode is 'word'
        if (highlightMode !== 'word') return;
        if (!state.isPlaying) return;

        const { currentSentenceIndex, currentWordIndex } = state;
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
    }, [state.isPlaying, state.currentSentenceIndex, state.currentWordIndex, highlightMode]);

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

            // Find the current word index based on timepoints
            let newWordIndex = 0;
            for (let i = 0; i < timepoints.length; i++) {
                if (currentTime >= timepoints[i].time) {
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
            const { currentSentenceIndex, intendedPlay } = stateRef.current;
            setState(prev => ({ ...prev, isPlaying: false }));

            // Auto-play next sentence if user intended continuous play
            if (intendedPlay && currentSentenceIndex < sentences.length - 1) {
                goToSentence(currentSentenceIndex + 1);
                // Play next sentence after a brief delay
                setTimeout(() => {
                    if (stateRef.current.intendedPlay) {
                        void play();
                    }
                }, 100);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [sentences.length, goToSentence, play]);

    return {
        sentences,
        currentSentenceIndex: state.currentSentenceIndex,
        currentWordIndex: state.currentWordIndex,
        isPlaying: state.isPlaying,
        play,
        pause,
        nextSentence,
        prevSentence,
        goToSentence,
        handleWordClick,
        preload,
        retryFailed,
        ttsError: state.ttsError,
        ttsServiceAvailable: state.ttsServiceAvailable
    };
}
