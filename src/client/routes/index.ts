import { Home } from './Home';
import { NotFound } from './NotFound';
import { AIChat } from './AIChat';
import { Settings } from './Settings';
import { createRoutes } from '../router';
import { Profile } from './Profile';
// Define routes
export const routes = createRoutes({
  '/': Home,
  '/ai-chat': AIChat,
  '/settings': Settings,
  '/not-found': NotFound,
  '/profile': Profile,
});
