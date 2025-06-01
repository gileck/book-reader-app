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

## Database Setup

The application uses MongoDB with the following collections:
- `users` - User accounts and authentication
- `books` - Book metadata and information
- `chapters` - Chapter content with text chunks
- `bookmarks` - User bookmarks and reading positions
- `readingProgress` - User reading progress tracking
- `userSettings` - User preferences and settings

### Sample Data

Run the sample book upload script to populate your database with test content:

```bash
yarn upload-sample-book
```

This creates a sample book "The Adventures of Programming" with 3 chapters containing text suitable for testing the TTS and highlighting features.

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
