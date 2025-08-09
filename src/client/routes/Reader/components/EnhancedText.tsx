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

    // Render inline text (no block containers) with clickable links and word highlighting
    const renderInlineWithLinks = (text: string, links: ChunkLink[]) => {
        if (!links || links.length === 0) {
            return renderTextWithHighlighting(text);
        }

        const linkPositions: Array<{ start: number; end: number; link: ChunkLink }> = [];

        links.forEach(link => {
            if (link.role === 'source') {
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

        const elements: React.ReactNode[] = [];
        let currentIndex = 0;

        linkPositions.forEach((linkPos, i) => {
            if (currentIndex < linkPos.start) {
                elements.push(text.slice(currentIndex, linkPos.start));
            }

            elements.push(
                <sup
                    key={`inline-source-${i}`}
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

        if (currentIndex < text.length) {
            elements.push(text.slice(currentIndex));
        }

        return renderElementsWithHighlighting(elements);
    };

    // Render text with JSX, making links clickable and handling lists
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

        // Handle simple bullet lists using "•" separator, preserving highlighting and links
        if (text.includes('•')) {
            const firstBulletIndex = text.indexOf('•');
            const prefix = firstBulletIndex > 0 ? text.slice(0, firstBulletIndex).trim() : '';
            const items = text
                .slice(firstBulletIndex)
                .split('•')
                .map(t => t.trim())
                .filter(t => t.length > 0);

            // If no real items were found (edge case), fall back to normal rendering
            if (items.length === 0) {
                return renderInlineWithLinks(text, links);
            }

            return (
                <span>
                    {prefix && (
                        <span style={{ marginRight: '0.5em' }}>
                            {renderInlineWithLinks(prefix, links)}
                        </span>
                    )}
                    <ul style={{
                        margin: '0.25em 0',
                        paddingLeft: '1.2em',
                        listStyleType: 'disc'
                    }}>
                        {items.map((item, idx) => (
                            <li key={`bullet-${idx}`} style={{ margin: '0.15em 0' }}>
                                {renderInlineWithLinks(item, links)}
                            </li>
                        ))}
                    </ul>
                </span>
            );
        }

        // Fallback: inline rendering with links and word-level highlighting
        return renderInlineWithLinks(text, links);
    };

    return <span>{renderTextWithLinks()}</span>;
}; 