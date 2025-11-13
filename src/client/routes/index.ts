import { Home } from './Home';
import { NotFound } from './NotFound';
import { AIChat } from './AIChat';
import { Settings } from './Settings';
import { Profile } from './Profile';
import { Reader } from './Reader';
import { Bookmarks } from './Bookmarks';
import { ReadingHistory } from './ReadingHistory';
import { BookLibrary } from './BookLibrary';
import { TtsUsage } from './TtsUsage';
import { TranslationUsage } from './TranslationUsage';
import { UploadBook } from './UploadBook';
import { FileStorage } from './FileStorage';
import { createRoutes } from '../router';

// Define routes
export const routes = createRoutes({
  '/': Reader,
  '/home': Home,
  '/book-library': BookLibrary,
  '/upload-book': UploadBook,
  '/file-storage': FileStorage,
  '/ai-chat': AIChat,
  '/bookmarks': Bookmarks,
  '/reading-history': ReadingHistory,
  '/settings': Settings,
  '/tts-usage': TtsUsage,
  '/translation-usage': TranslationUsage,
  '/not-found': NotFound,
  '/profile': Profile,
});
