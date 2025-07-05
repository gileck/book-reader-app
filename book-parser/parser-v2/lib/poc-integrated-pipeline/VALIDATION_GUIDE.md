# Manual Validation Guide

## Step 1: Text Extraction - Validation Files

### 📁 Step Output Location
```
output/step-01-text-extraction/
├── extracted-text.json    (739KB) - Complete extracted text with metadata
├── VALIDATION_RESULTS.txt (2.2KB) - Human-readable validation summary
```

### 🔍 Debug Output Location  
```
debug/
├── step-01-text-extraction.json    (841B) - Debug info and statistics
```

### 📋 What to Validate

#### 1. **Validation Results File**: `output/step-01-text-extraction/VALIDATION_RESULTS.txt`
**Contains:**
- Complete validation checklist with results
- Statistics summary
- Pass/fail status
- Manual review checklist
- File locations and sizes
- Text sample preview

**Check for:**
- ✅ Status: "PASSED - All validation criteria met"
- ✅ All checklist items marked with ☑
- ✅ Statistics within expected ranges
- ✅ Text sample is readable

#### 2. **Main Output File**: `output/step-01-text-extraction/extracted-text.json`
**Contains:**
- `rawText`: Full extracted text from PDF (733,647 characters)
- `metadata`: Statistics about the extraction
- `textSample`: First 1000 characters for preview
- `lastSample`: Last 1000 characters for preview

**Check for:**
- ✅ Text is readable and well-formatted
- ✅ Literal `\n` characters are preserved
- ✅ Text contains expected book content
- ✅ No corruption or missing sections

#### 3. **Debug File**: `debug/step-01-text-extraction.json`
**Contains:**
- Success/failure status
- Statistics (character count, line count, etc.)
- Error tracking
- Timestamp

**Check for:**
- ✅ `success: true`
- ✅ `totalCharacters: 733647`
- ✅ `totalLines: 13139`
- ✅ `literalNewlines: true`
- ✅ `errors: []` (empty array)

### 🎯 Validation Criteria (All Met)
- [x] Text extraction completes without errors
- [x] Character count > 400,000 (733,647 characters)
- [x] Line count > 10,000 (13,139 lines)
- [x] Literal `\n` characters preserved
- [x] Debug file generated successfully
- [x] Text sample shows readable content

### 📖 How to Review

1. **Start with the validation results file (EASIEST):**
   ```bash
   # View complete validation summary
   cat output/step-01-text-extraction/VALIDATION_RESULTS.txt
   
   # Check all files in the step folder
   ls -la output/step-01-text-extraction/
   ```

2. **Review the main output file:**
   ```bash
   # View file info
   ls -la output/step-01-text-extraction/extracted-text.json
   
   # View metadata only (without the full text)
   jq '.metadata' output/step-01-text-extraction/extracted-text.json
   
   # View text sample
   jq '.textSample' output/step-01-text-extraction/extracted-text.json
   ```

3. **Check the debug file:**
   ```bash
   cat debug/step-01-text-extraction.json
   ```

4. **Verify text quality:**
   ```bash
   # Check if text contains expected content
   jq '.textSample' output/step-01-text-extraction/extracted-text.json | grep -i "transformer"
   ```

### ✅ Approval Process

**To approve Step 1:**
1. Review the output files above
2. Verify all validation criteria are met
3. Confirm text quality is acceptable
4. Give approval to proceed to Step 2

**To reject Step 1:**
1. Identify specific issues
2. Request modifications
3. Re-run validation after fixes

---

## Next Steps

Once Step 1 is approved, we'll proceed to:
- **Step 2**: Chapter Detection Implementation & Validation
- Output will be saved to: `output/step-02-chapter-detection/` 