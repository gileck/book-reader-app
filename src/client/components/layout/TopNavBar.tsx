import { AppBar, Toolbar, IconButton, Box, Button, Avatar, Menu, MenuItem, Typography, Divider, Chip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { useRouter } from '../../router';
import { NavItem } from '../../components/layout/types';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../settings/SettingsContext';
import { useState, useEffect, useRef } from 'react';
import LoginIcon from '@mui/icons-material/Login';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { updateUserSettings } from '../../../apis/userSettings/client';

interface TopNavBarProps {
  navItems: NavItem[];
  isStandalone?: boolean;
  onDrawerToggle: () => void;
}

export const TopNavBar = ({ navItems, isStandalone, onDrawerToggle }: TopNavBarProps) => {
  const { currentPath, navigate } = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { settings, updateSettings, effectiveOffline } = useSettings();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userTheme, setUserTheme] = useState<'light' | 'dark'>('light');
  const hasLoadedUserTheme = useRef(false);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    navigate('/profile');
  };

  const handleLogoutClick = async () => {
    handleMenuClose();
    await logout();
  };

  // Sync userTheme with global settings (which may be loaded from Reader's useUserSettings)
  useEffect(() => {
    setUserTheme(settings.theme);
  }, [settings.theme]);

  // Reset theme loading flag when user changes
  useEffect(() => {
    hasLoadedUserTheme.current = false;
  }, [user?.id]);

  const handleThemeToggle = async () => {
    const newTheme = userTheme === 'light' ? 'dark' : 'light';
    setUserTheme(newTheme);

    // Update global settings immediately for app-wide theme
    updateSettings({ theme: newTheme });

    // Update user-specific settings in database if authenticated
    if (isAuthenticated && user?.id) {
      try {
        await updateUserSettings({
          userId: user.id,
          settings: { theme: newTheme }
        });
      } catch (error) {
        console.error('Error updating user theme:', error);
        // Revert on error
        setUserTheme(userTheme);
        updateSettings({ theme: userTheme });
      }
    }
  };

  const getThemeIcon = () => {
    return userTheme === 'light' ? <DarkModeIcon /> : <LightModeIcon />;
  };

  return (
    <AppBar
      position="sticky"
      component="nav"
      sx={{
        // Improve iOS standalone experience
        ...(isStandalone && {
          WebkitBackdropFilter: 'blur(10px)',
          backdropFilter: 'blur(10px)',
        })
      }}
    >
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            {navItems.map((item) => (
              <Button
                key={item.path}
                sx={{
                  color: '#fff',
                  backgroundColor: currentPath === item.path ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  mx: 0.5
                }}
                startIcon={item.icon}
                onClick={() => handleNavigation(item.path)}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Offline Mode Indicator - Desktop */}
        {effectiveOffline && (
          <Chip
            icon={<CloudOffIcon />}
            label="Offline Mode"
            size="small"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: '#fff',
              fontWeight: 600,
              '& .MuiChip-icon': {
                color: '#fff'
              },
              display: { xs: 'none', sm: 'flex' }
            }}
          />
        )}

        {/* Offline Mode Indicator - Mobile (icon only) */}
        {effectiveOffline && (
          <Box
            sx={{
              display: { xs: 'flex', sm: 'none' },
              alignItems: 'center',
              gap: 0.5,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              px: 1,
              py: 0.5
            }}
          >
            <CloudOffIcon sx={{ fontSize: 16, color: '#fff' }} />
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.7rem' }}>
              Offline
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            color="inherit"
            onClick={handleThemeToggle}
            aria-label="toggle theme"
            title={`Current theme: ${userTheme}`}
          >
            {getThemeIcon()}
          </IconButton>

          {isAuthenticated ? (
            <Box>
              <IconButton
                onClick={handleAvatarClick}
                sx={{ p: 0 }}
                aria-controls="user-menu"
                aria-haspopup="true"
              >
                <Avatar
                  src={user?.profilePicture}
                  alt={user?.username}
                  sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}
                >
                  {user?.username.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              <Menu
                id="user-menu"
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                sx={{ mt: 1 }}
              >
                <MenuItem onClick={handleMenuClose} disabled sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
                  <Avatar
                    src={user?.profilePicture}
                    alt={user?.username}
                    sx={{ width: 60, height: 60, mb: 1 }}
                  >
                    {user?.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="subtitle2">
                    {user?.username}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user?.email}
                  </Typography>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleProfileClick}>
                  <AccountCircleIcon fontSize="small" sx={{ mr: 1 }} />
                  Profile
                </MenuItem>
                <MenuItem onClick={handleLogoutClick}>
                  <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Button
              color="inherit"
              onClick={handleLoginClick}
              startIcon={<LoginIcon />}
            >
              Login
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TopNavBar;
