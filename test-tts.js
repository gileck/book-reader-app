// Import the Google Cloud client library
const textToSpeech = require('@google-cloud/text-to-speech').v1beta1;
const fs = require('fs');

const GOOGLE_APPLICATION_CREDENTIALS = 'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiY29udGludWFsLXZvaWNlLTExMDkwOCIsCiAgInByaXZhdGVfa2V5X2lkIjogIjU0NGFhZmM0NDExMGU3N2MyMDBiMTk2M2VjNzEyMTdlMzI5YTM4YmMiLAogICJwcml2YXRlX2tleSI6ICItLS0tLUJFR0lOIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRQ29CZjlFK3dSaTk3MitcbmdMTVVmTUJydXNCcXFKb0pSUHJ6UkFpNDNuNGVmd0dHWlNiQkxCYUxDZ1d4Y0NKRUpoTTl0RzQxbDEyNVdaREhcbmNGeGpUbWRrME1mWm9MRno4S2Vwc095d2d5YUIzeUVvcHdFU2RKNnJHUW1DZ09aMjZ4SkRyc1hJUzFyVVpKZ09cbk5jUjJwTXZmRnhzUGsyZlpJblZ2VmlBKzBTMFJ2TGd5OExBOGdUNmUzUlI1bXZxeFRMVmpUZ056TWdjZlkycFFcbnNKZjhsa0pXUWJxaFJ6RENXcmFyUXJBRm5TdWZDbFE4bmIrV1NSWVVMUG9tRyt0SWNkaUw5anJ2S0QrMmZQdlRcbmdqM1FndXlyNkhwWUxTWnZ2b2U4Y3cwcDdUL1JLSWV0L0RaUHVoVkdCVVByZHFoYVVqazlJeTZJNUl6bmxEQUVcbkF3eHYrSjJ6QWdNQkFBRUNnZ0VBQU5Obyt4c0NOanBtWnU0WmtkVjlwNm5rOGRIejdmSzcwdGpxSUE5YWYwcHdcbmVDZERFMWtubi80TzhhdU40SnF5TEVDL3YrdWpLaGdTUmtwbjd3NnJUNDRnUlZVdjFlckRDVDNDRnRZQlVCT2VcblFwcDZJdG1nK09JWGplVXhqWHNwWVorbUxFdUV4N09NTEk2VE9jWlJMOXFKQmUwL3Nsb0NsN1VVL0ZFQ2ZEM1lcbmswU2ROVmtSeHpRMHhUbm5iTHpDV2JQTllvbzRSSnlyczFsWlQyajNrR2FxYVZwVUM1TmpEMnd4RG16NHZWeGxcbnoxR2RLZmRKRjJBQVlMaVlJS2Z5RkJGNStFNU8wNDlINkd1dTUxdlNiTlgzelRDUXlTRFJCSk1DbmhvcitTdFRcbnJtMzQ0TWtOUG1iZlpsZVFncHovTW4wSDd2WEVmZm9jYUorRkZKUmlqUUtCZ1FEbWdJRjVhNm4wc1NUZ1dTTVRcbnFpem9ZREZlUHBrbHRYZlNhdWJsaGxQWHZSdWlLb2xGd1RMWFlubmQ2L05yYzYxK1Zta1VLQzd4TmhacmdpV1BcblhrN1lqcitKc1VqajBORmZFMlBRaFhIdlVucW1JQng1RzdCTVJVc3FyQzR0ZFZPbExrZ2JGclJlTG5QbDZiWUZcbkIzZkNQRS92NjVzcnl3bWxIckJ1VUc1d1h3S0JnUUM2bkMraWN5OEc4NFVlQitxdGMyQnowbXh6R3ZYcXIrem1cblg1YlRvdC9EOVZsSU9LVnB4cjRscHJZNnh3bVBtT25XM2hPcWlZdGFLVzR4MzYyYVlZanNZcXpTallaN2R2QzJcbm5ESWJkKzNsN3hXNXpDS0c1NkNsY2g5OXJKMWZXanBqT0NnUjZiQXZtc2l4R0tPUzQ4VmhxUFh5citoUmI4RDlcbkFBVjN0SnBETFFLQmdRRGxpT1psOFU3SGVuZk1hVGRDNTkzY2NaMzN5Y0pjQ0wrUGJDRU9RNXZPWkdUV01pR01cbnN2MWIrcFo4NWUvNityQ3o5SHlqTS9pNi95K0lVNHZ2bnV4SlBxMkNBbWNoWmRwNUlTZnVpRlNUQzhGVEdQc0JcbnB3OENoS1o3a2daU0Fsb1BUVzFFZkhHVXNCRjl6Q1FVRWdHeURMbFZvM3RjT3M0Wi9kdVhuc1M3WlFLQmdEdmhcbmZvK2Njb3pDZkFiazkzTnRRSmdwLzg3MzZjM0RZanVTbE8yWXFFRlRhN0QzTEcxQzd5VloxOFFJdHBLenVPWFFcbklYTnA2Nk9sQTgxUlAzMzRxbDFnVktERDlWR05HelVkN2g1T1g3S1hBOXU1RzZNNmxKeENnTVJ0TFpxNWMxNy9cbldDeFhWc2dQM1RLbSsyWlpYSzgzN3FSUHVqYlhxNUFELzcwbjRSQ0pBb0dBV0t2Z1Z0UWVOTHVFaGphMnNBNmJcbnJpMG84d1daZ3JERi9RRGJHa1Z0L204am1GWkd6azMxVW5tRFlTNVhTZ3FQeTU0YTB4cVVhZ0hVYVR2S1gzNkFcbmNkTUNHVzlTL0p5MG5wT0xUUTB4eFUvVnFrVnJPNGVZVXBuUkhVNlQwMzlzcDVNYnF3d2l6blF1cTdWNFpmOTRcbjhTY1l5OUFnVkVYL1JpaXF4UThPYlQ4PVxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogImJvb2tzLTU2M0Bjb250aW51YWwtdm9pY2UtMTEwOTA4LmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAiY2xpZW50X2lkIjogIjEwODY1MjU0Nzk4MTI2ODczMDMyNSIsCiAgImF1dGhfdXJpIjogImh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoIiwKICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwKICAiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsCiAgImNsaWVudF94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3JvYm90L3YxL21ldGFkYXRhL3g1MDkvYm9va3MtNTYzJTQwY29udGludWFsLXZvaWNlLTExMDkwOC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgInVuaXZlcnNlX2RvbWFpbiI6ICJnb29nbGVhcGlzLmNvbSIKfQ'

