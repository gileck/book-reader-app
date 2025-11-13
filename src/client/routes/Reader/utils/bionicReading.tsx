import React from 'react';

/**
 * Converts a word to bionic reading format by bolding the first part.
 * 
 * Bionic reading works by emphasizing the first portion of each word,
 * which helps guide the eye and can improve reading speed and comprehension.
 * 
 * Rules:
 * - Words with 1 character: bold the whole word
 * - Words with 2-3 characters: bold the first character
 * - Words with 4-5 characters: bold the first 2 characters
 * - Words with 6+ characters: bold approximately the first half
 * 
 * @param word - The word to convert to bionic reading format
 * @returns React element with bionic reading formatting
 */
export function toBionicReading(word: string): React.ReactElement {
    if (!word) {
        return <></>;
    }

    const length = word.length;
    
    // Determine how many characters to bold
    let boldLength: number;
    if (length <= 1) {
        boldLength = 1;
    } else if (length <= 3) {
        boldLength = 1;
    } else if (length <= 5) {
        boldLength = 2;
    } else {
        // For longer words, bold roughly the first half
        boldLength = Math.ceil(length / 2);
    }

    const boldPart = word.slice(0, boldLength);
    const normalPart = word.slice(boldLength);

    return (
        <>
            <span style={{ fontWeight: 900 }}>{boldPart}</span>
            <span style={{ fontWeight: 400 }}>{normalPart}</span>
        </>
    );
}

