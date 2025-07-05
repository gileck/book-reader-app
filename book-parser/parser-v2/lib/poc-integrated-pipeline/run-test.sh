#!/bin/bash

# Test runner for POC Integrated Pipeline
# Validates that poc-script.js works correctly

echo "🧪 POC Integrated Pipeline Test Runner"
echo "====================================="
echo

# Check if book.pdf exists
if [ ! -f "../../book.pdf" ]; then
    echo "❌ Error: book.pdf not found at ../../book.pdf"
    echo "Please ensure the PDF file is in the correct location"
    exit 1
fi

echo "✅ Found book.pdf"
echo

# Run the test
echo "🚀 Running validation test..."
node test-poc-script.js

# Capture exit code
exit_code=$?

echo
if [ $exit_code -eq 0 ]; then
    echo "🎉 Test completed successfully!"
else
    echo "❌ Test failed with exit code $exit_code"
fi

exit $exit_code 