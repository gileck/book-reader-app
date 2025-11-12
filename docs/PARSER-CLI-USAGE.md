# Parser CLI Usage Guide

## Overview

The book parser can be used via CLI for local development and testing. The CLI entry point is fully backward compatible with the refactored parser architecture.

## CLI Entry Point

**File**: `files/run-parser-and-upload.js`

This script provides an interactive and scriptable interface for parsing PDF books locally.

## Quick Start

### Interactive Mode (Recommended for First-Time Users)

```bash
cd /Users/gileck/projects/temp1
node files/run-parser-and-upload.js
```

This will:
1. Show available book folders
2. Let you select a folder
3. Ask which operation to perform (parse only, parse + upload, etc.)
4. Ask about cache clearing options
5. Show the equivalent non-interactive command for future runs

### Non-Interactive Mode

```bash
# Parse only (no upload)
node files/run-parser-and-upload.js ./files/MyBook --mode=parse-only

# Parse and upload (without images)
node files/run-parser-and-upload.js ./files/MyBook --mode=parse-upload

# Parse and upload with images to Vercel Blob
node files/run-parser-and-upload.js ./files/MyBook --mode=parse-upload-images

# Upload only (using existing output)
node files/run-parser-and-upload.js ./files/MyBook --mode=upload-only

# Upload only with images
node files/run-parser-and-upload.js ./files/MyBook --mode=upload-only-images
```

## Available Modes

| Mode | Description |
|------|-------------|
| `parse-only` | Only parse the PDF, don't upload to database |
| `parse-upload` | Parse and upload book content (no images) |
| `parse-upload-images` | Parse and upload with images to Vercel Blob |
| `upload-only` | Upload existing output (requires output folder) |
| `upload-only-images` | Upload existing output with images |

## Command-Line Options

### Cache Control

```bash
# Disable caching (re-run all steps)
node files/run-parser-and-upload.js ./files/MyBook --no-cache

# Clear all cached steps before running
node files/run-parser-and-upload.js ./files/MyBook --clear-cache

# Clear cache from specific step onwards (e.g., step-4)
node files/run-parser-and-upload.js ./files/MyBook --clear-cache-from=step-4
```

### Force Reparse

```bash
# Force re-extraction from PDF (ignore cached .txt file)
node files/run-parser-and-upload.js ./files/MyBook --force-reparse
```

### Validation Error Handling

```bash
# Automatically approve all validation errors (skip interactive prompts)
node files/run-parser-and-upload.js ./files/MyBook --approve-all-validation-errors

# Interactive mode (default): Prompts for approval when validation errors occur
node files/run-parser-and-upload.js ./files/MyBook --mode=parse-only
```

When validation errors occur without the `--approve-all-validation-errors` flag:
1. Parser displays error summary and chapter breakdown
2. Shows path to detailed `validation-output.txt` file
3. Prompts user to approve or reject errors
4. If approved: continues to next step
5. If rejected: stops parsing

### Help

```bash
node files/run-parser-and-upload.js --help
```

## Folder Structure

The CLI expects this structure:

```
files/
├── MyBook/
│   ├── book.pdf              # Your PDF file (any name)
│   └── output/               # Created by parser
│       ├── output.json       # Parser output
│       ├── images/           # Extracted images
│       └── steps/            # Debug output (optional)
└── run-parser-and-upload.js  # CLI entry point
```

**Requirements**:
- Each book folder must contain **exactly one PDF file**
- The PDF can have any name
- The `output` folder is created automatically

## How It Works

### 1. Direct Parser Usage (Current Implementation)

The CLI calls `parser.parseBook()` directly:

```javascript
const parser = require('../book-parser/parser/parser.js');

await parser.parseBook(pdfPath, outputPath, {
    debug: true,
    validate: true,
    forceReparse: false,
    useCache: true
});
```

**Benefits**:
- ✅ Simple and direct
- ✅ Fully backward compatible
- ✅ No extra dependencies
- ✅ Works with all parser features (caching, validation, etc.)

### 2. Using Local Runner (Alternative)

You can also use the local runner for more control:

```javascript
const { runLocalParser } = require('../book-parser/parser/runners/localRunner.js');

await runLocalParser(pdfPath, outputPath, {
    debug: true,
    validate: true,
    verbose: true  // Extra logging
});
```

**Benefits**:
- ✅ Provides step-by-step logging
- ✅ Reads `skipped-validation-errors.json` automatically
- ✅ Better progress visibility

## Parser Features Available in CLI

### 1. Step Caching

The parser automatically caches validated step outputs:

```bash
# First run: ~5 minutes
node files/run-parser-and-upload.js ./files/MyBook --mode=parse-only

# Second run: ~20 seconds (94% faster!)
node files/run-parser-and-upload.js ./files/MyBook --mode=parse-only
```

