const fs = require('fs');
const path = require('path');

// Read the detected chapters JSON
const chaptersPath = path.join(__dirname, 'output/step-02-chapter-detection/detected-chapters.json');
const chaptersData = JSON.parse(fs.readFileSync(chaptersPath, 'utf8'));

// Function to get first ~200 characters of text
function getStartText(text, maxLength = 400) {
    if (!text) return '[NO TEXT AVAILABLE]';

    // Find a good breaking point (end of sentence)
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');

    const lastSentence = Math.max(lastPeriod, lastExclamation, lastQuestion);

    if (lastSentence > maxLength * 0.7) {
        return truncated.substring(0, lastSentence + 1);
    }

    return truncated + '...';
}

// Function to get last ~200 characters of text
function getEndText(text, maxLength = 400) {
    if (!text) return '[NO TEXT AVAILABLE]';

    const startPos = Math.max(0, text.length - maxLength);
    const excerpt = text.substring(startPos);

    // Find a good breaking point at start (beginning of sentence)
    const firstPeriod = excerpt.indexOf('. ');
    const firstExclamation = excerpt.indexOf('! ');
    const firstQuestion = excerpt.indexOf('? ');

    let firstSentence = Math.min(
        ...[firstPeriod, firstExclamation, firstQuestion]
            .filter(pos => pos !== -1)
            .map(pos => pos + 2)
    );

    if (firstSentence === Infinity) firstSentence = 0;

    if (firstSentence < maxLength * 0.3) {
        return '...' + excerpt.substring(firstSentence);
    }

    return '...' + excerpt;
}

// Generate the content text
let contentText = '';

chaptersData.chapters.forEach((chapter) => {
    contentText += `========\n`;
    contentText += `${chapter.title}\n`;
    contentText += `${getStartText(chapter.textContent)}\n\n\n`;
    contentText += `${getEndText(chapter.textContent)}\n`;
    contentText += `========\n\n`;
});

// Write to file
fs.writeFileSync('chapters-content.txt', contentText);
console.log('✅ Chapter content file updated: chapters-content.txt');
console.log(`📊 Generated content for ${chaptersData.chapters.length} chapters`); 