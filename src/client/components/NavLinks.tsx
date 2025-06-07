import { NavItem } from './layout/types';
import ChatIcon from '@mui/icons-material/Chat';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import MenuBookIcon from '@mui/icons-material/MenuBook';

export const navItems: NavItem[] = [
  { path: '/', label: 'Reader', icon: <MenuBookIcon /> },
  { path: '/book-library', label: 'Book Library', icon: <LibraryBooksIcon /> },
  { path: '/ai-chat', label: 'AI Chat', icon: <ChatIcon /> },
  { path: '/bookmarks', label: 'Bookmarks', icon: <BookmarkIcon /> },
  { path: '/reading-history', label: 'Reading History', icon: <HistoryIcon /> },
  { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

export const menuItems: NavItem[] = [
  { path: '/', label: 'Reader', icon: <MenuBookIcon /> },
  { path: '/book-library', label: 'Book Library', icon: <LibraryBooksIcon /> },
  { path: '/ai-chat', label: 'AI Chat', icon: <ChatIcon /> },
  { path: '/bookmarks', label: 'Bookmarks', icon: <BookmarkIcon /> },
  { path: '/reading-history', label: 'Reading History', icon: <HistoryIcon /> },
  { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];
