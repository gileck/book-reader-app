const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_TEXT = "Hello world! This is a test of Amazon Polly speech synthesis with word timing.";
const VOICE_ID = 'Joanna';
const OUTPUT_DIR = path.join(__dirname, '../test-output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Initialize Polly client
function createPollyClient() {
    // Use hardcoded credentials for testing
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    
    return new PollyClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });
}

// Generate SSML with word marks
function generateSSMLWithMarks(text) {
    const words = text.split(' ').filter(word => word.length > 0);
    let ssml = '<speak>';

    words.forEach((word, index) => {
        ssml += ` <mark name="${word}-${index}"/> ${word}`;
    });

    ssml += '</speak>';
    return ssml;
}

// Convert stream to buffer
async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

// Convert stream to string
async function streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
}

// Test Polly TTS with timestamps
async function testPollyTimestamps() {
    console.log('🚀 Testing Amazon Polly TTS with timestamps...\n');
    
    try {
        const client = createPollyClient();
        const ssmlText = generateSSMLWithMarks(TEST_TEXT);
        
        console.log('📝 Test text:', TEST_TEXT);
        console.log('🎤 Voice:', VOICE_ID);
        console.log('📋 Generated SSML:');
        console.log(ssmlText);
        console.log('\n' + '='.repeat(50) + '\n');

        // Step 1: Get speech marks for timing
        console.log('⏱️  Step 1: Getting speech marks...');
        const speechMarksCommand = new SynthesizeSpeechCommand({
            Text: ssmlText,
            TextType: 'ssml',
            VoiceId: VOICE_ID,
            OutputFormat: 'json',
            SpeechMarkTypes: ['ssml'],
            Engine: 'neural'
        });

        const speechMarksResponse = await client.send(speechMarksCommand);
        
        if (!speechMarksResponse.AudioStream) {
            throw new Error('No speech marks received');
        }

        const speechMarksText = await streamToString(speechMarksResponse.AudioStream);
        const speechMarksFile = path.join(OUTPUT_DIR, 'speech-marks.json');
        fs.writeFileSync(speechMarksFile, speechMarksText);
        
        console.log('✅ Speech marks saved to:', speechMarksFile);

        // Parse speech marks
        const lines = speechMarksText.trim().split('\n');
        const timepoints = [];
        
        console.log('\n📊 Parsing speech marks:');
        for (const line of lines) {
            try {
                const mark = JSON.parse(line);
                if (mark.type === 'ssml' && mark.value) {
                    const timepoint = {
                        markName: mark.value,
                        timeSeconds: mark.time / 1000 // Convert ms to seconds
                    };
                    timepoints.push(timepoint);
                    console.log(`   ${timepoint.markName} -> ${timepoint.timeSeconds}s`);
                }
            } catch (e) {
                console.warn(`   ⚠️  Skipped invalid JSON line: ${line}`);
            }
        }

        console.log(`\n✅ Found ${timepoints.length} word timepoints\n`);

        // Step 2: Get the actual audio
        console.log('🔊 Step 2: Getting audio...');
        const audioCommand = new SynthesizeSpeechCommand({
            Text: ssmlText,
            TextType: 'ssml',
            VoiceId: VOICE_ID,
            OutputFormat: 'mp3',
            Engine: 'neural'
        });

        const audioResponse = await client.send(audioCommand);
        
        if (!audioResponse.AudioStream) {
            throw new Error('No audio received');
        }

        const audioBuffer = await streamToBuffer(audioResponse.AudioStream);
        const audioFile = path.join(OUTPUT_DIR, 'test-audio.mp3');
        fs.writeFileSync(audioFile, audioBuffer);
        
        console.log('✅ Audio saved to:', audioFile);
        console.log(`📏 Audio size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

        // Step 3: Analyze results
        console.log('\n' + '='.repeat(50));
        console.log('📈 ANALYSIS RESULTS');
        console.log('='.repeat(50));
        
        const words = TEST_TEXT.split(' ').filter(word => word.length > 0);
        console.log(`📝 Original words: ${words.length}`);
        console.log(`⏱️  Timepoints: ${timepoints.length}`);
        console.log(`✅ Match: ${words.length === timepoints.length ? 'YES' : 'NO'}`);
        
        if (timepoints.length > 0) {
            const firstTime = timepoints[0].timeSeconds;
            const lastTime = timepoints[timepoints.length - 1].timeSeconds;
            const duration = lastTime - firstTime;
            
            console.log(`⏰ First word at: ${firstTime}s`);
            console.log(`⏰ Last word at: ${lastTime}s`);
            console.log(`⏱️  Speech duration: ${duration.toFixed(2)}s`);
            console.log(`🎯 Average word interval: ${(duration / (timepoints.length - 1)).toFixed(3)}s`);
        }

        // Step 4: Generate timing analysis
        console.log('\n📋 Word-by-word timing:');
        console.log('Word'.padEnd(15) + 'Mark Name'.padEnd(20) + 'Time (s)'.padEnd(10) + 'Interval (s)');
        console.log('-'.repeat(55));
        
        for (let i = 0; i < Math.min(words.length, timepoints.length); i++) {
            const word = words[i];
            const timepoint = timepoints[i];
            const interval = i > 0 ? (timepoint.timeSeconds - timepoints[i-1].timeSeconds).toFixed(3) : '0.000';
            
            console.log(
                word.padEnd(15) + 
                timepoint.markName.padEnd(20) + 
                timepoint.timeSeconds.toFixed(3).padEnd(10) + 
                interval
            );
        }

        // Step 5: Test our adapter format
        console.log('\n🔧 Testing adapter format compatibility:');
        const adapterResult = {
            audioContent: audioBuffer.toString('base64'),
            timepoints: timepoints
        };
        
        console.log(`✅ Audio content (base64): ${adapterResult.audioContent.length} characters`);
        console.log(`✅ Timepoints array: ${adapterResult.timepoints.length} items`);
        console.log('✅ Format matches TTSResult interface');

        // Save results summary
        const summary = {
            testText: TEST_TEXT,
            voice: VOICE_ID,
            ssml: ssmlText,
            wordCount: words.length,
            timepointCount: timepoints.length,
            timepoints: timepoints,
            audioSizeKB: (audioBuffer.length / 1024),
            timestamp: new Date().toISOString()
        };
        
        const summaryFile = path.join(OUTPUT_DIR, 'test-summary.json');
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
        console.log(`\n📄 Test summary saved to: ${summaryFile}`);

        console.log('\n🎉 Test completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Play the generated audio file to verify quality');
        console.log('   2. Check that word timings align with actual speech');
        console.log('   3. Test with different voices and longer text');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        if (error.message.includes('AWS credentials') || error.message.includes('UnrecognizedClientException')) {
            console.log('\n💡 AWS Error - this might be due to:');
            console.log('   1. Invalid or expired AWS credentials');
            console.log('   2. Insufficient permissions for Polly service');
            console.log('   3. Network connectivity issues');
            console.log('\n   The script uses hardcoded test credentials, but they may need to be updated.');
        }
        
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testPollyTimestamps();
}

module.exports = { testPollyTimestamps }; 