# Book Parser & Upload Script Guide

## Overview

The `run-parser-and-upload.js` script provides both interactive and non-interactive modes for parsing PDF books and uploading them to the database.

## Features

### 1. **Interactive Mode** (Recommended for first-time use)
When you run the script without specifying all options, it will guide you through:
- 📂 Folder selection (if not provided)
- 🎯 Operation mode selection
- ✅ Shows the exact command to rerun with same options **BEFORE starting operations**

### 2. **Non-Interactive Mode** (For repeated operations)
Use command-line flags to skip all prompts and run directly with your chosen options.

## Usage

### Interactive Mode Examples

```bash
# Fully interactive - select folder and mode
node run-parser-and-upload.js

# Interactive mode selection with folder specified
node run-parser-and-upload.js "./The Breathing Cure"

# Interactive with force reparse
node run-parser-and-upload.js "./The Breathing Cure" --force-reparse
```

**Before starting operations**, the script will show you the equivalent non-interactive command:

```
🎯 Mode: parse-upload-images

💡 To re-run with the same options without prompts:
   node files/run-parser-and-upload.js "files/The Breathing Cure" --mode=parse-upload-images

📚 Starting book parser...
   [parsing operations begin here]
```

**Note**: The paths shown are relative to your current working directory. If you run the script from different locations, it will adjust the paths accordingly:
- From project root: `node files/run-parser-and-upload.js "files/The Breathing Cure" --mode=...`
- From files directory: `node run-parser-and-upload.js "The Breathing Cure" --mode=...`

### Non-Interactive Mode Examples

```bash
# Parse only (no upload)
node run-parser-and-upload.js "The Breathing Cure" --mode=parse-only

# Parse and upload (without images)
node run-parser-and-upload.js "The Breathing Cure" --mode=parse-upload

# Parse and upload with images to Vercel Blob
node run-parser-and-upload.js "The Breathing Cure" --mode=parse-upload-images

# Upload only (skip parsing, use existing output)
node run-parser-and-upload.js "The Breathing Cure" --mode=upload-only

# Upload only with images
node run-parser-and-upload.js "The Breathing Cure" --mode=upload-only-images

# With force reparse (ignore cached .txt file)
node run-parser-and-upload.js "The Breathing Cure" --mode=parse-upload --force-reparse
```

## Available Modes

| Mode | Description | Requires Existing Output |
|------|-------------|-------------------------|
| `parse-only` | Only parse the book, don't upload | No |
| `parse-upload` | Parse and upload to database (book content only) | No |
| `parse-upload-images` | Parse and upload with images to Vercel Blob | No |
| `upload-only` | Use existing output to upload (book content only) | Yes ✓ |
| `upload-only-images` | Use existing output and upload with images | Yes ✓ |

## Workflow Recommendations

### First Time Processing a Book

1. **Navigate to the desired directory** (project root or files directory)

2. **Run interactively** to see options and verify everything works:
   ```bash
   # From project root
   node files/run-parser-and-upload.js
   
   # OR from files directory
   cd files
   node run-parser-and-upload.js
   ```

3. **Select your folder** from the list (shows which have existing output)

4. **Choose mode** based on your needs:
   - Testing? → `parse-only`
   - Production upload? → `parse-upload-images`

5. **Copy the suggested command** shown upfront (before operations start) for future reruns
   - The command will have correct paths based on your current directory

### Reprocessing a Book

Use the non-interactive command from your first run (paths will be relative to where you ran it):

```bash
# Example command (generated based on your working directory)
node files/run-parser-and-upload.js "files/The Breathing Cure" --mode=parse-upload-images

# OR if you ran from files directory
node run-parser-and-upload.js "The Breathing Cure" --mode=parse-upload-images
```

### Uploading Images Later

If you initially skipped images and want to add them:
```bash
node run-parser-and-upload.js "The Breathing Cure" --mode=upload-only-images
```

## Upload Behavior

### Book Matching

When uploading, the script will:

