import { fetchWithCache, useFetch } from "@/useFetch"
import { useEffect, useState, useMemo, useContext, useRef } from "react"
import { AudioPlayer } from "../components/AudioPlayer";
import { MainTextContent } from "../components/MainTextContent"
import EpubReader from "../components/EpubReader"
import { localStorageAPI } from "../localStorageAPI"
import { Box, Fab } from "@mui/material";
import { set } from "lodash";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useAppearanceSettings } from '../hooks/useAppearanceSettings';
import { useAppThemes } from '../hooks/useAppThemes';
import { SettingsContext } from '../contexts/SettingsContext';
import { useBookmarks } from '../hooks/useBookmarks';
import { AppContext } from "../AppContext";
import ReplyIcon from '@mui/icons-material/Reply';

const { getConfig, saveConfig } = localStorageAPI();
function splitLinesToChunks(lines) {
    const chunks = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('Image ')) {
            chunks.push(line);
        } else {
            chunks.push(...splitTextToSentences(line));
        }
    }
    return chunks;
}
function splitTextToSentences(text, minWords = 5) {
    const sentences = text.match(/[^.!?]+[.!?]/g) || [text]; // Split based on sentence-ending punctuation
    let result = [];
    let buffer = "";
    let wordCount = 0;

    for (let sentence of sentences) {
        const words = sentence.trim().split(/\s+/);
        wordCount += words.length;
        buffer += (buffer ? " " : "") + sentence.trim();

        if (wordCount >= minWords) {
            result.push(buffer);
            buffer = "";
            wordCount = 0;
        }
    }

    if (buffer.length > 0) {
        result.push(buffer);
    }

    return result;
}



