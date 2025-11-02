# Book Reader App

A web-based ebook reader with synchronized text-to-speech capabilities, featuring word-level highlighting and immersive reading experience.

## Features

- Text-to-speech with word-level synchronization
- Progressive audio loading
- Windowed text rendering for large documents
- Bookmarking system
- Speed controls and voice selection
- Reading progress tracking
- Theme customization

## Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB (local or cloud instance)
- Yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd book-reader-app
```

2. Install dependencies:
```bash
yarn install
```

3. Set up environment variables:
```bash
# Create .env.local file with:
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=book_reader
```

### AI models (Gemini & OpenAI)

This app uses Google's Gen AI SDK (`@google/genai`) for Gemini and the OpenAI SDK for GPT models.

Environment variables:

```bash
# Needed for Gemini (Gen AI SDK)
GEMINI_API_KEY=your_gemini_api_key
```

Default model (used by QA chat): `gemini-2.5-flash-lite`

Supported Gemini IDs in this app:
- `gemini-2.5-flash-lite`
- `gemini-2.5-flash`

Example (server-side):

```ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function summarize(text: string) {
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Summarize in 3 bullets:\n\n${text}`,
  });
  return res.text;
}
```

4. Start MongoDB (if running locally):
```bash
# On macOS with Homebrew:
brew services start mongodb-community

# On Windows/Linux, refer to MongoDB documentation
```

5. Upload sample book data:
```bash
yarn upload-sample-book
```

6. Start the development server:
```bash
yarn dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

- `yarn dev` - Start development server with Turbopack
- `yarn build` - Build the application for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint
- `yarn ts` - Run TypeScript compiler check
- `yarn checks` - Run both TypeScript and ESLint checks
- `yarn upload-sample-book` - Upload sample book data to database
- `yarn create-indexes` - Create database indexes for optimal performance

## Database Setup

The application uses MongoDB with the following collections:
- `users` - User accounts and authentication
- `books` - Book metadata and information
- `chapters` - Chapter content with text chunks
- `bookmarks` - User bookmarks and reading positions
- `readingProgress` - User reading progress tracking
- `userSettings` - User preferences and settings

### Database Indexes

For optimal performance, database indexes are automatically created on first connection. To manually create or verify indexes:

```bash
yarn create-indexes
```

This creates indexes on all collections for efficient querying:
- `readingProgress`: compound index on `userId + bookId` for fast progress lookups
- `chapters`: compound index on `bookId + chapterNumber`
- `bookmarks`: compound index on `userId + bookId`
- Additional indexes on frequently queried fields

### Sample Data

Run the sample book upload script to populate your database with test content:

```bash
yarn upload-sample-book
```

This creates a sample book "The Adventures of Programming" with 3 chapters containing text suitable for testing the TTS and highlighting features.

## Text-to-Speech (TTS)

The app supports multiple TTS providers with accurate usage tracking and billing:

### Supported Providers
- **Amazon Polly** (Standard, Neural, Long-Form voices)
- **Google Cloud TTS** (Standard, Neural2 voices)
- **ElevenLabs** (Premium AI voices)

### Environment Variables
```bash
# Amazon Polly
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Google TTS
GOOGLE_APPLICATION_CREDENTIALS=base64_encoded_service_account_key
```

### Important Documentation
All TTS documentation is located in `docs/tts/`:
- **`docs/tts/TTS_PRICING_DOCUMENTATION.md`** - Pricing structure and character counting rules for all providers
- **`docs/tts/AWS_POLLY_BILLING_CRITICAL_FINDINGS.md`** - Critical billing discovery (68% discrepancy for Long-Form voices)
- **`docs/tts/TTS_BILLING_VERIFICATION.md`** - Verification of character counting across all providers
- **`docs/tts/AWS_COST_EXPLORER_INTEGRATION.md`** - Real AWS billing validation via Cost Explorer API
- **`docs/tts/TTS_ADAPTER_GUIDE.md`** - Technical implementation guide for TTS adapters

### Testing
Run the character counting verification script:
```bash
node docs/tts/verify-tts-character-counting.js
```

This validates our billing calculations against expected behavior for all providers.

### Usage Tracking
The app includes a comprehensive TTS Usage Dashboard that displays:
- Real-time usage across all providers
- AWS Cost Explorer data for Polly (actual billing)
- Free-tier usage monitoring with progress bars
- Cache hit ratio and cost savings
- Monthly usage trends

⚠️ **Critical Note**: Amazon Polly Long-Form voices have special billing rules that count SSML mark attribute names. See `AWS_POLLY_BILLING_CRITICAL_FINDINGS.md` for details.

## Development

### Project Structure

```
src/
├── apis/          # API endpoints and client/server communication
├── client/        # Frontend React components and pages
├── server/        # Backend logic and database operations
├── common/        # Shared types and utilities
└── pages/         # Next.js pages and API routes
```

### Type Safety

This project uses TypeScript throughout with strict type checking. Run `yarn checks` before committing to ensure all types are correct and linting passes.

### API Guidelines

The project follows strict client-server communication guidelines. APIs are organized with:
- `index.ts` - API endpoint names
- `types.ts` - Request/response types
- `server.ts` - Server-side handlers
- `client.ts` - Client-side functions

## Contributing

1. Follow the established code guidelines
2. Run `yarn checks` before committing
3. Ensure all TypeScript errors are resolved
4. Follow the API communication patterns

## License

This project is licensed under the MIT License.
