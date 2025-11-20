import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { ChunkRenderer } from './ChunkRenderer';
import { TranslationPopup } from './TranslationPopup';
import { SentenceContextMenu } from './SentenceContextMenu';
import { useEnhancedNavigation } from '../hooks/useEnhancedNavigation';
import { useParagraphGrouping } from '../hooks/useParagraphGrouping';
import { translateText } from '@/apis/translation/client';
import { useSettings } from '@/client/settings/SettingsContext';
import type { SentenceChunk, ParagraphGroupMeta } from '../types';
import type { ChapterClient } from '../../../../apis/chapters/types';
import type { BookClient } from '../../../../apis/books/types';

interface ReaderContentProps {
    chapter: ChapterClient;
    book: BookClient;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    onNavigateToChapter: (chapterNumber: number) => void;
    onNavigateToChunk: (chunkIndex: number) => void;
    onNavigateToBookmark: (chapterNumber: number, chunkIndex: number) => void;
    onChunkClick?: (chunkIndex: number) => void;
    onAskQuestion?: (chunkIndex: number) => void;
    currentChunkIndex: number;
    // Optional sentence-level data (Phase 4)
    sentences?: SentenceChunk[];
    paragraphGroups?: ParagraphGroupMeta[];
    // Theme settings - applied only to reader content
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColor: string;
    highlightColor: string;
    sentenceHighlightColor: string;
    chunkSpacing: number;
    bionicReadingEnabled?: boolean;
    // Note: Word highlighting now handled outside React via DOM manipulation
    // Note: Sentence highlighting done directly in JSX - much simpler!
}