1. **Check by title** - Look for exact match (case-insensitive)
   - ✅ Found → Update that book automatically
   
2. **If not found** - Show interactive prompt:
   - ➕ Create new book: "[Parsed Title]"
   - 📚 Or select from all existing books in database
   
3. **Only creates new book** if you explicitly choose "Create new book"

This prevents accidental duplicate books and allows flexible book management.

## Smart Path Handling

The script automatically generates commands with correct paths based on your current working directory:

### Running from Project Root
```bash
# Interactive
node files/run-parser-and-upload.js

# Generated command will be:
node files/run-parser-and-upload.js "files/The Breathing Cure" --mode=parse-upload
```

### Running from Files Directory
```bash
# Interactive (from files directory)
node run-parser-and-upload.js

# Generated command will be:
node run-parser-and-upload.js "The Breathing Cure" --mode=parse-upload
```

**Benefits:**
- ✅ Copy/paste commands work from where you ran them
- ✅ No manual path adjustments needed
- ✅ Works whether you're in project root or files directory

## Command-Line Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Show help message |
| `--force-reparse` | `-f` | Force re-extraction from PDF (ignore cached .txt file) |
| `--mode=<mode>` | - | Operation mode (skips interactive selection) |

## Text File Caching

The parser caches extracted text to speed up subsequent runs:

- **First run**: Extracts text from PDF → saves to `<book-name>.txt`
- **Subsequent runs**: Uses the cached `.txt` file (faster)
- **Manual editing**: You can edit the `.txt` file before rerunning
- **Force refresh**: Use `--force-reparse` to regenerate from PDF

## Examples by Use Case

### Development & Testing
```bash
# From files directory
cd files

# Parse only, check output manually
node run-parser-and-upload.js "My Book" --mode=parse-only

# If output looks good, upload without reparsing
node run-parser-and-upload.js "My Book" --mode=upload-only
```

### Production Upload (With Images)
```bash
# From project root
node files/run-parser-and-upload.js "files/My Book" --mode=parse-upload-images

# OR from files directory
cd files
node run-parser-and-upload.js "My Book" --mode=parse-upload-images
```

### Fixing Parser Issues
```bash
# Force reparse from PDF and upload (from files directory)
node run-parser-and-upload.js "My Book" --mode=parse-upload --force-reparse
```

### Batch Processing
```bash
# From files directory - use a simple shell loop
cd files
for book in "Book1" "Book2" "Book3"; do
  node run-parser-and-upload.js "$book" --mode=parse-upload-images
done
```

## Troubleshooting

### "Upload-only mode requires an existing output folder"
- You selected upload-only but the folder doesn't have parsed output
- Solution: Run with `parse-upload` mode first, or choose a different folder

### "Invalid mode: ..."
- You specified an invalid mode value
- Solution: Use one of: `parse-only`, `parse-upload`, `parse-upload-images`, `upload-only`, `upload-only-images`

### "Multiple PDF files found"
- The folder contains more than one PDF file
- Solution: Keep only one PDF file per folder

### "No PDF files found"
- The folder doesn't contain any PDF files
- Solution: Check the folder path or add a PDF file

## Tips

1. **Use interactive mode first** to understand the workflow
2. **Copy the suggested command upfront** (shown before operations start) for future runs
3. **Paths are automatic** - The command will work from where you ran it (no path adjustments needed)
4. **Start with parse-only** when testing parser changes
5. **Use upload-only** when you just need to re-upload existing output
6. **Force reparse sparingly** - cached text files are faster and allow manual fixes
7. **Command appears early** - You can copy it immediately after making selections, even if parsing takes a long time
8. **Recommended location** - Run from `files/` directory for shorter paths in commands

## Environment Variables

- `BLOB_READ_WRITE_TOKEN` - Required for uploading images to Vercel Blob
  - Without this, images stay local (not uploaded to cloud)
  - Get from Vercel dashboard

---

**Last Updated**: Based on latest script version with --mode flags support

