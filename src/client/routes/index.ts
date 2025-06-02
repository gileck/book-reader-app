import { Home } from './Home';
import { NotFound } from './NotFound';
import { AIChat } from './AIChat';
import { Settings } from './Settings';
import { Profile } from './Profile';
import { Reader } from './Reader';
import { Bookmarks } from './Bookmarks';
import { ReadingHistory } from './ReadingHistory';
import { BookLibrary } from './BookLibrary';
import { createRoutes } from '../router';

// Define routes
export const routes = createRoutes({
  '/': Home,
  '/reader': Reader,
  '/book-library': BookLibrary,
  '/ai-chat': AIChat,
  '/bookmarks': Bookmarks,
  '/reading-history': ReadingHistory,
  '/settings': Settings,
  '/not-found': NotFound,
  '/profile': Profile,
});
