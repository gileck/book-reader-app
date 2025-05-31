import React, { useState } from 'react';
import { useAuth } from '@/client/context/AuthContext';
import {
    Box,
    Button,
    CircularProgress,
    TextField,
    Alert,
    Link
} from '@mui/material';
import { useLoginFormValidator } from './useLoginFormValidator';
import { LoginFormState } from './types';

export const LoginForm = () => {
    const { login, register, isLoading, error } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);
    const [formData, setFormData] = useState<LoginFormState>({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const { formErrors, validateForm, clearFieldError, resetFormErrors } = useLoginFormValidator(isRegistering, formData);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        clearFieldError(name as keyof LoginFormState);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateForm()) {
            return;
        }
        if (isRegistering) {
            const registerData = {
                username: formData.username,
                password: formData.password,
                ...(formData.email.trim() && { email: formData.email })
            };
            await register(registerData);
        } else {
            await login({
                username: formData.username,
                password: formData.password
            });
        }
    };

    const toggleMode = () => {
        setIsRegistering(!isRegistering);
        resetFormErrors();
    };

    return (
        <Box component="form" onSubmit={handleSubmit} noValidate>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                value={formData.username}
                onChange={handleChange}
                error={!!formErrors.username}
                helperText={formErrors.username}
                disabled={isLoading}
            />

            {isRegistering && (
                <TextField
                    margin="normal"
                    fullWidth
                    id="email"
                    label="Email Address (Optional)"
                    name="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    error={!!formErrors.email}
                    helperText={formErrors.email}
                    disabled={isLoading}
                />
            )}

            <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                value={formData.password}
                onChange={handleChange}
                error={!!formErrors.password}
                helperText={formErrors.password}
                disabled={isLoading}
            />

            {isRegistering && (
                <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="confirmPassword"
                    label="Confirm Password"
                    type="password"
                    id="confirmPassword"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={!!formErrors.confirmPassword}
                    helperText={formErrors.confirmPassword}
                    disabled={isLoading}
                />
            )}

            <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={isLoading}
            >
                {isLoading ? (
                    <CircularProgress size={24} />
                ) : isRegistering ? (
                    'Register'
                ) : (
                    'Sign In'
                )}
            </Button>

            <Box textAlign="center">
                <Link
                    component="button"
                    variant="body2"
                    onClick={toggleMode}
                    type="button"
                    disabled={isLoading}
                >
                    {isRegistering
                        ? 'Already have an account? Sign in'
                        : "Don't have an account? Register"}
                </Link>
            </Box>
        </Box>
    );
}; 