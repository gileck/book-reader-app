# Header Detection Task

## Problem Statement

The current header detection system is incorrectly identifying headers, resulting in:
- Massive text chunks (400+ words) being marked as headers
- Corrupted header text like "I NTRODUCTION" instead of "INTRODUCTION"
- Missing actual section headers throughout the book
- Complex, fragile workaround code that doesn't address the root issue

## Header Definition

A header is a **standalone descriptive line** that acts as a section divider. Headers must follow ALL of these rules:

1. **Length**: 2-5 words (short and descriptive)
2. **No sentence ending**: Does not end with punctuation (. ! ?)
3. **Capitalization**: Starts with a capital letter
4. **Line ending**: Ends with a newline character
5. **Previous context**: Previous line ends with sentence-ending punctuation
6. **Next context**: Next line starts with a capital letter

## Valid Header Examples

From the raw PDF text:
- "Pulling hydrogen"
- "Circular reasoning" 
- "Separating charge"

These follow all 6 rules and represent section breaks in the content.

## Current System Issues

1. **Wrong approach**: Looking for formatting markers and complex patterns instead of analyzing line relationships
2. **Cross-page processing**: Merging headers with following content into massive chunks
3. **PDF extraction bugs**: Not fixing basic text corruption at the source
4. **Complex workarounds**: Building fragile regex systems instead of simple line-by-line analysis

## Implementation Plan

### Step 1: Clean Line-by-Line Analysis
Replace the current header detection with simple line relationship analysis:

```javascript
function isHeader(currentLine, previousLine, nextLine) {
    // Apply the 6 rules directly
    const words = currentLine.trim().split(/\s+/);
    
    // Rule 1: 2-5 words
    if (words.length < 2 || words.length > 5) return false;
    
    // Rule 2: No sentence ending
    if (/[.!?]$/.test(currentLine.trim())) return false;
    
    // Rule 3: Starts with capital
    if (!/^[A-Z]/.test(currentLine.trim())) return false;
    
    // Rule 5: Previous line ends with punctuation
    if (!previousLine || !/[.!?]$/.test(previousLine.trim())) return false;
    
    // Rule 6: Next line starts with capital
    if (!nextLine || !/^[A-Z]/.test(nextLine.trim())) return false;
    
    return true;
}
```

### Step 2: Remove Complex Workarounds
- Remove header marker system (`⟨⟨HEADING⟩⟩`)
- Simplify cross-page processing 
- Remove complex regex patterns
- Fix PDF text corruption at extraction level

### Step 3: Apply During Text Processing
Process text line by line during the chunking phase, not during PDF extraction.

### Step 4: Test Against Known Headers
Verify detection works correctly on:
- "Pulling hydrogen"
- "Circular reasoning"
- "Separating charge"
- "INTRODUCTION" (after fixing PDF corruption)

## Testing and Verification Guidelines

### Test Data
Use these known headers from the raw PDF text to validate implementation:
- "Pulling hydrogen" (line 1419)
- "Circular reasoning" (line 1574) 
- "Separating charge" (line 1878)
- "INTRODUCTION" (should be detected, not "I NTRODUCTION")

### Testing Steps

#### 1. Unit Test the Header Detection Function
Create a simple test script:
```javascript
// Test cases with context
const testCases = [
    {
        prev: "This is a sentence ending with a period.",
        current: "Pulling hydrogen", 
        next: "This starts the next section with capital.",
        expected: true
    },
    {
        prev: "Another complete sentence.",
        current: "This is too long to be a header line",
        next: "Next content starts here.",
        expected: false
    },
    {
        prev: "Previous sentence.",
        current: "ends with period.",
        next: "Next content.",
        expected: false
    }
];

testCases.forEach((test, i) => {
    const result = isHeader(test.current, test.prev, test.next);
    console.log(`Test ${i+1}: ${result === test.expected ? 'PASS' : 'FAIL'}`);
});
```

#### 2. Integration Test with Real PDF Data
```bash
# Run the parser
./parseBook.sh

# Check specific header detection
python3 -c "
import json
data = json.load(open('output.json'))
headers = [c for c in data['chapters'][0]['content']['chunks'] if c.get('type') == 'header']
print(f'Total headers found: {len(headers)}')
for h in headers:
    words = len(h['text'].split())
    print(f'- \"{h[\"text\"]}\" ({words} words)')
"
```

#### 3. Validate Against Known Examples
Search for the specific headers in the output:
```bash
# Should find these exact headers
grep -n "Pulling hydrogen" output.json
grep -n "Circular reasoning" output.json  
grep -n "Separating charge" output.json
grep -n "INTRODUCTION" output.json  # Not "I NTRODUCTION"
```

