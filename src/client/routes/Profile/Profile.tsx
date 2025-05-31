import { useEffect, useState, useRef, ChangeEvent } from 'react';
import {
    Box,
    Typography,
    Paper,
    Avatar,
    Divider,
    List,
    ListItem,
    ListItemText,
    Stack,
    CircularProgress,
    TextField,
    Button,
    IconButton,
    Snackbar,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../router';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { apiUpdateProfile, apiFetchCurrentUser } from '@/apis/auth/client';
import { UpdateProfileRequest, UserResponse } from '@/apis/auth/types';

export const Profile = () => {
    const { user, isAuthenticated, isLoading } = useAuth();
    const { navigate } = useRouter();
    const [editing, setEditing] = useState(false);
    const [username, setUsername] = useState('');
    const [previewImage, setPreviewImage] = useState<string | undefined>(undefined);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
    const [openImageDialog, setOpenImageDialog] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [localUser, setLocalUser] = useState<UserResponse | null>(null);
    const [loadingUserData, setLoadingUserData] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch fresh user data from the server
    const fetchUserData = async () => {
        try {
            setLoadingUserData(true);
            const response = await apiFetchCurrentUser({ bypassCache: true });
            if (response.data?.user) {
                setLocalUser(response.data.user);
                setUsername(response.data.user.username);
                setPreviewImage(response.data.user.profilePicture);
            }
        } catch (error) {
            console.error("Failed to fetch user data:", error);
        } finally {
            setLoadingUserData(false);
        }
    };

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, isLoading, navigate]);

    useEffect(() => {
        if (user) {
            setLocalUser(user);
            setUsername(user.username);
            setPreviewImage(user.profilePicture);
        }
    }, [user]);

    if (isLoading || loadingUserData) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    const handleEditClick = () => {
        // Fetch fresh user data before editing
        setEditing(true);
    };

    const handleCancelEdit = () => {
        setEditing(false);
        // Reset to original values
        if (localUser) {
            setUsername(localUser.username);
            setPreviewImage(localUser.profilePicture);
        }
    };

    const handleSaveProfile = async () => {
        if (!username.trim()) {
            setSnackbar({
                open: true,
                message: 'Username cannot be empty',
                severity: 'error'
            });
            return;
        }

        setSavingProfile(true);

        try {
            const updateData: UpdateProfileRequest = {
                username,
                profilePicture: previewImage !== localUser?.profilePicture ? previewImage : undefined
            };

            // Use bypassCache to ensure we're not using cached data
            const response = await apiUpdateProfile(updateData, { bypassCache: true });

            if (response.data?.success && response.data.user) {
                setLocalUser(response.data.user);
                setEditing(false);
                setSnackbar({
                    open: true,
                    message: 'Profile updated successfully',
                    severity: 'success'
                });
            } else {
                // If the update failed, try to fetch fresh user data
                await fetchUserData();
                setSnackbar({
                    open: true,
                    message: response.data?.error || 'Failed to update profile',
                    severity: 'error'
                });
            }
        } catch (err) {
            // If an error occurred, try to fetch fresh user data
            await fetchUserData();
            const errorMessage = err instanceof Error ? err.message : 'Profile update error';
            setSnackbar({
                open: true,
                message: errorMessage,
                severity: 'error'
            });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreviewImage(result);
                setOpenImageDialog(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePaste = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            setPreviewImage(result);
                            setOpenImageDialog(false);
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            }
            setSnackbar({
                open: true,
                message: 'No image found in clipboard',
                severity: 'error'
            });
        } catch (error) {
            console.error('Error accessing clipboard:', error);
            setSnackbar({
                open: true,
                message: 'Failed to paste image from clipboard',
                severity: 'error'
            });
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleOpenImageDialog = () => {
        setOpenImageDialog(true);
    };

    const handleCloseImageDialog = () => {
        setOpenImageDialog(false);
    };

    const handleCloseSnackbar = () => {
        setSnackbar(prev => ({ ...prev, open: false }));
    };

    // Use localUser for display to prevent the entire app from re-rendering
    const displayUser = localUser || user;

    return (
        <Box>
            <Typography variant="h4" component="h1" gutterBottom>
                My Profile
                {!editing && (
                    <IconButton color="primary" onClick={handleEditClick} sx={{ ml: 2 }}>
                        <EditIcon />
                    </IconButton>
                )}
            </Typography>

            {displayUser && (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                    <Box sx={{ width: { xs: '100%', md: '30%' } }}>
                        <Paper elevation={2} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Box sx={{ position: 'relative' }}>
                                <Avatar
                                    src={previewImage}
                                    sx={{
                                        width: 120,
                                        height: 120,
                                        fontSize: '3rem',
                                        mb: 2,
                                        bgcolor: 'primary.main'
                                    }}
                                >
                                    {username.charAt(0).toUpperCase()}
                                </Avatar>
                                {editing && (
                                    <IconButton
                                        color="primary"
                                        sx={{
                                            position: 'absolute',
                                            right: -10,
                                            bottom: 10,
                                            backgroundColor: 'background.paper',
                                            boxShadow: 1
                                        }}
                                        onClick={handleOpenImageDialog}
                                        disabled={savingProfile}
                                    >
                                        <PhotoCameraIcon />
                                    </IconButton>
                                )}
                            </Box>
                            {editing ? (
                                <TextField
                                    label="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    fullWidth
                                    margin="normal"
                                    variant="outlined"
                                    size="small"
                                    disabled={savingProfile}
                                />
                            ) : (
                                <>
                                    <Typography variant="h5">{username}</Typography>
                                    {displayUser.email && (
                                        <Typography variant="body2" color="text.secondary">{displayUser.email}</Typography>
                                    )}
                                </>
                            )}

                            {editing && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1 }}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={savingProfile ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                                        onClick={handleSaveProfile}
                                        disabled={savingProfile}
                                    >
                                        {savingProfile ? 'Saving...' : 'Save'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        startIcon={<CancelIcon />}
                                        onClick={handleCancelEdit}
                                        disabled={savingProfile}
                                    >
                                        Cancel
                                    </Button>
                                </Box>
                            )}
                        </Paper>
                    </Box>

                    <Box sx={{ width: { xs: '100%', md: '70%' } }}>
                        <Paper elevation={2} sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>Account Information</Typography>
                            <Divider sx={{ mb: 2 }} />

                            <List>
                                <ListItem>
                                    <ListItemText
                                        primary="Username"
                                        secondary={username}
                                    />
                                </ListItem>
                                <Divider component="li" />

                                <ListItem>
                                    <ListItemText
                                        primary="Email"
                                        secondary={displayUser.email || 'Not provided'}
                                    />
                                </ListItem>
                                <Divider component="li" />

                                <ListItem>
                                    <ListItemText
                                        primary="Member Since"
                                        secondary={new Date(displayUser.createdAt).toLocaleDateString()}
                                    />
                                </ListItem>
                            </List>
                        </Paper>
                    </Box>
                </Stack>
            )}

            {/* Hidden file input for image upload */}
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {/* Image upload dialog */}
            <Dialog open={openImageDialog} onClose={handleCloseImageDialog}>
                <DialogTitle>Change Profile Picture</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Button
                            variant="contained"
                            onClick={handlePaste}
                        >
                            Paste from Clipboard
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={handleUploadClick}
                        >
                            Upload Image
                        </Button>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseImageDialog} color="primary">
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Profile; 