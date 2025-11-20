import React from 'react';
import { highlightMatches } from '../../utils/searchUtils';
import { useTheme } from '@mui/material';

interface HighlightedTextProps {
    text: string;
    query: string;
    maxLength?: number;
}

/**
 * HighlightedText component
 * Renders text with highlighted query matches
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
    text,
    query,
    maxLength = 200
}) => {
    const theme = useTheme();
    
    // Truncate text if too long
    let displayText = text;
    
    if (text.length > maxLength) {
        // Find query position to keep it in view
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const matchIndex = lowerText.indexOf(lowerQuery);
        
        if (matchIndex !== -1) {
            // Show context around the match
            const start = Math.max(0, matchIndex - Math.floor(maxLength / 3));
            const end = Math.min(text.length, start + maxLength);
            displayText = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
        } else {
            displayText = text.slice(0, maxLength) + '...';
        }
    }

    const parts = highlightMatches(displayText, query);

    return (
        <span style={{ lineHeight: 1.6 }}>
            {parts.map((part, index) => (
                part.isMatch ? (
                    <mark
                        key={index}
                        style={{
                            backgroundColor: theme.palette.mode === 'dark' 
                                ? 'rgba(255, 235, 59, 0.3)' // Softer yellow for dark mode
                                : 'rgba(255, 235, 59, 0.5)', // Standard yellow for light mode
                            color: theme.palette.text.primary,
                            padding: '0 2px',
                            borderRadius: '3px',
                            fontWeight: 600
                        }}
                    >
                        {part.text}
                    </mark>
                ) : (
                    <span key={index}>{part.text}</span>
                )
            ))}
        </span>
    );
};