**Cache Location**: `.parser-cache/{pdf-hash}/` in the book folder

**Cache Invalidation**: Automatic when PDF file changes

### 2. Validation Error Handling

The parser provides two ways to handle validation errors:

#### Option 1: Interactive Approval (Recommended)

When validation errors occur, the parser will:
1. Display error summary and per-chapter breakdown
2. Show path to detailed `validation-output.txt` file
3. Prompt you to approve or reject:
   - ✅ **Approve**: Continue parsing to next step
   - ❌ **Reject**: Stop parsing immediately

```bash
# Interactive mode (default)
node files/run-parser-and-upload.js ./files/MyBook --mode=parse-only
```

#### Option 2: Auto-Approve All Errors

Use the `--approve-all-validation-errors` flag to automatically approve all validation errors:

```bash
# Auto-approve mode
node files/run-parser-and-upload.js ./files/MyBook --approve-all-validation-errors
```

#### Option 3: File-Based Skipping (Advanced)

Create a `skipped-validation-errors.json` file in the book folder to skip specific errors:

```json
[
  {
    "step": "step-5",
    "chunkId": "1_42"
  },
  {
    "step": "step-4",
    "chunkId": "3_*"
  }
]
```

### 3. Debug Output

With `debug: true`, the parser saves intermediate outputs:

```
output/
├── output.json              # Final output
├── steps/                   # Debug output
│   ├── step-1.json         # Text extraction
│   ├── step-2-1.json       # Chapter detection
│   ├── step-3-2.json       # Image extraction
│   └── ...
└── validation.json          # Validation results
```

## Programmatic Usage

You can also use the parser programmatically in your own scripts:

### Basic Usage

```javascript
const parser = require('./book-parser/parser/parser.js');

async function parseMyBook() {
    const result = await parser.parseBook(
        './files/MyBook/book.pdf',
        './files/MyBook/output',
        {
            validate: true,
            debug: false,
            useCache: true
        }
    );
    
    console.log('Parsed book:', result.finalOutput.metadata.title);
    console.log('Chapters:', result.finalOutput.chapters.length);
}

parseMyBook();
```

### With Callbacks (Advanced)

```javascript
const parser = require('./book-parser/parser/parser.js');

async function parseWithProgress() {
    const result = await parser.parseBook(
        './files/MyBook/book.pdf',
        './files/MyBook/output',
        {
            validate: true,
            
            // Progress callbacks
            onStepStart: async (stepName, stepNumber, totalSteps) => {
                console.log(`[${stepNumber}/${totalSteps}] Starting ${stepName}...`);
            },
            
            onStepProgress: async (stepName, progress) => {
                console.log(`  ${stepName}: ${progress}%`);
            },
            
            onStepComplete: async (stepName) => {
                console.log(`  ✓ ${stepName} completed`);
            },
            
            // Validation error handler
            onValidationError: async (stepName, errorDetails) => {
                console.log(`⚠️  Validation errors in ${stepName}:`);
                console.log(errorDetails.validationOutput);
                
                // Auto-approve all errors (for testing)
                return true;
            }
        }
    );
    
    return result;
}

parseWithProgress();
```

### Using Local Runner

```javascript
const { runLocalParser } = require('./book-parser/parser/runners/localRunner.js');

async function parseWithLocalRunner() {
    const result = await runLocalParser(
        './files/MyBook/book.pdf',
        './files/MyBook/output',
        {
            debug: true,
            verbose: true,  // Extra logging
            useCache: true
        }
    );
    
    return result;
}

parseWithLocalRunner();
```

## Available Parser Functions

### `parseBook(pdfPath, outputPath, options)`

Parse an entire PDF book.

**Parameters**:
- `pdfPath` (string): Path to PDF file
- `outputPath` (string): Path for output folder
- `options` (object): Parsing options

**Options**:
```javascript
{
    validate: true,              // Run validation
    debug: false,                // Save debug output
    useCache: true,              // Use step caching
    forceReparse: false,         // Force re-extraction from PDF
    
    // Optional callbacks
    skipErrorsProvider: async (stepName) => [],
    onValidationError: async (stepName, errorDetails) => true,
    onStepStart: async (stepName, stepNumber, totalSteps) => {},
    onStepProgress: async (stepName, progress) => {},
    onStepComplete: async (stepName) => {}
}
```

**Returns**: Parser output with metadata and chapters

### `parseBookSteps(pdfPath, outputPath, stepNames, options)`

Parse specific steps only.

**Parameters**:
- `pdfPath` (string): Path to PDF file
- `outputPath` (string): Path for output folder
- `stepNames` (string[]): Array of step names to run
- `options` (object): Same as `parseBook`

