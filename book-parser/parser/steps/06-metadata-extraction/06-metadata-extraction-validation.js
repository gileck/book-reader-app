/**
 * Validation for Step 6: Metadata Extraction
 * 
 * Validates that comprehensive book metadata has been properly extracted
 * and all required fields are present with correct data types.
 */

/**
 * Validate metadata extraction results
 * @param {Object} result - The pipeline state result from metadata extraction
 * @returns {boolean} - True if validation passes
 */
function validate(result) {
    try {
        // Check that metadata object exists
        if (!result.metadata || typeof result.metadata !== 'object') {
            console.error('❌ Metadata object missing or invalid');
            return false;
        }

        const metadata = result.metadata;

        // Check required basic fields
        const requiredFields = [
            'title', 'author', 'language', 'totalChapters', 'totalWords',
            'extractedAt', 'parserVersion'
        ];

        for (const field of requiredFields) {
            if (!(field in metadata)) {
                console.error(`❌ Required metadata field missing: ${field}`);
                return false;
            }
        }

        // Validate string fields
        const stringFields = ['title', 'author', 'language', 'extractedAt'];
        for (const field of stringFields) {
            if (typeof metadata[field] !== 'string' || metadata[field].length === 0) {
                console.error(`❌ Invalid ${field} in metadata: must be non-empty string`);
                return false;
            }
        }

        // Validate numeric fields
        const numericFields = [
            'totalChapters', 'totalWords', 'totalSentences', 'totalParagraphs',
            'totalImages', 'totalLinks', 'averageWordsPerChapter', 'averageWordsPerParagraph'
        ];

        for (const field of numericFields) {
            if (field in metadata && (typeof metadata[field] !== 'number' || metadata[field] < 0)) {
                console.error(`❌ Invalid ${field} in metadata: must be non-negative number`);
                return false;
            }
        }

        // Validate boolean fields
        const booleanFields = ['hasTableOfContents', 'hasIndex', 'hasImages', 'hasLinks'];
        for (const field of booleanFields) {
            if (field in metadata && typeof metadata[field] !== 'boolean') {
                console.error(`❌ Invalid ${field} in metadata: must be boolean`);
                return false;
            }
        }

        // Validate array fields
        if (metadata.chapterTitles && !Array.isArray(metadata.chapterTitles)) {
            console.error('❌ Invalid chapterTitles in metadata: must be array');
            return false;
        }

        // Validate chapter titles count matches total chapters
        if (metadata.chapterTitles && metadata.chapterTitles.length !== metadata.totalChapters) {
            console.error('❌ Chapter titles count does not match totalChapters');
            return false;
        }

        // Validate parser version
        if (metadata.parserVersion !== 2) {
            console.error('❌ Invalid parserVersion: expected 2');
            return false;
        }

        // Validate extractedAt is valid ISO date
        try {
            const date = new Date(metadata.extractedAt);
            if (isNaN(date.getTime())) {
                console.error('❌ Invalid extractedAt: must be valid ISO date string');
                return false;
            }
        } catch (error) {
            console.error('❌ Invalid extractedAt format');
            return false;
        }

        // Validate optional numeric fields if present
        if (metadata.publicationYear && (typeof metadata.publicationYear !== 'number' ||
            metadata.publicationYear < 1000 || metadata.publicationYear > new Date().getFullYear() + 10)) {
            console.error('❌ Invalid publicationYear: must be reasonable year');
            return false;
        }

        if (metadata.edition && (typeof metadata.edition !== 'number' || metadata.edition < 1)) {
            console.error('❌ Invalid edition: must be positive number');
            return false;
        }

        // Validate ISBN format if present
        if (metadata.isbn && !/^[0-9X]{10,13}$/.test(metadata.isbn)) {
            console.error('❌ Invalid ISBN format');
            return false;
        }

        // Validate relationships between fields
        if (metadata.hasImages && metadata.totalImages === 0) {
            console.error('❌ Inconsistent image metadata: hasImages true but totalImages is 0');
            return false;
        }

        if (metadata.hasLinks && metadata.totalLinks === 0) {
            console.error('❌ Inconsistent links metadata: hasLinks true but totalLinks is 0');
            return false;
        }

        // Validate averages make sense
        if (metadata.totalChapters > 0 && metadata.totalWords > 0) {
            const expectedAvg = Math.round(metadata.totalWords / metadata.totalChapters);
            if (Math.abs(metadata.averageWordsPerChapter - expectedAvg) > 1) {
                console.error('❌ Inconsistent averageWordsPerChapter calculation');
                return false;
            }
        }

        // Success validation message


        if (metadata.publisher) {
            console.log(`   🏢 Publisher: ${metadata.publisher}`);
        }

        if (metadata.publicationYear) {
            console.log(`   📅 Year: ${metadata.publicationYear}`);
        }



        return true;

    } catch (error) {
        console.error('❌ Metadata extraction validation error:', error.message);
        return false;
    }
}

module.exports = {
    validate
}; 