#### 4. Verify No False Positives
Check that regular text is not marked as headers:
```bash
# Count headers vs text chunks
python3 -c "
import json
data = json.load(open('output.json'))
all_chunks = data['chapters'][0]['content']['chunks']
headers = [c for c in all_chunks if c.get('type') == 'header']
text_chunks = [c for c in all_chunks if c.get('type') == 'text']
print(f'Headers: {len(headers)}')
print(f'Text chunks: {len(text_chunks)}')
print(f'Ratio: {len(headers)/len(text_chunks):.2%}')
"
```

### Expected Results

#### Header Count
- Should find 10-30 headers per chapter (reasonable for section breaks)
- NOT 1-2 massive headers or 100+ false positives

#### Header Length
- All headers should be 2-5 words
- No headers over 50 characters
- No 400+ word chunks marked as headers

#### Header Content Examples
```json
{
  "text": "Pulling hydrogen",
  "wordCount": 2,
  "type": "header"
},
{
  "text": "Circular reasoning", 
  "wordCount": 2,
  "type": "header"
},
{
  "text": "INTRODUCTION",
  "wordCount": 1,
  "type": "header"
}
```

#### Text Separation
Regular content should be in separate text chunks:
```json
{
  "text": "This is the actual content that follows the header...",
  "wordCount": 145,
  "type": "text"
}
```

### Failure Indicators

❌ **FAIL if:**
- Any header has more than 5 words
- Headers contain sentence-ending punctuation
- "I NTRODUCTION" appears instead of "INTRODUCTION"  
- Known headers like "Pulling hydrogen" are missing
- Regular sentences are marked as headers
- Less than 5 or more than 50 headers per chapter

✅ **PASS if:**
- All test headers are detected correctly
- No false positives in random content sampling
- Headers are properly separated from following text
- Word count distribution is reasonable

## Success Criteria

1. Headers are short (2-5 words), not 400+ word chunks
2. All actual section headers are detected
3. No false positives (regular text marked as headers)
4. Clean, simple code without complex workarounds
5. "INTRODUCTION" appears correctly, not "I NTRODUCTION"

## Investigation Findings

### Root Cause Identified
The header detection was failing because:

1. **Wrong Processing Phase**: Header detection was happening AFTER text merging, when "Pulling hydrogen" was already combined into massive chunks
2. **Newline Collapse**: The PDF text extraction was collapsing newlines with `replace(/\s+/g, ' ')`, destroying line structure before header detection could run
3. **Late Detection**: Headers were being detected during chunking phase when line boundaries were already lost

### Key Discovery
- Raw PDF text shows "Pulling hydrogen" correctly on its own line (confirmed via hexdump)
- Text processing pipeline was joining lines with spaces before header detection
- Need to detect headers at page level BEFORE any cross-page merging

### Implementation Status
✅ **Completed**:
- Moved header detection to page level (`markHeadersInText()` in chapter-detector.js)
- Fixed newline preservation in `extractRawTextFromItems()` 
- Added header marking system with `⟨⟨HEADER⟩⟩` tags
- Modified chunking to recognize marked headers

❌ **Still Testing**:
- Need to verify headers are actually being detected
- Clean up debug code
- Run final validation tests

## Next Steps

### Immediate Actions
1. **Run Clean Test**: Execute parser without debug output to check results
2. **Validate Detection**: Confirm "Pulling hydrogen", "Circular reasoning", "Separating charge" are found
3. **Remove Debug Code**: Clean up console.log statements from testing
4. **Performance Check**: Ensure no performance regression from early header detection

### Testing Commands
```bash
# Test header detection
./parseBook.sh
python3 -c "
import json
data = json.load(open('output.json'))
headers = []
for chapter in data['chapters']:
    for chunk in chapter['content']['chunks']:
        if chunk.get('type') == 'header':
            headers.append(chunk['text'])
print(f'Headers found: {len(headers)}')
for h in headers[:10]: print(f'- \"{h}\"')
"

# Verify specific headers
grep -q "Pulling hydrogen" output.json && echo "✅ Found" || echo "❌ Missing"
```

### Final Validation
- [ ] All 6-rule headers detected correctly
- [ ] No false positives (400+ word "headers")
- [ ] Clean separation between headers and content
- [ ] Performance acceptable
- [ ] Code cleaned of debug statements

## Files Modified

1. `text-processor.js` - Added `markHeadersInText()` and `isHeader()` functions
2. `chapter-detector.js` - Calls `markHeadersInText()` at page level
3. `link-resolver.js` - Fixed newline preservation in `extractRawTextFromItems()`
4. `chunk-processor.js` - Changed content joining from space to newline

This approach moves header detection to the **correct phase** (page-level before merging) and preserves the **line structure** needed for the 6-rule analysis. 