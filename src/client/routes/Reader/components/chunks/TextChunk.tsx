import React from 'react';
import { TextChunkClient, ChunkLink } from '@/apis/chapters/types';
import { EnhancedText } from '../EnhancedText';

interface TextChunkProps {
    chunk: TextChunkClient;
    chunkIndex: number;
    currentChunkIndex: number;
    handleLinkClick: (link: ChunkLink) => void;

}

export const TextChunk: React.FC<TextChunkProps> = ({
    chunk,
    chunkIndex,
    currentChunkIndex,
    handleLinkClick
}) => {
    return (
        <div
        style={{
            lineHeight: 'var(--reader-line-height, 1.6)',
            fontSize: 'var(--reader-font-size, 1rem)',
            fontFamily: 'var(--reader-font-family, inherit)',
            color: 'var(--reader-text-color, inherit)',
            padding: '0px 5px 0px 5px',
            backgroundColor: currentChunkIndex === chunkIndex ? 'var(--sentence-highlight-color, transparent)' : 'transparent',
            borderRadius: '6px',
            transition: 'all 0.3s ease'
        }}
            id={`text-chunk-${chunkIndex}`}
            data-chunk-index={chunkIndex}
            data-paragraph-index={chunk.paragraphIndex}
        >
            <EnhancedText
                chunk={chunk}
                chunkIndex={chunkIndex}
                onLinkClick={handleLinkClick}
            />
        </div>
    );
}; 