export function Main() {
    const { settings, handleSettingsChange } = useAppearanceSettings();
    const { appTheme, contentTheme } = useAppThemes(settings);

    const { setRoute, params, bookmarks: { bookmarks, addBookmark, removeBookmark, isBookmarked }, readingHistory } = useContext(AppContext);

    const { chapterIndex: chapterIndexFromParams, chunkIndex: chunkIndexFromParams } = params || {};

    const [audioChunks, setAudioChunks] = useState({});

    const [currentChapterIndex, setCurrentChapterIndex] = useState(Number(chapterIndexFromParams) || getConfig('currentChapterIndex') || 0);
    const [currentChunkIndexByChapter, setCurrentChunkIndexByChapter] = useState({
        [currentChapterIndex]: Number(chunkIndexFromParams) || getConfig('currentChunkIndex') || 0
    });
    const currentChunkIndex = currentChunkIndexByChapter[currentChapterIndex] ?? getConfig('currentChunkIndex') ?? 0;

    useEffect(() => {
        if (chapterIndexFromParams !== undefined && chunkIndexFromParams !== undefined) {
            setTimeout(() => {
                setRoute('main', {});
            }, 2000);
        }
    }, [chapterIndexFromParams, chunkIndexFromParams]);


    const setCurrentChunkIndex = (index) => {
        // console.log({ index });

        setCurrentChunkIndexByChapter(prev => ({
            ...prev,
            [currentChapterIndex]: index
        }))
    }

    const [wordSpeed, setWordSpeed] = useState(getConfig('wordSpeed') || 0);
    const [playbackSpeed, setPlaybackSpeed] = useState(getConfig('playbackSpeed') || 1);
    const [selectedVoice, setSelectedVoice] = useState(getConfig('selectedVoice') || 'en-US-Neural2-A');


    useEffect(() => {
        setCurrentChunkIndex(currentChunkIndexByChapter[currentChapterIndex] || 0)
        setAudioChunks({})
    }, [currentChapterIndex])

    useEffect(() => {
        if (currentChunkIndex > 0 && !chapterIndexFromParams) {
            saveConfig('currentChunkIndex', currentChunkIndex);
        }
        if (!chapterIndexFromParams) {
            saveConfig('currentChapterIndex', currentChapterIndex);
        }
        saveConfig('wordSpeed', wordSpeed);
        saveConfig('playbackSpeed', playbackSpeed);
    }, [currentChunkIndex, currentChapterIndex, wordSpeed, playbackSpeed]);

    useEffect(() => {
        saveConfig('selectedVoice', selectedVoice);
    }, [selectedVoice]);

    function onWordSpeedChanged(speed) {
        setWordSpeed(speed);
    }
    const { data } = useFetch('/chapters.json', {
        disableFetchInBackground: true,
        shouldUsecache: false
    })

    const { data: images } = useFetch('/images.json', {
        disableFetchInBackground: true,
        shouldUsecache: false
    })

    function markImages(lines) {
        return lines.map(line => {
            if (line.startsWith('Image ')) {
                return line = line + ' [END_IMAGE]';
            }
            return line;
        })
    }

    const chapters = Object.entries(data).map(([key, value]) => ({ chapterName: key, lines: value }));

    const chunks = splitLinesToChunks(chapters[currentChapterIndex]?.lines || [])

    useEffect(() => {
        if (currentChunkIndex >= chunks.length) return;

        const fetchChunk = async (index) => {
            if (audioChunks[index]) return;

            const data = await fetchWithCache('/api/tts', {
                disableFetchInBackground: true,
                shouldUsecache: false,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: chunks[index],
                    voice: selectedVoice
                })
            });

            if (data?.audioContent && !audioChunks[index]) {
                setAudioChunks(prev => ({
                    ...prev,
                    [index]: {
                        audio: new Audio(`data:audio/mp3;base64,${data.audioContent}`),
                        timepoints: data.timepoints
                    }
                }));
            }
        };

        fetchChunk(currentChunkIndex);
        if (currentChunkIndex < chunks.length - 1) {
            fetchChunk(currentChunkIndex + 1);
        }
    }, [currentChunkIndex, chunks, selectedVoice]);

    useEffect(() => {
        const sentence = chunks[currentChunkIndex];
        if (sentence) {
            readingHistory.addHistory({
                chapterIndex: currentChapterIndex,
                chunkIndex: currentChunkIndex,
                sentence
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentChunkIndex]);

    const handleChunkSelect = (index) => {
        if (audioChunks[currentChunkIndex]?.audio) {
            audioChunks[currentChunkIndex].audio.pause();
            audioChunks[currentChunkIndex].audio.currentTime = 0;
        }
        setCurrentChunkIndex(index);
    };

    function onChunksFinished() {
    }

    function onAudioFinished() {
        if (currentChunkIndex < chunks.length - 1) {
            setCurrentChunkIndex(currentChunkIndex + 1)
        }
        if (audioChunks[currentChunkIndex]?.audio && currentChunkIndex === chunks.length - 1) {
            audioChunks[currentChunkIndex].audio.pause();
        }

    }

    const progressMetrics = {
        current: currentChunkIndex + 1,
        total: chunks.length,
        remaining: Math.max(0, chunks.length - currentChunkIndex),
        progress: chunks.length > 0 ? (currentChunkIndex / chunks.length) * 100 : 0
    };

    const handleAddBookmark = (name) => {
        const isCurrentlyBookmarked = isBookmarked(currentChapterIndex, currentChunkIndex);
        if (isCurrentlyBookmarked) {
            const bookmark = bookmarks.find(
                b => b.chapterIndex === currentChapterIndex && b.chunkIndex === currentChunkIndex
            );
            if (bookmark) {
                removeBookmark(bookmark.id);
            }
        } else {
            addBookmark(
                currentChapterIndex,
                currentChunkIndex,
                chapters[currentChapterIndex]?.chapterName,
                chunks[currentChunkIndex],
                name || `Bookmark ${bookmarks.length + 1}`
            );
        }
    };

    return (
        <ThemeProvider theme={appTheme}>
            <CssBaseline />
            <SettingsContext.Provider value={{ settings, handleSettingsChange }}>
                <div>
                    <div style={{
                        height: '70vh',
                        overflowY: 'auto',
                        borderBottom: '1px solid #eee'
                    }}>
                        <ThemeProvider theme={contentTheme}>
                            <MainTextContent
                                images={images}
                                currentChunkIndex={currentChunkIndex}
                                textChunks={chunks}
                                timepoints={audioChunks[currentChunkIndex]?.timepoints}
                                audio={audioChunks[currentChunkIndex]?.audio}
                                onChunkSelect={handleChunkSelect}
                                onChunksFinished={onChunksFinished}
                                wordSpeed={wordSpeed}
                                isBookmarked={isBookmarked}
                                currentChapterIndex={currentChapterIndex}
                            />
                        </ThemeProvider>
                    </div>
                    <div style={{
                        height: '22vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px',
                        paddingTop: '2px',
                        backgroundColor: '#282828',
                        color: 'white',
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
                    }}>
                        <AudioPlayer
                            isBookmarked={() => isBookmarked(currentChapterIndex, currentChunkIndex)}
                            displayedText={`Chapter ${currentChapterIndex}: ${chapters[currentChapterIndex]?.chapterName}`}
                            currentChapterIndex={currentChapterIndex}
                            currentChapterName={chapters[currentChapterIndex]?.chapterName}
                            onPrevChapter={() => setCurrentChapterIndex(prev => Math.max(0, prev - 1))}
                            onNextChapter={() => setCurrentChapterIndex(prev => Math.min(chapters.length - 1, prev + 1))}
                            playbackSpeed={playbackSpeed}
                            setPlaybackSpeed={setPlaybackSpeed}
                            onWordSpeedChanged={onWordSpeedChanged}
                            wordSpeed={wordSpeed}
                            audio={audioChunks[currentChunkIndex]?.audio}
                            onEnded={() => onAudioFinished()}
                            onPrev={() => setCurrentChunkIndex(currentChunkIndex - 1)}
                            onNext={() => setCurrentChunkIndex(currentChunkIndex + 1)}
                            selectedVoice={selectedVoice}
                            onVoiceChange={(voice) => {
                                setSelectedVoice(voice);
                                setAudioChunks({});
                            }}
                            progressMetrics={progressMetrics}
                            bookmarks={bookmarks}
                            onAddBookmark={handleAddBookmark}
                            onBookmarkSelect={(bookmark) => {
                                setCurrentChapterIndex(bookmark.chapterIndex);
                                setCurrentChunkIndex(bookmark.chunkIndex);
                            }}
                            onRemoveBookmark={removeBookmark}
                        />
                    </div>
                </div>
            </SettingsContext.Provider>
        </ThemeProvider>
    )
}


//// CODE FROM MainTextContent.js : 

setCurrentWordIndex(0);
const handleTimeUpdate = () => {
    if (timepoints.length === 0) return;
    const currentTime = audio.currentTime + wordSpeed
    // console.log(audio.currentTime, currentTime);

    let closestIndex = -1;

    if (currentTime < timepoints[0].timeSeconds) {
        setCurrentWordIndex(0);
        return
    }

    for (let i = closestIndex === -1 ? 0 : closestIndex; i < timepoints.length; i++) {
        if (currentTime >= timepoints[i].timeSeconds &&
            (i === timepoints.length - 1 || currentTime < timepoints[i + 1].timeSeconds)) {
            closestIndex = i;
            break;
        }
    }

    // console.log({ closestIndex });
    if (closestIndex !== -1) {
        setCurrentWordIndex(closestIndex);
    }
}

audio.addEventListener('timeupdate', handleTimeUpdate);
return () => audio.removeEventListener('timeupdate', handleTimeUpdate);