/**
 * Word Highlighting API
 * Direct DOM manipulation for performant word highlighting during audio playback
 */

export const WordHighlightingAPI = {
    /**
     * Set the global word highlight color
     */
    setWordHighlightColor: (color: string): void => {
        document.documentElement.style.setProperty('--word-highlight-color', color);
    },

    /**
     * Set the global sentence highlight color
     */
    setSentenceHighlightColor: (color: string): void => {
        document.documentElement.style.setProperty('--sentence-highlight-color', color);
    },

    /**
     * Highlight a specific word
     */
    highlightWord: (chunkIndex: number, wordIndex: number): void => {
        const wordElement = document.querySelector(
            `[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`
        );
        if (wordElement) {
            wordElement.classList.add('highlight-word');
        }
    },

    /**
     * Remove highlighting from a specific word
     */
    unhighlightWord: (chunkIndex: number, wordIndex: number): void => {
        const wordElement = document.querySelector(
            `[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`
        );
        if (wordElement) {
            wordElement.classList.remove('highlight-word');
        }
    },

    /**
     * Clear all word highlights on the page
     */
    clearAllHighlights: (): void => {
        const highlightedWords = document.querySelectorAll('.highlight-word');
        highlightedWords.forEach(word => word.classList.remove('highlight-word'));
    },

    /**
     * Check if a word element exists in the DOM
     */
    wordExists: (chunkIndex: number, wordIndex: number): boolean => {
        const wordElement = document.querySelector(
            `[data-word-id="chunk-${chunkIndex}-word-${wordIndex}"]`
        );
        return wordElement !== null;
    }
};

