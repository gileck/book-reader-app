import { useState } from 'react';
import {
    AppBar,
    Avatar,
    Box,
    Button,
    IconButton,
    Menu,
    MenuItem,
    Toolbar,
    Tooltip,
    Typography
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { useAuth } from '@/client/context/AuthContext';
import { NavItem } from './types';

interface TopNavBarProps {
    navItems: NavItem[];
    isStandalone: boolean;
    onDrawerToggle: () => void;
}

export const TopNavBar = ({ navItems, isStandalone, onDrawerToggle }: TopNavBarProps) => {
    const { user, logout, isAuthenticated } = useAuth();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        await logout();
        handleClose();
    };

    // Simple navigation handler
    const navigate = (path: string) => {
        window.location.href = path;
    };

    return (
        <AppBar
            position="sticky"
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                // Add top margin when in standalone mode on iOS
                ...(isStandalone && { marginTop: 'env(safe-area-inset-top)' })
            }}
        >
            <Toolbar>
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={onDrawerToggle}
                    sx={{ mr: 2, display: { sm: 'none' } }}
                >
                    <MenuIcon />
                </IconButton>

                <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                    App
                </Typography>

                <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 2 }}>
                    {navItems.map((item) => (
                        <Button
                            key={item.path}
                            color="inherit"
                            onClick={() => navigate(item.path)}
                        >
                            {item.label}
                        </Button>
                    ))}
                </Box>

                {isAuthenticated && (
                    <Box>
                        <Tooltip title="Account settings">
                            <IconButton
                                size="large"
                                aria-label="account of current user"
                                aria-controls="menu-appbar"
                                aria-haspopup="true"
                                onClick={handleMenu}
                                color="inherit"
                            >
                                {user?.username ? (
                                    <Avatar alt={user.username} sx={{ width: 32, height: 32 }}>
                                        {user.username.charAt(0).toUpperCase()}
                                    </Avatar>
                                ) : (
                                    <AccountCircle />
                                )}
                            </IconButton>
                        </Tooltip>
                        <Menu
                            id="menu-appbar"
                            anchorEl={anchorEl}
                            anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'right',
                            }}
                            keepMounted
                            transformOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            open={Boolean(anchorEl)}
                            onClose={handleClose}
                        >
                            <MenuItem disabled>
                                {user?.email}
                            </MenuItem>
                            <MenuItem onClick={handleLogout}>Logout</MenuItem>
                        </Menu>
                    </Box>
                )}
            </Toolbar>
        </AppBar>
    );
}

export default TopNavBar; 