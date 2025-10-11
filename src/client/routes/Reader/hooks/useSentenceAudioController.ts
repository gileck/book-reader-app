import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChapterClient, TextChunkClient } from '../../../../../src/apis/chapters/types';
import { generateTts } from '../../../../../src/apis/tts/client';
import type { TtsProvider } from '../../../../../src/common/tts/ttsUtils';

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
    initialWordIndex: number | null
): SentenceAudioApi {
    const [state, setState] = useState<SentenceAudioState>(getDefaultState());
    const stateRef = useRef(state);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timepointsRef = useRef<Array<{ time: number; wordIndex: number }>>([]);
    const cacheRef = useRef<Record<number, { src: string; timepoints: Array<{ time: number; wordIndex: number }> }>>({});

    useEffect(() => { stateRef.current = state; }, [state]);

    useEffect(() => {
        if (!audioRef.current) audioRef.current = new Audio();
    }, []);

    const sentences: TextChunkClient[] = useMemo(() => {
        const chunks = chapter?.content?.chunks || [];
        return chunks.filter(c => c.type === 'text' && (c.text || '').trim().length > 0);
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
        await loadSentence(currentSentenceIndex);
        const audio = audioRef.current;
        const entry = cacheRef.current[currentSentenceIndex];
        if (!audio || !entry) return;
        audio.src = entry.src;
        timepointsRef.current = entry.timepoints;
        try {
            await audio.play();
            update({ isPlaying: true, intendedPlay: true });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Playback failed';
            update({ ttsError: errorMessage, isPlaying: false });
        }
    }, [loadSentence, update]);

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
        if (currentSentenceIndex < sentences.length - 1) goToSentence(currentSentenceIndex + 1);
    }, [goToSentence, sentences.length]);

    const prevSentence = useCallback(() => {
        const { currentSentenceIndex } = stateRef.current;
        if (currentSentenceIndex > 0) goToSentence(currentSentenceIndex - 1);
    }, [goToSentence]);

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
