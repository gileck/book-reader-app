import { Home } from './Home';
import { NotFound } from './NotFound';
import { AIChat } from './AIChat';
import { Settings } from './Settings';
import { Profile } from './Profile';
import { Reader } from './Reader';
import { createRoutes } from '../router';

// Define routes
export const routes = createRoutes({
  '/': Home,
  '/reader': Reader,
  '/ai-chat': AIChat,
  '/settings': Settings,
  '/not-found': NotFound,
  '/profile': Profile,
});
