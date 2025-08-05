import React, { useEffect } from 'react';
import { TextChunkClient, ChunkLink } from '@/apis/chapters/types';
import { linkCssClasses } from '../styles/linkStyles';

interface EnhancedTextProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    onLinkClick: (link: ChunkLink) => void;

}

/**
 * Find footnote pattern in text - only matches specific footnote formats
 * @param text - The full text to search in
 * @param linkText - The footnote number to find (e.g., "1", "2")
 * @returns Index of the footnote number, or -1 if not found in correct pattern
 */
const findFootnotePattern = (text: string, linkText: string): number => {
    // Pattern 1: ". {number} {Capital letter}" (e.g., ". 1 The", ". 2 If")
    const dotPattern = new RegExp(`\\. ${linkText} [A-Z]`, 'g');
    const match = dotPattern.exec(text);
    if (match) {
        // Return index of the number, not the dot
        return match.index + 2; // Skip ". " to point to the number
    }

    // Pattern 2: "{number} {Capital letter}" at start of chunk
    const startPattern = new RegExp(`^${linkText} [A-Z]`);
    if (startPattern.test(text)) {
        return 0; // Number is at the very start
    }

    return -1; // No valid footnote pattern found
};

export const EnhancedText: React.FC<EnhancedTextProps> = ({
    chunk,
    chunkIndex,
    onLinkClick
}) => {
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

    // Helper function to render text with word-level highlighting
    const renderTextWithHighlighting = (text: string) => {
        const words = text.split(/\s+/).filter(word => word.length > 0);
        return (
            <>
                {words.map((word, wordIndex) => (
                    <React.Fragment key={wordIndex}>
                        <span
                            data-chunk-index={chunkIndex}
                            data-word-index={wordIndex}
                            data-word-id={`chunk-${chunkIndex}-word-${wordIndex}`}
                            style={{ cursor: 'pointer' }}
                        >
                            {word}
                        </span>
                        {wordIndex < words.length - 1 && ' '}
                    </React.Fragment>
                ))}
            </>
        );
    };

    // Helper function to render elements with highlighting applied to text parts
    const renderElementsWithHighlighting = (elements: React.ReactNode[]) => {
        return (
            <>
                {elements.map((element, elementIndex) => {
                    // If element is a string, apply word highlighting
                    if (typeof element === 'string') {
                        return (
                            <React.Fragment key={elementIndex}>
                                {renderTextWithHighlighting(element)}
                            </React.Fragment>
                        );
                    }
                    // If element is JSX (like links), return as-is
                    return element;
                })}
            </>
        );
    };

    // Render text with JSX, making links clickable
    const renderTextWithLinks = () => {
        const text = chunk.text;
        const links = chunk.links || [];

        // Check if this chunk contains target links (footnote definitions)
        // Target links are the actual footnote content that should be formatted as "1) Text..."
        const hasTargetLinks = links.some(link => link.role === 'target');

        if (hasTargetLinks) {
            // For target links, format as footnote definitions: "1) Text..."
            return (
                <span style={{ marginTop: '1em', lineHeight: 1.6 }}>
                    {links.map((link, i) => (
                        <span key={`target-${i}`} style={{ marginBottom: '0.5em' }}>
                            <span
                                className="clickable-link target"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onLinkClick(link);
                                }}
                                style={{
                                    cursor: 'pointer',
                                    color: '#1976d2',
                                    fontWeight: 500
                                }}
                            >
                                {link.text})
                            </span>
                            {' '}
                            {text.replace(link.text, '').trim()}
                        </span>
                    ))}
                </span>
            );
        }

        if (links.length === 0) {
            // Split text into words for highlighting
            return renderTextWithHighlighting(text);
        }

        // Handle source links (footnote references) as superscript
        // Source links are the clickable numbers in the text that reference footnotes
        const linkPositions: Array<{ start: number; end: number; link: ChunkLink }> = [];

        links.forEach(link => {
            if (link.role === 'source') {
                // Only match footnotes with specific patterns:
                // 1. ". {number} {Capital letter}" (e.g., ". 1 The", ". 2 If")
                // 2. "{number} {Capital letter}" at start of chunk
                const footnoteIndex = findFootnotePattern(text, link.text);
                if (footnoteIndex !== -1) {
                    linkPositions.push({
                        start: footnoteIndex,
                        end: footnoteIndex + link.text.length,
                        link
                    });
                }
            }
        });

        // Sort by start position
        linkPositions.sort((a, b) => a.start - b.start);

        // Build JSX elements
        const elements: React.ReactNode[] = [];
        let currentIndex = 0;

        linkPositions.forEach((linkPos, i) => {
            // Add text before the link
            if (currentIndex < linkPos.start) {
                elements.push(text.slice(currentIndex, linkPos.start));
            }

            // Add the clickable footnote link as superscript
            elements.push(
                <sup
                    key={`source-${i}`}
                    className="clickable-link footnote"
                    onClick={(e) => {
                        e.preventDefault();
                        onLinkClick(linkPos.link);
                    }}
                    style={{
                        cursor: 'pointer',
                        color: '#1976d2',
                        textDecoration: 'none',
                        fontSize: '0.75em',
                        fontWeight: 500,
                        padding: '0 2px',
                        borderRadius: '2px',
                        lineHeight: 1,
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e3f2fd';
                        e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    {linkPos.link.text}
                </sup>
            );

            currentIndex = linkPos.end;
        });

        // Add remaining text after the last link
        if (currentIndex < text.length) {
            elements.push(text.slice(currentIndex));
        }

        return renderElementsWithHighlighting(elements);
    };

    return <span>{renderTextWithLinks()}</span>;
}; 