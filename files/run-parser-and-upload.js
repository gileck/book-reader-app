const parser = require('../book-parser/parser/parser.js');
const { uploadParsedBookV2 } = require('../book-parser/parser/upload-book.js');
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');

function findPdfFile(folderPath) {
    if (!fs.existsSync(folderPath)) {
        throw new Error(`Directory not found: ${folderPath}`);
    }

    if (!fs.statSync(folderPath).isDirectory()) {
        throw new Error(`Path is not a directory: ${folderPath}`);
    }

    const files = fs.readdirSync(folderPath);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
        throw new Error(`No PDF files found in directory: ${folderPath}\nPlease provide a directory containing exactly one PDF file.`);
    }

    if (pdfFiles.length > 1) {
        throw new Error(`Multiple PDF files found in directory: ${folderPath}\nPlease ensure only one PDF file exists.\nFound: ${pdfFiles.join(', ')}`);
    }

    return path.join(folderPath, pdfFiles[0]);
}

function hasOutputFolder(folderPath) {
    const outputPath = path.join(folderPath, 'output');
    return fs.existsSync(outputPath) && fs.existsSync(path.join(outputPath, 'output.json'));
}

function getBookFolders(filesDir) {
    if (!fs.existsSync(filesDir)) {
        return [];
    }

    const items = fs.readdirSync(filesDir);
    const folders = items.filter(item => {
        const fullPath = path.join(filesDir, item);
        return fs.statSync(fullPath).isDirectory();
    });

    return folders.sort();
}

function showHelp() {
    console.log(`
Generic Book Parser & Uploader

Usage: node run-parser-and-upload.js [options] [FOLDER_PATH]

Arguments:
  FOLDER_PATH    Path to folder containing a single PDF file (optional)
                 If not provided, you can select from available folders interactively

Description:
  Processes a PDF book in the specified folder and optionally uploads it to the database.

Requirements:
  - The specified folder must contain exactly one PDF file
  - Creates an 'output' folder in the same directory as the PDF

Features:
  - Interactive folder selection from /files directory if no path provided
  - Interactive cache clearing menu (clear all or from specific step)
  - Interactive mode selection (parse only, parse + upload, or upload only)
  - Automatically finds the PDF file in the specified folder
  - Runs the complete book parsing pipeline with validation
  - Creates output folder with parsed content and extracted images

Options:
  --help, -h                    Show this help message
  --force-reparse, -f           Force re-extraction from PDF (ignore cached .txt file)
  --mode=<mode>                 Operation mode (skip interactive mode selection)
  --no-cache                    Disable step caching (re-run all steps)
  --clear-cache                 Clear all cached steps before running
  --clear-cache-from=<step>     Clear cache from specific step onwards (e.g., step-4)

Modes (use with --mode flag):
  parse-only                    Only parse the book, don't upload
  parse-upload                  Parse and upload to database (without images)
  parse-upload-images           Parse and upload with images to Vercel Blob
  upload-only                   Use existing output file to upload (without images)
  upload-only-images            Use existing output file and upload with images

Text File Caching:
  - First run: Extracts text from PDF and saves to <book-name>.txt
  - Subsequent runs: Uses the .txt file (faster, allows manual editing)
  - Use --force-reparse to regenerate .txt from PDF

Step Output Caching:
  - By default, validated step outputs are cached in .parser-cache/ directory
  - Subsequent runs skip cached steps (94% faster for fully cached runs!)
  - Cache is automatically invalidated if PDF file changes
  - Use --no-cache to disable caching and re-run all steps
  - Use --clear-cache to delete all cached steps before running
  - Use --clear-cache-from=step-X to invalidate cache from step X onwards
    (useful when debugging a specific step but keeping earlier cached steps)

Examples:
  # Interactive mode - select folder and mode
  node run-parser-and-upload.js
  
  # Interactive mode with specific folder
  node run-parser-and-upload.js ./my-book-folder
  
  # Non-interactive mode with all options specified
  node run-parser-and-upload.js ./my-book-folder --mode=parse-upload
  node run-parser-and-upload.js "The Breathing Cure" --mode=parse-upload-images
  node run-parser-and-upload.js ./my-book-folder --mode=upload-only
  
  # With force reparse
  node run-parser-and-upload.js ./my-book-folder --force-reparse --mode=parse-only
  
  # Disable step caching (re-run all steps)
  node run-parser-and-upload.js ./my-book-folder --no-cache
  
  # Clear all cached steps before running
  node run-parser-and-upload.js ./my-book-folder --clear-cache
  
  # Debug step 4 - clear cache from step 4 onwards (keeps cache for steps 1-3)
  node run-parser-and-upload.js ./my-book-folder --clear-cache-from=step-4

Note: When running in interactive mode, the script will show the equivalent 
      non-interactive command BEFORE starting operations, making it easy to 
      copy for future re-runs with the same options.
`);
}