export const ReaderContent: React.FC<ReaderContentProps> = ({
    chapter,
    book,
    scrollContainerRef,
    onNavigateToChapter,
    onNavigateToChunk,
    onNavigateToBookmark,
    onChunkClick,
    onAskQuestion,
    currentChunkIndex,
    fontSize,
    lineHeight,
    fontFamily,
    textColor,
    highlightColor,
    sentenceHighlightColor,
    chunkSpacing,
    bionicReadingEnabled = false
}) => {
    const readerContentRef = useRef<HTMLDivElement>(null);
    const [cssVarsApplied, setCssVarsApplied] = useState(false);
    const { userSettings, updateUserSettings } = useSettings();

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        chunkIndex: number;
        position: { x: number; y: number };
    } | null>(null);

    // Translation state
    const [translationPopup, setTranslationPopup] = useState<{
        chunkIndex: number;
        position: { x: number; y: number };
    } | null>(null);
    const [translations, setTranslations] = useState<Record<number, string>>({});
    const [translationLanguages, setTranslationLanguages] = useState<Record<number, string>>({});
    const [translationCosts, setTranslationCosts] = useState<Record<number, number>>({});
    const [translationFromCache, setTranslationFromCache] = useState<Record<number, boolean>>({});
    const [freeTierUsage, setFreeTierUsage] = useState<Record<number, { used: number; total: number; remaining: number; percentUsed: number }>>({});
    const [isTranslating, setIsTranslating] = useState(false);

    // Set CSS variables on the reader content container only
    useEffect(() => {
        setCssVarsApplied(false); // Reset first
        const container = readerContentRef.current;
        if (container) {
            // Apply CSS variables
            container.style.setProperty('--reader-font-size', `${fontSize}rem`);
            container.style.setProperty('--reader-line-height', lineHeight.toString());
            container.style.setProperty('--reader-font-family', fontFamily);
            container.style.setProperty('--reader-text-color', textColor);
            container.style.setProperty('--word-highlight-color', highlightColor);
            container.style.setProperty('--sentence-highlight-color', sentenceHighlightColor);

            // Use requestAnimationFrame to ensure CSS variables are applied before showing content
            requestAnimationFrame(() => {
                setTimeout(() => {
                    setCssVarsApplied(true);
                }, 300);
            });
        }
    }, [fontSize, lineHeight, fontFamily, textColor, highlightColor, sentenceHighlightColor]);

    // Handle double-click on chunk - show context menu
    const handleChunkDoubleClick = useCallback((chunkIndex: number, event: React.MouseEvent) => {
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        setContextMenu({
            chunkIndex,
            position: {
                x: rect.left + rect.width / 2 - 110, // Center the menu
                y: rect.bottom + 5, // Below the clicked sentence
            },
        });
    }, []);

    // Handle translate action from context menu
    const handleTranslateFromMenu = useCallback(() => {
        if (!contextMenu) return;
        
        // Transfer context menu position to translation popup
        setTranslationPopup({
            chunkIndex: contextMenu.chunkIndex,
            position: contextMenu.position,
        });
        setContextMenu(null);
    }, [contextMenu]);

    // Handle set current sentence action from context menu
    const handleSetCurrentSentence = useCallback(() => {
        if (!contextMenu) return;
        
        onNavigateToChunk(contextMenu.chunkIndex);
        setContextMenu(null);
    }, [contextMenu, onNavigateToChunk]);

    // Handle ask question action from context menu
    const handleAskQuestionFromMenu = useCallback(() => {
        if (!contextMenu) return;
        
        if (onAskQuestion) {
            onAskQuestion(contextMenu.chunkIndex);
        }
        setContextMenu(null);
    }, [contextMenu, onAskQuestion]);

    // Handle closing context menu
    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    // Handle translation request for multiple sentences
    const handleTranslate = useCallback(
        async (targetLanguage: string, sentenceCount: number) => {
            if (!translationPopup) return;

            const startChunkIndex = translationPopup.chunkIndex;
            
            // Find consecutive text chunks starting from the clicked chunk
            const allChunks = chapter.content.chunks;
            const startIdx = allChunks.findIndex(c => c.index === startChunkIndex);
            
            if (startIdx === -1) {
                console.error('Start chunk not found');
                return;
            }

            // Collect the next N text chunks
            const chunksToTranslate = [];
            let textChunkCount = 0;
            
            for (let i = startIdx; i < allChunks.length && textChunkCount < sentenceCount; i++) {
                const chunk = allChunks[i];
                if (chunk.type === 'text') {
                    chunksToTranslate.push(chunk);
                    textChunkCount++;
                }
            }

            if (chunksToTranslate.length === 0) {
                console.error('No text chunks found to translate');
                return;
            }

            console.log(`[Translation] Translating ${chunksToTranslate.length} sentences`);
            setIsTranslating(true);

            try {
                // Translate all chunks in parallel
                const translationPromises = chunksToTranslate.map(chunk =>
                    translateText({
                        text: chunk.text,
                        targetLanguage,
                    }).then(result => ({ chunkIndex: chunk.index, result }))
                );

                const results = await Promise.all(translationPromises);
                
                // Process all results
                let lastFreeTierUsage: { used: number; total: number; remaining: number; percentUsed: number } | null = null;
                
                results.forEach(({ chunkIndex, result }) => {
                    if (result.data?.success && result.data.translatedText) {
                        // Save translation
                        setTranslations(prev => ({
                            ...prev,
                            [chunkIndex]: result.data!.translatedText,
                        }));
                        
                        // Save translation language
                        setTranslationLanguages(prev => ({
                            ...prev,
                            [chunkIndex]: targetLanguage,
                        }));

                        // Save translation cost
                        if (result.data.cost !== undefined) {
                            setTranslationCosts(prev => ({
                                ...prev,
                                [chunkIndex]: result.data.cost!,
                            }));
                        }

                        // Save cache status
                        if (result.data.fromCache !== undefined) {
                            setTranslationFromCache(prev => ({
                                ...prev,
                                [chunkIndex]: result.data.fromCache!,
                            }));
                        }

                        // Save free tier usage (use the last one for all)
                        if (result.data.freeTierUsage) {
                            lastFreeTierUsage = result.data.freeTierUsage;
                        }
                    } else {
                        console.error('Translation failed for chunk', chunkIndex, ':', result.data?.error);
                    }
                });

                // Update free tier usage for all translated chunks
                if (lastFreeTierUsage) {
                    const usage = lastFreeTierUsage;
                    chunksToTranslate.forEach(chunk => {
                        setFreeTierUsage(prev => ({
                            ...prev,
                            [chunk.index]: usage,
                        }));
                    });
                }

                // Save language preference immediately (always update)
                console.log('[Translation] Saving language preference:', targetLanguage);
                await updateUserSettings({ lastTranslationLanguage: targetLanguage });
            } catch (error) {
                console.error('Translation error:', error);
            } finally {
                setIsTranslating(false);
                setTranslationPopup(null);
            }
        },
        [translationPopup, chapter.content.chunks, updateUserSettings]
    );

    // Handle closing translation popup
    const handleCloseTranslationPopup = useCallback(() => {
        setTranslationPopup(null);
    }, []);

    // Toggle translation view for a chunk
    const handleToggleTranslation = useCallback((chunkIndex: number) => {
        setTranslations(prev => {
            const newTranslations = { ...prev };
            delete newTranslations[chunkIndex];
            return newTranslations;
        });
        setTranslationLanguages(prev => {
            const newLanguages = { ...prev };
            delete newLanguages[chunkIndex];
            return newLanguages;
        });
        setTranslationCosts(prev => {
            const newCosts = { ...prev };
            delete newCosts[chunkIndex];
            return newCosts;
        });
        setTranslationFromCache(prev => {
            const newCache = { ...prev };
            delete newCache[chunkIndex];
            return newCache;
        });
        setFreeTierUsage(prev => {
            const newUsage = { ...prev };
            delete newUsage[chunkIndex];
            return newUsage;
        });
    }, []);

    // Enhanced navigation for link handling
    const { handleLinkNavigation } = useEnhancedNavigation({
        chapter,
        currentChapterNumber: chapter.chapterNumber,
        onNavigateToChapter,
        onNavigateToChunk,
        onNavigateToBookmark
    });

    // Group chunks by paragraphIndex
    const paragraphGroups = useParagraphGrouping(chapter.content.chunks);

    // Error handling for corrupted data
    if (paragraphGroups.length === 0) {
        return (
            <Box sx={{ mt: 4, p: 2, backgroundColor: 'error.light', borderRadius: 1 }} ref={scrollContainerRef}>
                <Box sx={{ color: 'error.contrastText' }}>
                    Error: Paragraph grouping failed. Missing or corrupted paragraphIndex data.
                </Box>
            </Box>
        );
    }

    // Render content using ChunkRenderer - wait for CSS vars to be applied
    return (
        <Box
            ref={readerContentRef}
            sx={{
                mt: 4,
                // Apply theme settings directly to the reader content container
                fontSize: 'var(--reader-font-size, 1rem)',
                lineHeight: 'var(--reader-line-height, 1.5)',
                fontFamily: 'var(--reader-font-family, Inter, system-ui, sans-serif)',
                color: 'var(--reader-text-color, inherit)',
                // Hide content until CSS variables are applied to prevent flicker
                opacity: cssVarsApplied ? 1 : 0,
                transition: 'opacity 0.1s ease-in-out'
            }}
        >
            <ChunkRenderer
                paragraphGroups={paragraphGroups}
                book={book}
                handleLinkClick={handleLinkNavigation}
                currentChunkIndex={currentChunkIndex}
                onChunkClick={onChunkClick}
                onChunkDoubleClick={handleChunkDoubleClick}
                bionicReadingEnabled={bionicReadingEnabled}
                chunkSpacing={chunkSpacing}
                translations={translations}
                translationLanguages={translationLanguages}
                translationCosts={translationCosts}
                translationFromCache={translationFromCache}
                freeTierUsage={freeTierUsage}
                onToggleTranslation={handleToggleTranslation}
            />

            {/* Context Menu - shown on double-click */}
            {contextMenu && (
                <SentenceContextMenu
                    position={contextMenu.position}
                    onTranslate={handleTranslateFromMenu}
                    onSetCurrentSentence={handleSetCurrentSentence}
                    onAskQuestion={handleAskQuestionFromMenu}
                    onClose={handleCloseContextMenu}
                />
            )}

            {/* Translation Popup */}
            {translationPopup && (
                <TranslationPopup
                    position={translationPopup.position}
                    onTranslate={handleTranslate}
                    onClose={handleCloseTranslationPopup}
                    isLoading={isTranslating}
                    defaultLanguage={userSettings?.lastTranslationLanguage || 'es'}
                />
            )}
        </Box>
    );
};