function getClient() {
    try {
        const keyBase64 = GOOGLE_APPLICATION_CREDENTIALS;
        const credentials = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'));
        const client = new textToSpeech.TextToSpeechClient({
            credentials,
        });
        return client;
    } catch (e) {
        console.error('Failed to initialize TTS client:', e);
        return null;
    }
}

function generateSSMLWithMarks(text) {
    const words = text.split(" ");
    let ssml = "<speak>";

    words.forEach((word, index) => {
        ssml += ` <mark name="${word}-${index}"/> ${word}`;
    });

    ssml += "</speak>";
    return ssml;
}

async function synthesizeSpeech(text, voiceId = 'en-US-Neural2-F') {
    if (!text) {
        return null;
    }
    const textWithMarks = generateSSMLWithMarks(text);

    const request = {
        enableTimePointing: ['SSML_MARK'],
        input: {
            ssml: textWithMarks  // Don't double-wrap with <speak>
        },
        voice: {
            languageCode: 'en-US',
            name: voiceId
        },
        audioConfig: { audioEncoding: 'MP3' },
    };

    const client = getClient();
    if (!client) {
        return null;
    }

    console.log('Request:', JSON.stringify(request, null, 2));

    const [response] = await client.synthesizeSpeech(request);

    if (!response || !response.audioContent) {
        return null;
    }

    return {
        audioContent: response.audioContent.toString('base64'),
        timepoints: response.timepoints
    };
}

async function testTTS() {
    console.log('Testing Google TTS v1beta1 with timepoints...');

    const testText = "Hello world this is a test";
    console.log('Original text:', testText);

    try {
        const result = await synthesizeSpeech(testText);

        if (result) {
            console.log('Audio content length:', result.audioContent.length);
            console.log('Timepoints:', result.timepoints);

            if (result.timepoints && result.timepoints.length > 0) {
                console.log('SUCCESS: Timepoints found!');
                result.timepoints.forEach((tp, index) => {
                    console.log(`  ${index}: ${tp.markName} at ${tp.timeSeconds}s`);
                });
            } else {
                console.log('ERROR: No timepoints returned');
            }

            // Save audio file for testing
            fs.writeFileSync('test-output.mp3', Buffer.from(result.audioContent, 'base64'));
            console.log('Audio saved to test-output.mp3');
        } else {
            console.log('ERROR: No result from TTS');
        }
    } catch (error) {
        console.error('TTS synthesis error:', error);
    }
}

// Run the test
testTTS().catch(console.error); 