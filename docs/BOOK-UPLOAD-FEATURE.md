# Book Upload Feature - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [User Flows](#user-flows)
4. [Technical Implementation](#technical-implementation)
5. [API Reference](#api-reference)
6. [Database Schema](#database-schema)
7. [S3 Storage Structure](#s3-storage-structure)
8. [Error Handling](#error-handling)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Book Upload feature allows users to upload PDF books to their library. The system automatically parses the PDF, extracts text, images, chapters, links, and metadata, then allows users to review and approve the parsed content before adding it to their library.

### Key Features
- ✅ PDF upload (file or URL)
- ✅ Real-time parsing progress via Server-Sent Events (SSE)
- ✅ Automatic text extraction and chapter detection
- ✅ Image extraction and storage
- ✅ Validation error approval workflow
- ✅ Parser output preview before adding to library
- ✅ Persistent upload state (survives page reload)
- ✅ Automatic cleanup after finalization

---

## Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client (React)                          │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Upload Form   │  │  Upload List │  │  Preview Dialog    │  │
│  │  - File/URL    │  │  - Status    │  │  - Metadata        │  │
│  │  - Start       │  │  - Progress  │  │  - Chapters        │  │
│  └────────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SSE Stream + API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js)                         │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  /parse        │  │  /list       │  │  /finalize         │  │
│  │  (SSE Stream)  │  │  /status     │  │  /delete           │  │
│  │                │  │  /metadata   │  │  /approve-errors   │  │
│  └────────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Parser (Node.js)                            │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Text Extract  │  │  Chapter     │  │  Image Extract     │  │
│  │  PDF.js        │  │  Detection   │  │  pdfimages         │  │
│  └────────────────┘  └──────────────┘  └────────────────────┘  │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Link Extract  │  │  Validation  │  │  Metadata Extract  │  │
│  └────────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Storage & Database                            │
│  ┌────────────────┐  ┌──────────────────────────────────────┐  │
│  │  MongoDB       │  │  S3 (AWS)                            │  │
│  │  - bookUploads │  │  - PDFs                              │  │
│  │  - books       │  │  - Images                            │  │
│  │  - chapters    │  │  - Parser Output                     │  │
│  └────────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Flows

### 1. Success Flow: Upload → Parse → Add to Library

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant Parser
    participant S3
    participant DB

    User->>Client: Select PDF file or enter URL
    User->>Client: Click "START UPLOAD"
    
    Client->>Client: Show optimistic UI (temp upload item)
    Client->>API: POST /api/upload/parse (SSE stream)
    
    API->>DB: Create upload record (status: uploading)
    API->>Client: SSE: uploadId
    Client->>Client: Replace temp with real upload item
    
    API->>S3: Upload PDF
    API->>Client: SSE: progress 10% (PDF uploaded)
    
    API->>Parser: Start parsing
    Parser->>API: onStepStart (Step 1/12)
    API->>Client: SSE: step-start
    API->>DB: Update progress
    
    loop For each parser step
        Parser->>API: onStepProgress (45%)
        API->>Client: SSE: step-progress
        Parser->>API: onStepComplete
        API->>Client: SSE: step-complete
    end
    
    Parser->>Parser: Extract images to /tmp
    Parser->>API: Return result
    
    API->>S3: Upload images to uploads/${uploadId}/images/
    API->>Client: SSE: progress 90% (Uploading images)
    
    API->>S3: Upload output.json
    API->>Client: SSE: progress 95% (Saving output)
    
    API->>DB: Update status: success
    API->>Client: SSE: complete
    
    Client->>Client: Show "VIEW SUMMARY" button
    
    User->>Client: Click "VIEW SUMMARY"
    Client->>API: GET /api/upload/metadata
    API->>S3: Download output.json
    API->>Client: Return metadata
    Client->>Client: Show preview dialog
    
    User->>Client: Click "ADD TO LIBRARY"
    Client->>API: POST /api/upload/finalize
    
    API->>S3: Download output.json
    API->>DB: Create book
    API->>DB: Create chapters
    
    API->>S3: Move images (uploads → books)
    API->>S3: Delete upload PDF
    API->>S3: Delete parser output
    
    API->>DB: Update book with final imageBaseURL
    API->>Client: Return bookId
    
    Client->>Client: Navigate to /?bookId=${bookId}
```

### 2. Error Flow: Validation Errors → Approval → Continue

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant Parser
    participant DB

    Parser->>Parser: Run validation step
    Parser->>Parser: Detect validation errors
    
    Parser->>API: onValidationError (errorCount: 15)
    API->>DB: Update status: awaiting-approval
    API->>DB: Save validationErrors
    API->>Client: SSE: validation-error
    
    Client->>Client: Show "REVIEW ERRORS" button
    
    User->>Client: Click "REVIEW ERRORS"
    Client->>Client: Show ValidationErrorDialog
    
    User->>Client: Review errors
    User->>Client: Click "APPROVE & CONTINUE"
    
    Client->>API: POST /api/upload/approve-errors
    API->>DB: Save approved errors to skippedValidationErrors
    API->>DB: Update status: parsing
    API->>Client: Return success
    
    Note over API,Parser: Parser polls DB for approval
    Parser->>DB: Check for approval (exponential backoff)
    DB->>Parser: Found approved errors
    
    Parser->>Parser: Skip approved errors
    Parser->>Parser: Continue parsing
    
    Parser->>API: onStepComplete
    API->>Client: SSE: step-complete
    
    Note over Parser,Client: Continue with normal flow
```

### 3. Error Flow: Critical Parser Failure

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant Parser
    participant S3
    participant DB

    Parser->>Parser: Critical error (e.g., corrupted PDF)
    Parser->>API: Throw error
    
    API->>DB: Update status: failed
    API->>DB: Save error message + stack
    API->>Client: SSE: error
    
    Client->>Client: Show error message
    Client->>Client: Show "DELETE" button
    
    Note over S3: PDF remains in S3 for debugging
    Note over DB: Upload record preserved with error details
    
    User->>Client: Click "DELETE"
    Client->>API: POST /api/upload/delete
    
    API->>S3: Delete PDF
    API->>S3: Delete parser output (if exists)
    API->>S3: Delete images (if exist)
    API->>DB: Delete upload record
    
    API->>Client: Return success
    Client->>Client: Remove from list
```

### 4. User Flow: Delete Before Adding to Library

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant S3
    participant DB

    Note over Client: Upload has status: success
    
    User->>Client: Click "DELETE"
    Client->>Client: Show confirmation dialog
    
    User->>Client: Confirm deletion
    Client->>API: POST /api/upload/delete
    
    API->>DB: Get upload record
    API->>S3: Delete PDF (uploads/${uploadId}.pdf)
    API->>S3: Delete parser output
    API->>S3: List images (uploads/${uploadId}/images/)
    
    loop For each image
        API->>S3: Delete image
    end
    
    API->>DB: Delete upload record
    API->>Client: Return success
    
    Client->>Client: Remove from list
```

---

## Technical Implementation

### 1. Server-Sent Events (SSE) Stream

**File**: `src/pages/api/upload/parse.ts`

#### How SSE Works

SSE provides a one-way communication channel from server to client over HTTP. The server keeps the connection open and sends events as they occur.

**Key Configuration:**
```typescript
// Disable Next.js response buffering
export const config = {
    api: {
        bodyParser: { sizeLimit: '100mb' },
        responseLimit: false // Critical for SSE
    }
};

// Set SSE headers
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

// Flush headers immediately
res.flushHeaders();
```

**Event Format:**
```typescript
function sendSSE(res: NextApiResponse, data: Record<string, unknown>): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Force immediate delivery
    if (typeof (res as any).flush === 'function') {
        (res as any).flush();
    }
}
```

**Event Types:**
- `upload`: Initial upload progress (5-15%)
- `step-start`: Parser step started
- `step-progress`: Parser step progress update
- `step-complete`: Parser step completed
- `validation-error`: Validation errors detected, awaiting approval
- `finalizing`: Post-parser operations (90-98%)
- `complete`: Upload completed successfully
- `error`: Critical error occurred
- `heartbeat`: Keep-alive ping (every 15s)

#### Client-Side SSE Handling

**File**: `src/client/routes/UploadBook/UploadBook.tsx`

```typescript
const response = await fetch('/api/upload/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfBase64, pdfUrl, fileName })
});

const streamReader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
    const { done, value } = await streamReader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n');

    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));
            
            // Handle different event types
            switch (data.type) {
                case 'step-start':
                    // Update UI with current step
                    break;
                case 'validation-error':
                    // Show error review dialog
                    break;
                case 'complete':
                    // Mark as success
                    break;
            }
        }
    }
}
```

### 2. Parser Integration

**File**: `src/server/parser/productionRunner.ts`

The parser is a generic, reusable component that works in both local (CLI) and production (API) environments.

#### Parser Callbacks

The production runner provides callbacks to the parser for real-time updates:

```typescript
const onStepStart = async (stepName: string, stepNumber: number, totalSteps: number) => {
    const progress = Math.round((stepNumber / totalSteps) * 100);
    
    sendSSE(res, {
        type: 'step-start',
        step: stepName,
        stepNumber,
        totalSteps,
        progress
    });

    await updateBookUpload(uploadId, {
        currentStep: stepName,
        currentStepNumber: stepNumber,
        totalSteps,
        progress,
        status: 'parsing'
    });
};

const onValidationError = async (stepName: string, errorDetails: {
    step: string;
    errorCount: number;
    validationOutput: string;
    chapterErrorSummary?: string[];
}) => {
    // Save errors to database
    await updateBookUpload(uploadId, {
        status: 'awaiting-approval',
        validationErrors: [{
            step: errorDetails.step,
            message: `Step ${stepName} validation failed`,
            errorCount: errorDetails.errorCount,
            details: errorDetails.validationOutput,
            chapterErrorSummary: errorDetails.chapterErrorSummary || undefined
        }]
    });

    // Notify client
    sendSSE(res, {
        type: 'validation-error',
        step: stepName,
        errors: [/* ... */]
    });

    // Wait for user approval (polls DB with exponential backoff)
    const approved = await waitForApproval(uploadId, 60);
    return approved;
};
```

#### Approval Polling with Exponential Backoff

```typescript
async function waitForApproval(uploadId: string, timeoutMinutes: number): Promise<boolean> {
    const startTime = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;
    let pollInterval = 2000; // Start with 2 seconds
    const maxInterval = 10000; // Max 10 seconds

    while (Date.now() - startTime < timeoutMs) {
        const upload = await getBookUpload(uploadId);
        
        if (upload?.status === 'parsing') {
            return true; // User approved
        }
        
        if (upload?.status === 'failed') {
            return false; // User rejected or error occurred
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        // Exponential backoff
        pollInterval = Math.min(pollInterval * 1.5, maxInterval);
    }

    return false; // Timeout
}
```

### 3. Optimistic UI and Temp/Real Upload ID Flow

The upload feature uses an **optimistic UI pattern** to provide immediate feedback to users when they click "START UPLOAD", before the server creates the actual database record.

#### Why Optimistic UI?

Without optimistic UI, users would see nothing happen for several seconds after clicking "START UPLOAD" while:
1. The PDF is being encoded to base64 (for file uploads)
2. The HTTP request is sent to the server
3. The server creates a database record
4. The server starts the SSE stream

This delay creates a poor user experience. The optimistic UI pattern solves this by immediately showing a temporary upload item.

#### The Flow

**File**: `src/client/routes/UploadBook/UploadBook.tsx`

```typescript
const handleStartUpload = async () => {
    // 1. Generate temporary ID
    const tempUploadId = `temp-${Date.now()}`;
    
    // 2. Immediately add optimistic upload item to UI
    uploadManager.actions.addOptimisticUpload({
        uploadId: tempUploadId,
        status: 'uploading',
        createdAt: new Date(),
        fileName: uploadForm.getFileName(),
        currentStep: 'Uploading PDF...',
        progress: 0
    });
    setSelectedUploadId(tempUploadId);
    
    try {
        // 3. Start SSE upload (async)
        let realUploadId: string | null = null;
        
        await sseUpload.startUpload(
            {
                file: uploadForm.file,
                pdfUrl: uploadForm.pdfUrl,
                uploadMode: uploadForm.uploadMode,
                fileName: uploadForm.getFileName()
            },
            (event: SSEEvent) => {
                // 4. On first SSE event with real uploadId, replace temp
                const uploadId = uploadManager.actions.handleSSEEvent(
                    event, 
                    realUploadId ? undefined : tempUploadId // Only pass temp ID once
                );
                
                if (uploadId && !realUploadId) {
                    realUploadId = uploadId; // Store real ID
                    setSelectedUploadId(uploadId); // Update selected ID
                }
                
                // 5. Force immediate UI update on completion
                if (event.type === 'complete' && realUploadId) {
                    flushSync(() => {
                        uploadManager.actions.updateUpload(realUploadId!, {
                            status: 'success',
                            currentStep: undefined,
                            currentStepNumber: undefined,
                            progress: 100
                        });
                    });
                }
                
                return uploadId;
            }
        );
        
        uploadForm.reset();
        
    } catch (err) {
        // 6. Remove temporary upload on error
        uploadManager.actions.removeUpload(tempUploadId);
        setSelectedUploadId(null);
    }
};
```

#### Server-Side ID Generation

**File**: `src/pages/api/upload/parse.ts`

```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 1. Generate ObjectId for upload (will be used as DB _id)
    const uploadObjectId = new ObjectId();
    const uploadId = uploadObjectId.toString();
    
    // 2. Create minimal DB record immediately
    await createBookUpload({
        _id: uploadObjectId, // Use the same ObjectId
        userId: new ObjectId(user._id),
        pdfS3Key: '', // Will update later
        status: 'uploading',
        skippedValidationErrors: [],
        fileName: req.body.fileName || pdfUrl || 'Unknown'
    });
    
    // 3. Send uploadId via SSE immediately
    res.write(`data: ${JSON.stringify({ 
        type: 'upload', 
        uploadId,  // Real ID from database
        progress: 5, 
        message: 'Initializing...' 
    })}\n\n`);
    
    // ... continue with PDF upload and parsing
}
```

#### Client-Side Replacement Logic

**File**: `src/client/routes/UploadBook/hooks/useUploadManager.ts`

```typescript
const handleSSEEvent = useCallback((event: SSEEvent, tempUploadId?: string) => {
    const uploadId = event.uploadId;
    
    // If we have both real uploadId and temp uploadId, replace the temp item
    if (uploadId && tempUploadId) {
        replaceUpload(tempUploadId, {
            uploadId,  // Real ID from server
            status: 'parsing',
            createdAt: new Date(),
            fileName: uploadsRef.current.find(u => u.uploadId === tempUploadId)?.fileName,
            currentStep: event.message || 'Starting parser...',
            progress: event.progress || 5
        });
        
        // Don't process this event further (already set initial state)
        return uploadId;
    }
    
    // For subsequent events, just update the upload with real ID
    if (!uploadId) return null;
    
    updateUpload(uploadId, {
        status: 'parsing',
        currentStep: event.message || event.step,
        progress: event.progress
    });
    
    return uploadId;
}, [updateUpload, replaceUpload]);
```

#### Key Points

1. **Temp ID Format**: `temp-${Date.now()}` - Guaranteed unique, easy to identify
2. **Real ID Format**: MongoDB ObjectId string (24 hex characters)
3. **Replacement Timing**: On first SSE event that contains `uploadId`
4. **ID Consistency**: Server generates ObjectId and uses it for both DB `_id` and SSE `uploadId`
5. **Single Replacement**: The `tempUploadId` parameter is only passed for the first SSE event

#### Benefits

- ✅ **Instant Feedback**: User sees upload item immediately
- ✅ **No Flickering**: Smooth transition from temp to real ID
- ✅ **No Duplicates**: Old temp item is filtered out when real item is added
- ✅ **Persistent State**: Real ID matches database, survives page reload

#### Common Issues

**Problem**: Two items appear (one temp, one real)

**Cause**: Temp upload not being replaced

**Solution**: Ensure `tempUploadId` is only passed on first SSE event:
```typescript
realUploadId ? undefined : tempUploadId
```

**Problem**: UI shows "Starting parser... 0%" and never updates

**Cause**: SSE events missing `uploadId` field

**Solution**: Ensure all SSE events include `uploadId`:
```typescript
sendSSE(res, {
    type: 'step-start',
    uploadId,  // Must be included!
    step: stepName,
    progress: 50
});
```

### 4. Image Handling

#### Image Extraction (Parser)

**File**: `book-parser/parser/steps/03-2-image-extraction/03-2-image-extraction.js`

The parser extracts images using `pdfimages` command and saves them to a local temporary directory:

```javascript
const imagesDir = path.join(config.OUTPUT_DIR, 'images');
fs.mkdirSync(imagesDir, { recursive: true });

// Extract images using pdfimages
execSync(`pdfimages -j "${pdfPath}" "${imagesDir}/image"`);

// Result: image-001.jpg, image-002.png, etc.
```

#### Image Upload to S3 (Production Runner)

**File**: `src/server/parser/productionRunner.ts`

After parsing completes, images are uploaded to S3:

```typescript
const imagesDir = path.join(result.outputDir, 'images');

if (fs.existsSync(imagesDir)) {
    const imageFiles = fs.readdirSync(imagesDir).filter(file => 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );
    
    await Promise.all(
        imageFiles.map(async (filename) => {
            const fileContent = fs.readFileSync(path.join(imagesDir, filename));
            
            await uploadFile({
                content: fileContent,
                fileName: `users/${userId}/uploads/${uploadId}/images/${filename}`,
                contentType: getContentType(filename)
            });
        })
    );
    
    // Set imageBaseURL in metadata
    imageBaseURL = `/users/${userId}/uploads/${uploadId}/images/`;
}
```

#### Image Move on Finalization

**File**: `src/apis/upload/handlers/finalizeUploadHandler.ts`

When adding to library, images are moved from `uploads/` to `books/`:

```typescript
const uploadImagesPrefix = `users/${userId}/uploads/${uploadId}/images/`;
const bookImagesPrefix = `users/${userId}/books/${bookId}/images/`;

const imageFiles = await listFiles(uploadImagesPrefix);

await Promise.all(
    imageFiles.map(async (file) => {
        // Download from uploads
        const imageBuffer = await getFile(file.key);
        
        // Upload to books
        await uploadFile({
            content: imageBuffer,
            fileName: `${bookImagesPrefix}${filename}`,
            contentType
        });
        
        // Delete from uploads
        await deleteFile(file.key);
    })
);

// Update book with new imageBaseURL
await updateBook(bookId, {
    imageBaseURL: `/${bookImagesPrefix}`,
    coverImage: `/${bookImagesPrefix}${firstImage}`
});
```

### 4. Database Schema Conversion

**File**: `src/apis/upload/handlers/finalizeUploadHandler.ts`

The parser output must be converted to match the database schema:

#### Key Differences:
- **Parser uses**: `content` field for text
- **Database expects**: `text` field for text
- **Parser types**: `paragraph`, `text`, `header`, `image`
- **Database types**: `text`, `header`, `image`

```typescript
const convertedChunks = chapter.chunks.map((chunk, index) => {
    // Map parser types to database types
    let dbType: 'text' | 'image' | 'header' = 'text';
    if (chunk.type === 'paragraph' || chunk.type === 'text') {
        dbType = 'text';
    } else if (chunk.type === 'header') {
        dbType = 'header';
    } else if (chunk.type === 'image') {
        dbType = 'image';
    }

    return {
        index: index,
        // CRITICAL: Map 'content' to 'text'
        text: chunk.content || chunk.text || (chunk.type === 'image' ? chunk.imageAlt || '' : ''),
        wordCount: chunk.wordCount || 0,
        type: dbType,
        ...(chunk.pageNumber !== undefined && { pageNumber: chunk.pageNumber }),
        ...(chunk.sentenceCount !== undefined && { sentenceCount: chunk.sentenceCount }),
        ...(chunk.paragraphIndex !== undefined && { paragraphIndex: chunk.paragraphIndex }),
        ...(chunk.links && chunk.links.length > 0 && {
            links: chunk.links.map(link => ({
                text: link.text,
                targetPageNumber: link.targetPageNumber,
                targetText: link.targetText,
                linkId: link.linkId,
                role: link.role,
                targetChunkId: link.targetChunkId,
                sourceChunkId: link.sourceChunkId
            }))
        }),
        ...(chunk.imageName && { imageName: chunk.imageName }),
        ...(chunk.imageAlt && { imageAlt: chunk.imageAlt })
    };
});
```

---

## API Reference

### 1. Parse PDF (SSE Stream)

**Endpoint**: `POST /api/upload/parse`

**Request Body**:
```typescript
{
    pdfBase64?: string;  // Base64-encoded PDF (for file upload)
    pdfUrl?: string;     // PDF URL (for URL upload)
    fileName?: string;   // Original filename or URL
}
```

**Response**: Server-Sent Events stream

**Event Types**:
```typescript
// Initial upload
{ type: 'upload', uploadId: string, progress: number, message: string }

// Parser step events
{ type: 'step-start', step: string, stepNumber: number, totalSteps: number, progress: number }
{ type: 'step-progress', step: string, progress: number }
{ type: 'step-complete', step: string }

// Validation error
{ type: 'validation-error', step: string, errors: ValidationError[] }

// Finalization
{ type: 'finalizing', message: string, progress: number }

// Completion
{ type: 'complete', uploadId: string, s3Key: string }

// Error
{ type: 'error', message: string }

// Heartbeat
{ type: 'heartbeat' }
```

### 2. List Uploads

**Endpoint**: `GET /api/process` (via API module)

**API Name**: `upload/listUploads`

**Request**:
```typescript
{}  // No parameters
```

**Response**:
```typescript
{
    uploads?: UploadItem[];
    error?: string;
}

interface UploadItem {
    uploadId: string;
    status: 'uploading' | 'parsing' | 'awaiting-approval' | 'success' | 'failed' | 'timeout';
    createdAt: Date;
    fileName?: string;
    currentStep?: string;
    currentStepNumber?: number;
    totalSteps?: number;
    progress?: number;
    error?: string;
    validationErrors?: ValidationError[];
    bookId?: string;
}
```

### 3. Get Upload Status

**Endpoint**: `GET /api/process` (via API module)

**API Name**: `upload/getUploadStatus`

**Request**:
```typescript
{
    uploadId: string;
}
```

**Response**:
```typescript
{
    upload?: UploadItem;
    error?: string;
}
```

### 4. Approve Validation Errors

**Endpoint**: `POST /api/process` (via API module)

**API Name**: `upload/approveErrors`

**Request**:
```typescript
{
    uploadId: string;
}
```

**Response**:
```typescript
{
    success?: boolean;
    error?: string;
}
```

### 5. Get Parser Metadata

**Endpoint**: `GET /api/process` (via API module)

**API Name**: `upload/getMetadata`

**Request**:
```typescript
{
    uploadId: string;
}
```

**Response**:
```typescript
{
    metadata?: ParserMetadata;
    error?: string;
}

interface ParserMetadata {
    title: string;
    author?: string;
    description?: string;
    language?: string;
    chapterCount?: number;
    totalWordCount?: number;
    totalSentences?: number;
    totalParagraphs?: number;
    totalImages?: number;
    totalLinks?: number;
    averageWordsPerChapter?: number;
    averageWordsPerParagraph?: number;
    coverImageUrl?: string;  // Vercel Blob URL for cover image
    images?: Array<{
        name: string;      // Image filename
        url: string;       // Full Vercel Blob URL
        sizeKB?: number;   // File size in KB (or 0.05 for <0.1 KB)
    }>;
    chapters: Array<{
        number: number;
        title: string;
    }>;
    parserOutputS3Key?: string;
    parserOutputUrl?: string;  // Signed URL for debugging
}
```

**Image Collection Logic**:

The `getMetadata` endpoint collects ALL uploaded images by querying Vercel Blob directly:

1. **Extracts book folder** from `metadata.imageBaseURL` (e.g., `/BookTitle/images/` → `books/BookTitle/`)
2. **Lists all blobs** using Vercel Blob's `list()` API with the book's prefix
3. **Extracts metadata** (filename, URL, size) from each blob
4. **Sorts by filename** using numeric-aware `localeCompare` (same logic as cover selection)
5. **Calculates sizes**:
   - Files < 0.1 KB: Returns `0.05` (displayed as `<0.1 KB`)
   - Files 0.1-0.9 KB: Rounded to 1 decimal place (e.g., `0.7`)
   - Files >= 1 KB: Rounded to nearest integer

This ensures ALL uploaded images are shown, including:
- Cover images not embedded in text
- Standalone decorative images
- Images extracted but not referenced in chapters

**Why not use chapter chunks?** Some images (like covers) are extracted by the parser but not placed in chapter content. Using Vercel Blob's `list()` API ensures we show every image that was uploaded, matching the CLI behavior exactly.

### 6. Finalize Upload (Add to Library)

**Endpoint**: `POST /api/process` (via API module)

**API Name**: `upload/finalizeUpload`

**Request**:
```typescript
{
    uploadId: string;
}
```

**Response**:
```typescript
{
    success?: boolean;
    bookId?: string;
    error?: string;
}
```

**Process**:
1. Download parser output from S3
2. Create book in database
3. Create chapters in database
4. Move images from `uploads/` to `books/`
5. Update book with final `imageBaseURL`
6. Clean up upload artifacts (PDF, parser output, upload images)
7. Return `bookId` for navigation

### 7. Delete Upload

**Endpoint**: `POST /api/process` (via API module)

**API Name**: `upload/deleteUpload`

**Request**:
```typescript
{
    uploadId: string;
}
```

**Response**:
```typescript
{
    success?: boolean;
    error?: string;
}
```

**Process**:
1. Delete PDF from S3
2. Delete parser output from S3
3. Delete all images from S3
4. Delete database record

---

## Database Schema

### Collection: `bookUploads`

**File**: `src/server/database/collections/bookUploads/types.ts`

```typescript
interface BookUpload {
    _id: ObjectId;
    userId: ObjectId;
    pdfS3Key: string;
    fileName?: string;
    status: BookUploadStatus;
    parserOutputS3Key?: string;
    skippedValidationErrors: SkippedValidationError[];
    validationErrors?: ValidationError[];
    currentStep?: string;
    currentStepNumber?: number;
    totalSteps?: number;
    progress?: number;
    error?: {
        message: string;
        stack?: string;
        timestamp: Date;
    };
    bookId?: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

type BookUploadStatus = 
    | 'uploading'          // Initial upload in progress
    | 'parsing'            // Parser is running
    | 'awaiting-approval'  // Validation errors need user approval
    | 'success'            // Parser completed successfully
    | 'failed'             // Parser failed with critical error
    | 'timeout';           // Parser timed out

interface ValidationError {
    step: string;
    message: string;
    errorCount: number;
    details?: string;
    chapterErrorSummary?: string[];
}

interface SkippedValidationError {
    step: string;
    errorId: string;
    approvedAt: Date;
}
```

### Collection: `books`

**File**: `src/server/database/collections/books/types.ts`

```typescript
interface Book {
    _id: ObjectId;
    title: string;
    author?: string;
    description?: string;
    coverImage?: string;
    totalChapters: number;
    totalWords: number;
    language: string;
    imageBaseURL?: string;
    createdAt: Date;
    updatedAt: Date;
    isPublic: boolean;
    uploadedBy?: ObjectId;
    chapterStartNumber: number;
    parserVersion?: number;
}
```

### Collection: `chapters`

**File**: `src/server/database/collections/chapters/types.ts`

```typescript
interface Chapter {
    _id: ObjectId;
    bookId: ObjectId;
    chapterNumber: number;
    title: string;
    content: ChapterContent;
    wordCount: number;
    createdAt: Date;
    updatedAt: Date;
}

interface ChapterContent {
    chunks: TextChunk[];
}

interface TextChunk {
    index: number;
    text: string;              // Client field (mapped from 'content')
    content?: string;          // Database field name
    wordCount: number;
    type: 'text' | 'image' | 'header';
    pageNumber?: number;
    sentenceCount?: number;
    paragraphIndex?: number;
    imageName?: string;
    imageAlt?: string;
    links?: ChunkLink[];
}

interface ChunkLink {
    text: string;
    targetPageNumber?: number;
    targetText?: string;
    linkId: string;
    role: 'source' | 'target';
    targetChunkIndex?: number;
    sourceChunkIndex?: number;
}
```

---

## S3 Storage Structure

### Upload Stage (Temporary)

```
users/${userId}/uploads/${uploadId}/
├── ${uploadId}.pdf                    # Original PDF
├── images/                            # Extracted images (temporary)
│   ├── image-001.jpg
│   ├── image-002.png
│   └── image-003.jpg
└── parser-output/${uploadId}/
    └── output.json                    # Parser output with metadata
```

**Lifecycle**: Created during upload, deleted after finalization or manual deletion.

### Library Stage (Permanent)

```
users/${userId}/books/${bookId}/
└── images/                            # Final images (moved from uploads)
    ├── image-001.jpg
    ├── image-002.png
    └── image-003.jpg
```

**Lifecycle**: Created during finalization, deleted only when book is deleted.

### Image URL Resolution

**In Database**:
```typescript
book.imageBaseURL = "/users/123/books/abc/images/";
chunk.imageName = "image-001.jpg";
```

**In Reader**:
```typescript
const imageUrl = book.imageBaseURL + chunk.imageName;
// = "/users/123/books/abc/images/image-001.jpg"

// S3 SDK serves the image
const signedUrl = await getSignedFileUrl(imageUrl);
```

---

## Error Handling

### 1. Validation Errors (Recoverable)

**Scenario**: Parser detects issues but can continue if approved.

**Examples**:
- Missing chapter titles
- Inconsistent formatting
- Suspicious link targets
- Image extraction warnings

**Flow**:
1. Parser calls `onValidationError`
2. Upload status → `awaiting-approval`
3. Errors saved to `validationErrors` array
4. Client shows "REVIEW ERRORS" button
5. User reviews and approves
6. Approved errors saved to `skippedValidationErrors`
7. Parser continues, skipping approved errors

**Implementation**:
```typescript
// Parser checks for approved errors
const skipErrors = await skipErrorsProvider(stepName);
if (skipErrors.some(err => err.errorId === currentError.id)) {
    console.log(`Skipping approved error: ${currentError.id}`);
    continue; // Skip this error
}
```

### 2. Critical Errors (Non-Recoverable)

**Scenario**: Parser cannot continue due to fatal error.

**Examples**:
- Corrupted PDF file
- Missing required dependencies (pdfimages)
- Out of memory
- File system errors

**Flow**:
1. Parser throws error
2. Upload status → `failed`
3. Error message + stack saved to database
4. PDF kept in S3 for debugging
5. Client shows error message
6. User can only delete the upload

**Error Storage**:
```typescript
{
    error: {
        message: "Failed to extract text: PDF is corrupted",
        stack: "Error: ...\n    at ...",
        timestamp: new Date()
    }
}
```

### 3. Timeout Errors

**Scenario**: Parser takes too long (>60 minutes).

**Flow**:
1. Next.js API route timeout
2. Upload status → `timeout`
3. Client shows timeout message
4. User can retry or delete

**Note**: In production, consider using background jobs for long-running parsers.

### 4. Network Errors (SSE Stream)

**Scenario**: SSE connection drops during parsing.

**Recovery**:
1. Client detects stream end
2. Client polls `/api/upload/status` to get current state
3. If status is `parsing`, show current progress
4. If status is `success`, show completion
5. If status is `failed`, show error

**Implementation**:
```typescript
try {
    // Process SSE stream
} catch (error) {
    console.error('SSE stream error:', error);
    
    // Poll for current status
    const statusResult = await uploadApi.getUploadStatus({ uploadId });
    if (statusResult.data.upload) {
        // Update UI with current status
        setUploads(prev => prev.map(u => 
            u.uploadId === uploadId ? statusResult.data.upload : u
        ));
    }
}
```

---

## Troubleshooting

### Issue: SSE events not reaching client

**Symptoms**:
- Progress bar stuck
- No step updates in UI
- Console shows parser logs but no UI changes

**Causes**:
1. Next.js response buffering enabled
2. Nginx/proxy buffering
3. Missing `res.flush()` calls

**Solutions**:
```typescript
// 1. Disable Next.js buffering
export const config = {
    api: { responseLimit: false }
};

// 2. Disable nginx buffering
res.setHeader('X-Accel-Buffering', 'no');

// 3. Flush after each event
res.write(`data: ${JSON.stringify(data)}\n\n`);
if (typeof (res as any).flush === 'function') {
    (res as any).flush();
}

// 4. Flush headers immediately
res.flushHeaders();
```

### Issue: Images not displaying in Reader

**Symptoms**:
- Broken image icons
- 404 errors for image URLs

**Causes**:
1. Images not uploaded to S3
2. Wrong `imageBaseURL` in book
3. Images deleted prematurely
4. S3 permissions issue

**Debug Steps**:
```typescript
// 1. Check book record
const book = await getBook(bookId);
console.log('imageBaseURL:', book.imageBaseURL);
console.log('coverImage:', book.coverImage);

// 2. Check S3 for images
const images = await listFiles(`users/${userId}/books/${bookId}/images/`);
console.log('Images in S3:', images);

// 3. Check chunk imageName
const chapter = await getChapter(chapterId);
const imageChunks = chapter.content.chunks.filter(c => c.type === 'image');
console.log('Image chunks:', imageChunks);

// 4. Test image URL
const imageUrl = book.imageBaseURL + imageChunks[0].imageName;
const signedUrl = await getSignedFileUrl(imageUrl);
console.log('Signed URL:', signedUrl);
```

### Issue: Parser stuck on validation step

**Symptoms**:
- Status shows `awaiting-approval`
- No "REVIEW ERRORS" button
- Parser never continues

**Causes**:
1. `validationErrors` not saved to database
2. Approval polling timeout
3. Database update failed

**Debug Steps**:
```typescript
// 1. Check upload record
const upload = await getBookUpload(uploadId);
console.log('Status:', upload.status);
console.log('Validation errors:', upload.validationErrors);

// 2. Check if approval was saved
console.log('Skipped errors:', upload.skippedValidationErrors);

// 3. Manually approve
await updateBookUpload(uploadId, {
    status: 'parsing',
    skippedValidationErrors: [
        { step: 'step-5', errorId: 'all', approvedAt: new Date() }
    ]
});
```

### Issue: Word count is 0 in summary

**Symptoms**:
- Summary shows 0 words for book and chapters
- Parser output looks correct

**Causes**:
1. Parser not calculating `wordCount` for chapters
2. `totalWords` not in metadata
3. Conversion logic not summing word counts

**Solutions**:
```typescript
// 1. Check parser output
const parserOutput = JSON.parse(await getFileAsString(upload.parserOutputS3Key));
console.log('Metadata totalWords:', parserOutput.finalOutput.metadata.totalWords);
console.log('First chapter wordCount:', parserOutput.finalOutput.chapters[0].wordCount);

// 2. Ensure parser calculates wordCount
// In parser.js:
const wordCount = chapter.chunks
    .filter(c => c.type === 'text')
    .reduce((sum, c) => sum + (c.content?.split(/\s+/).length || 0), 0);

// 3. Use metadata.totalWords in finalize
const totalWords = metadata.totalWords || 
    chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0);
```

### Issue: Duplicate upload items in list

**Symptoms**:
- Two items for same upload
- One stuck on "Parsing", other shows real status

**Causes**:
1. Client-side optimistic UI not replaced
2. Database returning multiple active uploads
3. SSE `uploadId` not received

**Solutions**:
```typescript
// 1. Ensure uploadId is sent immediately
sendSSE(res, { type: 'start', uploadId });

// 2. Filter to most recent active upload
// In getRecentUploadsForUser:
const activeUploads = uploads.filter(u => 
    u.status === 'parsing' || u.status === 'uploading'
);
if (activeUploads.length > 1) {
    // Return only the most recent
    return [activeUploads.sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
    )[0]];
}

// 3. Replace temp upload on first SSE event
if (data.uploadId && !uploadId) {
    uploadId = data.uploadId;
    setUploads(prev => {
        const filtered = prev.filter(u => u.uploadId !== tempUploadId);
        return [{ uploadId, status: 'parsing', ... }, ...filtered];
    });
}
```

---

## Performance Considerations

### 1. Large PDFs (>100 pages)

**Challenges**:
- Parsing can take 5-10 minutes
- Large memory usage
- Many images to upload

**Optimizations**:
- Stream processing where possible
- Parallel image uploads
- Exponential backoff for polling
- Heartbeat to keep connection alive

### 2. Many Concurrent Uploads

**Challenges**:
- Server resource limits
- S3 rate limits
- Database connection pool

**Solutions**:
- Limit concurrent uploads per user (1-2)
- Queue system for uploads
- Background job processing
- Rate limiting on API endpoints

### 3. Image Storage Costs

**Optimization**:
- Compress images before upload
- Use WebP format where possible
- Lazy load images in Reader
- CDN for image delivery

---

## Security Considerations

### 1. Authentication & Authorization

**All endpoints require authentication**:
```typescript
const user = await getUserFromRequest(req);
if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
}
```

**Ownership verification**:
```typescript
if (upload.userId.toString() !== context.userId) {
    return { error: 'Forbidden' };
}
```

### 2. File Validation

**PDF validation**:
```typescript
// Check magic number
if (!pdfBuffer.toString('ascii', 0, 4).startsWith('%PDF')) {
    throw new Error('Invalid PDF file format');
}

// Check content type (for URL uploads)
if (contentType && !contentType.includes('pdf')) {
    throw new Error('URL does not point to a PDF file');
}
```

### 3. Rate Limiting

**Prevent abuse**:
- Limit uploads per user per hour
- Limit concurrent parsing operations
- Validate file size before processing

### 4. S3 Security

**Signed URLs**:
- All S3 files use signed URLs with expiration
- No public bucket access
- User-specific paths: `users/${userId}/...`

---

## Future Enhancements

### 1. Background Job Processing

Replace SSE with background jobs for better scalability:
- Use Redis/BullMQ for job queue
- Support longer parsing times
- Better error recovery
- Retry failed uploads

### 2. Incremental Parsing

For very large PDFs:
- Parse in chunks (e.g., 50 pages at a time)
- Save progress after each chunk
- Allow resume on failure

### 3. Advanced Preview

Before adding to library:
- Preview actual book content (not just metadata)
- Edit chapter titles
- Adjust chapter boundaries
- Remove unwanted chapters

### 4. Batch Upload

Upload multiple PDFs at once:
- Drag & drop multiple files
- Parallel parsing
- Bulk add to library

### 5. OCR Support

For scanned PDFs:
- Detect if PDF needs OCR
- Run OCR on images
- Extract text from scanned pages

---

## Conclusion

The Book Upload feature provides a complete, production-ready solution for uploading and parsing PDF books. It handles real-time progress updates, validation error approval, image extraction and storage, and automatic cleanup.

Key strengths:
- ✅ Real-time feedback via SSE
- ✅ Robust error handling
- ✅ Persistent state (survives page reload)
- ✅ Clean separation of staging vs. library
- ✅ Automatic resource cleanup
- ✅ Mobile-first UI

For questions or issues, refer to the troubleshooting section or check the source code in:
- `src/pages/api/upload/parse.ts` - SSE endpoint
- `src/server/parser/productionRunner.ts` - Parser integration
- `src/apis/upload/` - API module
- `src/client/routes/UploadBook/` - UI components

