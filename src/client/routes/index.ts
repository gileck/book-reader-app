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
import { createRoutes } from '../router';

// Define routes
export const routes = createRoutes({
  '/': Reader,
  '/home': Home,
  '/book-library': BookLibrary,
  '/ai-chat': AIChat,
  '/bookmarks': Bookmarks,
  '/reading-history': ReadingHistory,
  '/settings': Settings,
  '/tts-usage': TtsUsage,
  '/not-found': NotFound,
  '/profile': Profile,
});
