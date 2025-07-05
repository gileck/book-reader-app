const fs = require('fs');
const path = require('path');

/**
 * Check what's in the JSON file - maybe newlines are already preserved!
 */
function checkJsonStructure() {
    const jsonPath = path.resolve(__dirname, '../../../files/How Emotions Are Made/output.json');

    if (!fs.existsSync(jsonPath)) {
        console.log('❌ JSON file not found');
        return;
    }

    console.log('📖 Reading JSON file...');
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    console.log('📊 JSON structure:');
    console.log(`Keys: ${Object.keys(data)}`);

    if (data.pages) {
        console.log(`\n📄 Pages: ${data.pages.length}`);
        console.log('First page structure:', Object.keys(data.pages[0]));

        // Check Introduction pages (9-12)
        const introPages = data.pages.filter(page =>
            page.pageNumber >= 9 && page.pageNumber <= 12
        );

        console.log(`\n🔍 Introduction pages (9-12): ${introPages.length} pages`);

        if (introPages.length > 0) {
            const firstIntroPage = introPages[0];
            console.log(`\n📝 Page ${firstIntroPage.pageNumber} text (first 500 chars):`);
            console.log('=====================================');
            console.log(firstIntroPage.text.substring(0, 500));
            console.log('=====================================');

            // Check for newlines in the text
            const hasNewlines = firstIntroPage.text.includes('\n');
            console.log(`\n✅ Contains newlines: ${hasNewlines}`);

            if (hasNewlines) {
                console.log('🎯 NEWLINES ARE ALREADY PRESERVED!');

                // Find the problematic sentences
                const fullIntroText = introPages.map(page => page.text).join('\n');

                if (fullIntroText.includes('scratches seem lighter')) {
                    console.log('\n🔍 Found "scratches seem lighter" sentence');
                    const scratchIndex = fullIntroText.indexOf('scratches seem lighter');
                    const context = fullIntroText.substring(scratchIndex - 50, scratchIndex + 150);
                    console.log('Context:');
                    console.log(context);

                    // Check if there's a newline between the sentences
                    const hasNewlineBetween = context.includes('scratches seem lighter.\nThis');
                    console.log(`\n🎯 Has newline between sentences: ${hasNewlineBetween}`);
                }
            } else {
                console.log('❌ No newlines found - need to reconstruct them');
            }

            // Save first intro page for inspection
            fs.writeFileSync(
                path.join(__dirname, 'output', 'json-intro-sample.txt'),
                `JSON INTRO PAGE ${firstIntroPage.pageNumber}\n\n${firstIntroPage.text}`
            );
            console.log('\n📄 Sample saved to: output/json-intro-sample.txt');
        }
    }
}

checkJsonStructure(); 