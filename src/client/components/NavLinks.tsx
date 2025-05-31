import { NavItem } from './layout/types';
import HomeIcon from '@mui/icons-material/Home';
import ChatIcon from '@mui/icons-material/Chat';
import SettingsIcon from '@mui/icons-material/Settings';

export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <HomeIcon /> },
  { path: '/ai-chat', label: 'AI Chat', icon: <ChatIcon /> },
  { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

export const menuItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <HomeIcon /> },
  { path: '/ai-chat', label: 'AI Chat', icon: <ChatIcon /> },
  { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];