**Example**:
```javascript
await parser.parseBookSteps(
    './book.pdf',
    './output',
    ['step-1', 'step-3-2', 'step-5'],
    { validate: true }
);
```

### `getAvailableSteps()`

Get list of all available step names.

**Returns**: Array of step names (e.g., `['step-1', 'step-2-1', ...]`)

### `getStepDescriptions()`

Get descriptions for all steps.

**Returns**: Object mapping step names to descriptions

### `clearCache(pdfPath)`

Clear all cached steps for a PDF.

**Parameters**:
- `pdfPath` (string): Path to PDF file

### `clearCacheFromStep(pdfPath, stepName)`

Clear cache from a specific step onwards.

**Parameters**:
- `pdfPath` (string): Path to PDF file
- `stepName` (string): Step to start clearing from

**Returns**: Number of steps cleared

## Troubleshooting

### Issue: "No PDF files found in directory"

**Solution**: Ensure your book folder contains exactly one PDF file.

### Issue: "Multiple PDF files found in directory"

**Solution**: Remove extra PDF files or move them to separate folders.

### Issue: Parser is slow

**Solution**: 
1. Use caching (enabled by default)
2. On first run, parsing takes 5-10 minutes
3. Subsequent runs with cache: ~20 seconds

### Issue: Validation errors

**Solution**:
1. **Interactive Mode (Recommended)**: Review errors and choose to approve or reject
2. **Auto-Approve**: Use `--approve-all-validation-errors` flag to skip prompts
3. **File-Based**: Edit `skipped-validation-errors.json` in book folder for specific errors

### Issue: Cache not working

**Solution**:
1. Check `.parser-cache/` folder exists in book directory
2. Ensure `useCache: true` in options
3. Cache is invalidated if PDF changes

### Issue: "Cannot find module"

**Solution**: Run from the project root:
```bash
cd /Users/gileck/projects/temp1
node files/run-parser-and-upload.js
```

## Performance Tips

1. **Use caching**: Default behavior, saves 94% time on re-runs
2. **Clear cache selectively**: Use `--clear-cache-from=step-X` to only re-run specific steps
3. **Skip validation**: Set `validate: false` for faster parsing (not recommended)
4. **Disable debug**: Set `debug: false` to skip saving intermediate outputs

## Examples

### Example 1: First-Time Parse

```bash
# Interactive mode - recommended for first time
node files/run-parser-and-upload.js

# Select folder: MyBook
# Select mode: Parse only
# Cache options: No (use existing cache)

# Output: Shows equivalent command for next time
# node files/run-parser-and-upload.js "MyBook" --mode=parse-only
```

### Example 2: Debug Specific Step

```bash
# Clear cache from step 4 onwards and re-run
node files/run-parser-and-upload.js ./files/MyBook \
  --mode=parse-only \
  --clear-cache-from=step-4
```

### Example 3: Parse and Upload

```bash
# Parse and upload to database
node files/run-parser-and-upload.js ./files/MyBook \
  --mode=parse-upload-images
```

### Example 4: Upload Existing Output

```bash
# Upload previously parsed book
node files/run-parser-and-upload.js ./files/MyBook \
  --mode=upload-only-images
```

### Example 5: Handle Validation Errors

```bash
# Interactive mode - prompts for approval on validation errors
node files/run-parser-and-upload.js ./files/MyBook --mode=parse-only

# Auto-approve all validation errors
node files/run-parser-and-upload.js ./files/MyBook \
  --mode=parse-only \
  --approve-all-validation-errors

# Combined with force reparse
node files/run-parser-and-upload.js ./files/MyBook \
  --mode=parse-upload \
  --force-reparse \
  --approve-all-validation-errors
```

## Comparison: CLI vs. Production

| Feature | CLI (Local) | Production (Web) |
|---------|-------------|------------------|
| **Entry Point** | `run-parser-and-upload.js` | `/api/upload/parse` |
| **Parser Usage** | Direct `parser.parseBook()` | Via `productionRunner.ts` |
| **Progress Updates** | Console logs | Server-Sent Events (SSE) |
| **Input** | Local PDF file | Uploaded file or URL |
| **Output** | Local `output/` folder | S3 storage |
| **Validation Errors** | `skipped-validation-errors.json` | User approval via API |
| **Caching** | Enabled (file-based) | Disabled |
| **Images** | Local `output/images/` | S3 storage |
| **State** | In-memory | MongoDB |

## Conclusion

The CLI parser is:
- ✅ **Fully functional** - All parser features work
- ✅ **Backward compatible** - No breaking changes
- ✅ **Easy to use** - Interactive and scriptable
- ✅ **Fast** - Caching saves 94% time on re-runs
- ✅ **Flexible** - Direct usage or via local runner

For production web uploads, see [BOOK-UPLOAD-FEATURE.md](./BOOK-UPLOAD-FEATURE.md).

