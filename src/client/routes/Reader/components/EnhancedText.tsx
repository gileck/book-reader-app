import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { TextChunkClient, ChunkLink } from '@/apis/chapters/types';
import { linkCssClasses } from '../styles/linkStyles';

interface EnhancedTextProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    onLinkClick: (link: ChunkLink) => void;
    getWordStyle?: (chunkIndex: number, wordIndex: number) => React.CSSProperties;
    getWordClassName?: (chunkIndex: number, wordIndex: number) => string;
    getSentenceStyle?: (chunkIndex: number) => React.CSSProperties;
    getSentenceClassName?: (chunkIndex: number) => string;
    handleWordClick?: (chunkIndex: number, wordIndex: number) => void;
    handleSentenceClick?: (chunkIndex: number) => void;
}

export const EnhancedText: React.FC<EnhancedTextProps> = ({
    chunk,
    chunkIndex,
    onLinkClick,
    getWordStyle,
    getWordClassName,
    getSentenceStyle,
    getSentenceClassName,
    handleWordClick,
    handleSentenceClick
}) => {
    const textRef = useRef<HTMLDivElement>(null);

    // Helper function to escape regex special characters
    const escapeRegExp = (string: string): string => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Determine link type based on content
    const getLinkType = (link: ChunkLink): string => {
        const text = link.text.toLowerCase();

        // Check if it's a footnote (numbers, or numbers in brackets/parentheses)
        if (/^[\(\[\s]*\d+[\)\]\s]*$/.test(link.text.trim())) {
            return 'footnote';
        }

        // Check if it's a page reference
        if (text.includes('page') || text.includes('p.') || /^p\d+/.test(text)) {
            return 'page-reference';
        }

        // Check if it's a chapter reference
        if (text.includes('chapter') || text.includes('section') || text.includes('see')) {
            return 'cross-reference';
        }

        // Default to cross-reference
        return 'cross-reference';
    };

    // Process text with links to make them clickable
    const processTextWithLinks = (): string => {
        let processedText = chunk.text;
        const links = chunk.links || [];

        if (links.length === 0) {
            return processedText;
        }

        // Sort links by text length (longest first) to avoid partial replacements
        const sortedLinks = [...links].sort((a, b) => b.text.length - a.text.length);

        sortedLinks.forEach(link => {
            const linkType = getLinkType(link);
            const escapedText = escapeRegExp(link.text);

            // Create a more flexible regex that handles whitespace variations
            const linkRegex = new RegExp(`\\b${escapedText}\\b`, 'g');

            const replacement = `<span class="clickable-link ${linkType}" data-link-id="${link.linkId}" data-link-type="${linkType}">${link.text}</span>`;

            processedText = processedText.replace(linkRegex, replacement);
        });

        return processedText;
    };

    // Handle clicks on links
    const handleLinkClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;

        if (target.classList.contains('clickable-link')) {
            event.preventDefault();
            const linkId = target.getAttribute('data-link-id');

            if (linkId && chunk.links) {
                const link = chunk.links.find(l => l.linkId === linkId);
                if (link) {
                    onLinkClick(link);
                }
            }
        }
    };

    // Process text with word-level styling if needed
    const renderWithWordStyling = (): React.JSX.Element => {
        if (!getWordStyle && !getWordClassName && !handleWordClick) {
            // No word-level styling needed, use enhanced text with links
            return (
                <div
                    dangerouslySetInnerHTML={{ __html: processTextWithLinks() }}
                    onClick={handleLinkClick}
                />
            );
        }

        // Split text into words for individual styling
        const words = chunk.text.split(/(\s+)/);
        let wordIndex = 0;

        return (
            <div onClick={handleLinkClick}>
                {words.map((word, index) => {
                    if (/\s/.test(word)) {
                        // This is whitespace, render as-is
                        return <span key={index}>{word}</span>;
                    }

                    const currentWordIndex = wordIndex++;
                    const wordStyle = getWordStyle ? getWordStyle(chunkIndex, currentWordIndex) : {};
                    const wordClassName = getWordClassName ? getWordClassName(chunkIndex, currentWordIndex) : '';

                    return (
                        <span
                            key={index}
                            style={wordStyle}
                            className={wordClassName}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (handleWordClick) {
                                    handleWordClick(chunkIndex, currentWordIndex);
                                }
                            }}
                        >
                            {word}
                        </span>
                    );
                })}
            </div>
        );
    };

    // Add CSS for link styles
    useEffect(() => {
        const styleId = 'enhanced-text-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = linkCssClasses;
            document.head.appendChild(style);
        }
    }, []);

    const sentenceStyle = getSentenceStyle ? getSentenceStyle(chunkIndex) : {};
    const sentenceClassName = getSentenceClassName ? getSentenceClassName(chunkIndex) : '';

    return (
        <Box
            ref={textRef}
            sx={{
                cursor: handleSentenceClick ? 'pointer' : 'default',
                ...sentenceStyle
            }}
            className={sentenceClassName}
            onClick={(e) => {
                // Only trigger sentence click if not clicking on a word or link
                if (handleSentenceClick && e.target === e.currentTarget) {
                    handleSentenceClick(chunkIndex);
                }
            }}
        >
            {renderWithWordStyling()}
        </Box>
    );
}; 