async function selectFolder() {
    const filesDir = path.join(__dirname);
    const folders = getBookFolders(filesDir);

    if (folders.length === 0) {
        throw new Error('No book folders found in /files directory');
    }

    const choices = folders.map(folder => {
        const folderPath = path.join(filesDir, folder);
        const hasOutput = hasOutputFolder(folderPath);
        const label = hasOutput ? `${folder} (has output)` : folder;
        return {
            name: label,
            value: folder,
            short: folder
        };
    });

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'folder',
            message: 'Select a book folder:',
            choices: choices,
            pageSize: 15
        }
    ]);

    return path.join(filesDir, answer.folder);
}

async function selectCacheClearOption(pdfPath) {
    const answer = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'clearCache',
            message: 'Do you want to clear cached steps before running?',
            default: false
        }
    ]);

    if (!answer.clearCache) {
        return { clearCache: false, clearCacheFrom: null };
    }

    // Ask which steps to clear
    const stepChoices = [
        { name: 'Clear ALL cached steps', value: 'all', short: 'All' },
        new inquirer.Separator('─── Or clear from specific step onwards ───')
    ];

    const availableSteps = parser.getAvailableSteps();
    const stepDescriptions = parser.getStepDescriptions();
    
    for (const step of availableSteps) {
        const desc = stepDescriptions[step] || step;
        stepChoices.push({
            name: `From ${step} onwards - ${desc}`,
            value: step,
            short: `From ${step}`
        });
    }

    const stepAnswer = await inquirer.prompt([
        {
            type: 'list',
            name: 'step',
            message: 'Which steps to clear?',
            choices: stepChoices,
            pageSize: 15
        }
    ]);

    if (stepAnswer.step === 'all') {
        return { clearCache: true, clearCacheFrom: null };
    } else {
        return { clearCache: false, clearCacheFrom: stepAnswer.step };
    }
}

async function selectMode(hasExistingOutput) {
    const modes = [
        {
            name: 'Parser only',
            value: 'parse-only',
            short: 'Parse only'
        },
        {
            name: 'Parse + Upload (book content only)',
            value: 'parse-upload',
            short: 'Parse + Upload'
        },
        {
            name: 'Parse + Upload + Images (upload to Vercel Blob)',
            value: 'parse-upload-images',
            short: 'Parse + Upload + Images'
        }
    ];

    // Add upload-only options if there's an existing output folder
    if (hasExistingOutput) {
        modes.push(
            {
                name: 'Upload only (book content only)',
                value: 'upload-only',
                short: 'Upload only'
            },
            {
                name: 'Upload only + Images (upload to Vercel Blob)',
                value: 'upload-only-images',
                short: 'Upload only + Images'
            }
        );
    }

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'mode',
            message: 'Select operation mode:',
            choices: modes
        }
    ]);

    return answer.mode;
}

async function runParser(pdfPath, outputPath, options = {}) {
    const { forceReparse = false, useCache = true } = options;

    console.log(`📚 Starting book parser...\n`);
    console.log(`   Input:  ${pdfPath}`);
    console.log(`   Output: ${outputPath}`);

    // Show cache status
    if (!useCache) {
        console.log(`   Cache:  Disabled (--no-cache)`);
    } else {
        console.log(`   Cache:  Enabled`);
    }
    console.log('');

    await parser.parseBook(pdfPath, outputPath, {
        debug: true,
        validate: true,
        forceReparse: forceReparse,
        useCache: useCache
    });

    console.log('\n✅ Parser completed successfully!');
}

async function runUpload(outputPath, uploadImages) {
    console.log('\n🚀 Running upload process...\n');

    if (uploadImages) {
        console.log('📤 Images will be uploaded to Vercel Blob');
    } else {
        console.log('⏭️ Skipping image upload (book content only)');
    }

    await uploadParsedBookV2(outputPath, {
        uploadImages: uploadImages
    });

    console.log('\n✅ Upload completed successfully!');
}

function parseModeFlag(args) {
    const modeArg = args.find(a => a.startsWith('--mode='));
    if (modeArg) {
        const mode = modeArg.split('=')[1];
        const validModes = ['parse-only', 'parse-upload', 'parse-upload-images', 'upload-only', 'upload-only-images'];
        if (!validModes.includes(mode)) {
            throw new Error(`Invalid mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
        }
        return mode;
    }
    return null;
}

function buildRerunCommand(folderName, mode, options, scriptDir) {
    const { forceReparse = false, noCache = false, clearCache = false, clearCacheFrom = null } = options;

    // Determine the script path relative to current working directory
    const cwd = process.cwd();
    const scriptPath = path.relative(cwd, path.join(scriptDir, 'run-parser-and-upload.js'));

    let cmd = `node ${scriptPath || 'run-parser-and-upload.js'}`;
    cmd += ` "${folderName}"`;
    cmd += ` --mode=${mode}`;
    if (forceReparse) {
        cmd += ' --force-reparse';
    }
    if (noCache) {
        cmd += ' --no-cache';
    }
    if (clearCache) {
        cmd += ' --clear-cache';
    }
    if (clearCacheFrom) {
        cmd += ` --clear-cache-from=${clearCacheFrom}`;
    }
    return cmd;
}

async function main() {
    try {
        const args = process.argv.slice(2);
        const flags = new Set(args.filter(a => a.startsWith('-')));
        const positionals = args.filter(a => !a.startsWith('-'));
        const forceReparse = flags.has('--force-reparse') || flags.has('-f');
        const noCache = flags.has('--no-cache');
        const clearCache = flags.has('--clear-cache');
        const modeFlag = parseModeFlag(args);

        // Parse --clear-cache-from flag
        let clearCacheFrom = null;
        const clearCacheFromArg = args.find(a => a.startsWith('--clear-cache-from='));
        if (clearCacheFromArg) {
            clearCacheFrom = clearCacheFromArg.split('=')[1];
            // Validate step name
            const validSteps = parser.getAvailableSteps();
            if (!validSteps.includes(clearCacheFrom)) {
                throw new Error(`Invalid step name: ${clearCacheFrom}. Valid steps: ${validSteps.join(', ')}`);
            }
        }

        // Show help if requested
        if (flags.has('--help') || flags.has('-h')) {
            showHelp();
            process.exit(0);
        }

        // Get folder path from command line argument or prompt user
        let targetDir;
        let folderName;
        const folderPath = positionals[0];
        let usedInteractiveFolderSelection = false;

        if (!folderPath) {
            console.log('📂 No folder path provided. Select from available folders:\n');
            targetDir = await selectFolder();
            usedInteractiveFolderSelection = true;
            // Get the folder name relative to current working directory
            folderName = path.relative(process.cwd(), targetDir);
        } else {
            targetDir = path.resolve(folderPath);
            folderName = folderPath; // Keep original input for command display
        }

        console.log(`\n📁 Selected folder: ${targetDir}`);

        // Check if output folder exists
        const outputPath = path.join(targetDir, 'output');
        const hasExistingOutput = hasOutputFolder(targetDir);

        if (hasExistingOutput) {
            console.log('✓ Found existing output folder');
        }

        // Select operation mode (from flag or interactively)
        let mode;
        let usedInteractiveModeSelection = false;

        if (modeFlag) {
            mode = modeFlag;
            console.log(`\n🎯 Mode: ${mode} (from --mode flag)\n`);

            // Validate upload-only modes require existing output
            if ((mode === 'upload-only' || mode === 'upload-only-images') && !hasExistingOutput) {
                throw new Error('Upload-only mode requires an existing output folder. Run parser first or choose a different mode.');
            }
        } else {
            mode = await selectMode(hasExistingOutput);
            usedInteractiveModeSelection = true;
            console.log(`\n🎯 Mode: ${mode}\n`);
        }

        // Check if mode involves parsing (not upload-only modes)
        const isParsing = !mode.startsWith('upload-only');
        
        // For interactive mode with parsing, offer cache clearing option
        let interactiveCacheSelection = false;
        let pdfPath = null; // Will be found when needed
        
        if (usedInteractiveFolderSelection && isParsing && !clearCache && !clearCacheFrom && !noCache) {
            // Find PDF path for cache clearing prompt
            console.log(`📁 Looking for PDF file in: ${targetDir}`);
            pdfPath = findPdfFile(targetDir);
            const pdfName = path.basename(pdfPath);
            console.log(`📄 Found PDF: ${pdfName}\n`);
            
            const cacheOptions = await selectCacheClearOption(pdfPath);
            
            if (cacheOptions.clearCache) {
                clearCache = true;
                interactiveCacheSelection = true;
            } else if (cacheOptions.clearCacheFrom) {
                clearCacheFrom = cacheOptions.clearCacheFrom;
                interactiveCacheSelection = true;
            }
        }

        // Show rerun command upfront if interactive selections were made
        if (usedInteractiveFolderSelection || usedInteractiveModeSelection || interactiveCacheSelection) {
            const rerunCmd = buildRerunCommand(folderName, mode, {
                forceReparse,
                noCache,
                clearCache,
                clearCacheFrom
            }, __dirname);
            console.log('💡 To re-run with the same options without prompts:');
            console.log(`   ${rerunCmd}\n`);
        }

        // Handle upload-only modes
        if (mode === 'upload-only' || mode === 'upload-only-images') {
            if (!hasExistingOutput) {
                throw new Error('No existing output folder found. Cannot run upload-only mode.');
            }
            const uploadImages = mode === 'upload-only-images';
            await runUpload(outputPath, uploadImages);
            console.log('\n✅ Process completed successfully!');
            process.exit(0);
        }

        // For all parse modes, find the PDF file (if not already found)
        if (!pdfPath) {
            console.log(`📁 Looking for PDF file in: ${targetDir}`);
            pdfPath = findPdfFile(targetDir);
            const pdfName = path.basename(pdfPath);
            console.log(`📄 Found PDF: ${pdfName}\n`);
        }

        // Handle cache clearing operations
        if (clearCache) {
            console.log('🧹 Clearing all cached steps...');
            parser.clearCache(pdfPath);
            console.log('✓ Cache cleared\n');
        } else if (clearCacheFrom) {
            console.log(`🧹 Clearing cached steps from ${clearCacheFrom} onwards...`);
            const clearedCount = parser.clearCacheFromStep(pdfPath, clearCacheFrom);
            console.log(`✓ Cleared ${clearedCount} cached step(s)\n`);
        }

        // Run parser for all parse modes
        await runParser(pdfPath, outputPath, {
            forceReparse: forceReparse,
            useCache: !noCache
        });

        // Run upload if requested
        if (mode === 'parse-upload' || mode === 'parse-upload-images') {
            const uploadImages = mode === 'parse-upload-images';
            await runUpload(outputPath, uploadImages);
        }

        console.log('\n✅ Process completed successfully!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();