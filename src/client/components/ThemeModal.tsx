import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Switch,
    FormControlLabel,
    TextField,
    Slider,
    Button,
    Divider,
    Paper,
    IconButton
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';

interface ThemeModalProps {
    open: boolean;
    onClose: () => void;
    currentTheme: 'light' | 'dark';
    currentHighlightColor: string;
    currentSentenceHighlightColor: string;
    currentFontSize: number;
    currentLineHeight: number;
    currentFontFamily: string;
    currentTextColor: string;
    onThemeChange: (theme: 'light' | 'dark') => void;
    onHighlightColorChange: (color: string) => void;
    onSentenceHighlightColorChange: (color: string) => void;
    onFontSizeChange: (fontSize: number) => void;
    onLineHeightChange: (lineHeight: number) => void;
    onFontFamilyChange: (fontFamily: string) => void;
    onTextColorChange: (textColor: string) => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
    open,
    onClose,
    currentTheme,
    currentHighlightColor,
    currentSentenceHighlightColor,
    currentFontSize,
    currentLineHeight,
    currentFontFamily,
    currentTextColor,
    onThemeChange,
    onHighlightColorChange,
    onSentenceHighlightColorChange,
    onFontSizeChange,
    onLineHeightChange,
    onFontFamilyChange,
    onTextColorChange
}) => {
    const [localTheme, setLocalTheme] = useState(currentTheme);
    const [localHighlightColor, setLocalHighlightColor] = useState(currentHighlightColor);
    const [localSentenceHighlightColor, setLocalSentenceHighlightColor] = useState(currentSentenceHighlightColor);
    const [localFontSize, setLocalFontSize] = useState(currentFontSize);
    const [localLineHeight, setLocalLineHeight] = useState(currentLineHeight);
    const [localFontFamily, setLocalFontFamily] = useState(currentFontFamily);
    const [localTextColor, setLocalTextColor] = useState(currentTextColor);

    useEffect(() => {
        setLocalTheme(currentTheme);
        setLocalHighlightColor(currentHighlightColor);
        setLocalSentenceHighlightColor(currentSentenceHighlightColor);
        setLocalFontSize(currentFontSize);
        setLocalLineHeight(currentLineHeight);
        setLocalFontFamily(currentFontFamily);
        setLocalTextColor(currentTextColor);
    }, [currentTheme, currentHighlightColor, currentSentenceHighlightColor, currentFontSize, currentLineHeight, currentFontFamily, currentTextColor]);

    const handleThemeToggle = (checked: boolean) => {
        const newTheme = checked ? 'dark' : 'light';
        setLocalTheme(newTheme);
        onThemeChange(newTheme);

        // Auto-adjust sentence highlight color for better contrast
        if (newTheme === 'dark' && (localSentenceHighlightColor.startsWith('#e') || localSentenceHighlightColor.startsWith('#f'))) {
            const newColor = '#1a237e'; // Default dark blue for dark mode
            setLocalSentenceHighlightColor(newColor);
            onSentenceHighlightColorChange(newColor);
        } else if (newTheme === 'light' && !localSentenceHighlightColor.startsWith('#e') && !localSentenceHighlightColor.startsWith('#f')) {
            const newColor = '#e3f2fd'; // Default light blue for light mode
            setLocalSentenceHighlightColor(newColor);
            onSentenceHighlightColorChange(newColor);
        }
    };

    const handleHighlightColorChange = (color: string) => {
        setLocalHighlightColor(color);
        onHighlightColorChange(color);
    };

    const handleSentenceHighlightColorChange = (color: string) => {
        setLocalSentenceHighlightColor(color);
        onSentenceHighlightColorChange(color);
    };

    const handleFontSizeChange = (value: number) => {
        setLocalFontSize(value);
        onFontSizeChange(value);
    };

    const handleLineHeightChange = (value: number) => {
        setLocalLineHeight(value);
        onLineHeightChange(value);
    };

    const handleFontFamilyChange = (fontFamily: string) => {
        setLocalFontFamily(fontFamily);
        onFontFamilyChange(fontFamily);
    };

    const handleTextColorChange = (textColor: string) => {
        setLocalTextColor(textColor);
        onTextColorChange(textColor);
    };

    const handleFontSizeDecrease = () => {
        const newSize = Math.max(0.8, Math.round((localFontSize - 0.1) * 10) / 10);
        setLocalFontSize(newSize);
        onFontSizeChange(newSize);
    };

    const handleFontSizeIncrease = () => {
        const newSize = Math.min(1.5, Math.round((localFontSize + 0.1) * 10) / 10);
        setLocalFontSize(newSize);
        onFontSizeChange(newSize);
    };

    const handleLineHeightDecrease = () => {
        const newHeight = Math.max(1.2, Math.round((localLineHeight - 0.1) * 10) / 10);
        setLocalLineHeight(newHeight);
        onLineHeightChange(newHeight);
    };

    const handleLineHeightIncrease = () => {
        const newHeight = Math.min(2.0, Math.round((localLineHeight + 0.1) * 10) / 10);
        setLocalLineHeight(newHeight);
        onLineHeightChange(newHeight);
    };

    const presetColors = [
        '#ffeb3b', // Yellow
        '#ff9800', // Orange  
        '#f44336', // Red
        '#e91e63', // Pink
        '#9c27b0', // Purple
        '#3f51b5', // Indigo
        '#2196f3', // Blue
        '#00bcd4', // Cyan
        '#009688', // Teal
        '#4caf50', // Green
        '#8bc34a', // Light Green
        '#cddc39'  // Lime
    ];

    const presetSentenceColors = localTheme === 'dark' ? [
        '#1a237e', // Dark Blue
        '#4a148c', // Dark Purple
        '#1b5e20', // Dark Green
        '#e65100', // Dark Orange
        '#880e4f', // Dark Pink
        '#33691e', // Dark Lime
        '#004d40', // Dark Teal
        '#f57f17'  // Dark Yellow
    ] : [
        '#e3f2fd', // Light Blue
        '#f3e5f5', // Light Purple
        '#e8f5e8', // Light Green
        '#fff3e0', // Light Orange
        '#fce4ec', // Light Pink
        '#f1f8e9', // Light Lime
        '#e0f2f1', // Light Teal
        '#fff8e1'  // Light Yellow
    ];

    const fontSizeMarks = [
        { value: 0.8, label: '0.8x' },
        { value: 1.0, label: '1x' },
        { value: 1.2, label: '1.2x' },
        { value: 1.5, label: '1.5x' }
    ];

    const lineHeightMarks = [
        { value: 1.2, label: '1.2' },
        { value: 1.5, label: '1.5' },
        { value: 1.8, label: '1.8' },
        { value: 2.0, label: '2.0' }
    ];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Theme & Appearance Settings</DialogTitle>
            <DialogContent>
                <Box sx={{ py: 2 }}>
                    {/* Theme Toggle */}
                    <Typography variant="h6" gutterBottom>
                        Theme Mode
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={localTheme === 'dark'}
                                onChange={(e) => handleThemeToggle(e.target.checked)}
                            />
                        }
                        label={`${localTheme === 'dark' ? 'Dark' : 'Light'} Mode`}
                        sx={{ mb: 3 }}
                    />

                    <Divider sx={{ my: 3 }} />

                    {/* Word Highlight Color */}
                    <Typography variant="h6" gutterBottom>
                        Word Highlight Color
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Color used to highlight the currently playing word
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        {presetColors.map((color) => (
                            <Paper
                                key={color}
                                sx={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: color,
                                    cursor: 'pointer',
                                    border: localHighlightColor === color ? '3px solid #000' : '1px solid #ccc',
                                    '&:hover': { border: '2px solid #666' }
                                }}
                                onClick={() => handleHighlightColorChange(color)}
                            />
                        ))}
                    </Box>

                    <TextField
                        label="Custom Color"
                        type="color"
                        value={localHighlightColor}
                        onChange={(e) => handleHighlightColorChange(e.target.value)}
                        size="small"
                        sx={{ mb: 3 }}
                    />

                    <Divider sx={{ my: 3 }} />

                    {/* Sentence Highlight Color */}
                    <Typography variant="h6" gutterBottom>
                        Sentence Highlight Color
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Background color for the current sentence
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        {presetSentenceColors.map((color) => (
                            <Paper
                                key={color}
                                sx={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: color,
                                    cursor: 'pointer',
                                    border: localSentenceHighlightColor === color ? '3px solid #000' : '1px solid #ccc',
                                    '&:hover': { border: '2px solid #666' }
                                }}
                                onClick={() => handleSentenceHighlightColorChange(color)}
                            />
                        ))}
                    </Box>

                    <TextField
                        label="Custom Color"
                        type="color"
                        value={localSentenceHighlightColor}
                        onChange={(e) => handleSentenceHighlightColorChange(e.target.value)}
                        size="small"
                        sx={{ mb: 3 }}
                    />

                    <Divider sx={{ my: 3 }} />

                    {/* Typography Settings */}
                    <Typography variant="h6" gutterBottom>
                        Typography
                    </Typography>

                    {/* Font Size */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Font size: {localFontSize}x
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <IconButton
                            onClick={handleFontSizeDecrease}
                            disabled={localFontSize <= 0.8}
                            size="small"
                            sx={{ minWidth: 40, height: 40 }}
                        >
                            <Remove />
                        </IconButton>
                        <Slider
                            value={localFontSize}
                            onChange={(_, value) => handleFontSizeChange(value as number)}
                            min={0.8}
                            max={1.5}
                            step={0.1}
                            marks={fontSizeMarks}
                            valueLabelDisplay="auto"
                            sx={{ flex: 1 }}
                        />
                        <IconButton
                            onClick={handleFontSizeIncrease}
                            disabled={localFontSize >= 1.5}
                            size="small"
                            sx={{ minWidth: 40, height: 40 }}
                        >
                            <Add />
                        </IconButton>
                    </Box>

                    {/* Line Height */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Line height: {localLineHeight}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <IconButton
                            onClick={handleLineHeightDecrease}
                            disabled={localLineHeight <= 1.2}
                            size="small"
                            sx={{ minWidth: 40, height: 40 }}
                        >
                            <Remove />
                        </IconButton>
                        <Slider
                            value={localLineHeight}
                            onChange={(_, value) => handleLineHeightChange(value as number)}
                            min={1.2}
                            max={2.0}
                            step={0.1}
                            marks={lineHeightMarks}
                            valueLabelDisplay="auto"
                            sx={{ flex: 1 }}
                        />
                        <IconButton
                            onClick={handleLineHeightIncrease}
                            disabled={localLineHeight >= 2.0}
                            size="small"
                            sx={{ minWidth: 40, height: 40 }}
                        >
                            <Add />
                        </IconButton>
                    </Box>

                    {/* Font Family */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Font Family
                    </Typography>
                    <TextField
                        select
                        fullWidth
                        value={localFontFamily}
                        onChange={(e) => handleFontFamilyChange(e.target.value)}
                        SelectProps={{ native: true }}
                        sx={{ mb: 3 }}
                    >
                        <option value="Inter, system-ui, sans-serif">Inter</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Times New Roman, serif">Times New Roman</option>
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Helvetica, sans-serif">Helvetica</option>
                        <option value="Roboto, sans-serif">Roboto</option>
                        <option value="Open Sans, sans-serif">Open Sans</option>
                        <option value="Lato, sans-serif">Lato</option>
                        <option value="Montserrat, sans-serif">Montserrat</option>
                        <option value="Merriweather, serif">Merriweather</option>
                        <option value="Crimson Text, serif">Crimson Text</option>
                        <option value="Fira Sans, sans-serif">Fira Sans</option>
                    </TextField>

                    {/* Text Color */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Text Color
                    </Typography>
                    <TextField
                        label="Text Color"
                        type="color"
                        value={localTextColor}
                        onChange={(e) => handleTextColorChange(e.target.value)}
                        size="small"
                        sx={{ mb: 3 }}
                    />

                    <Divider sx={{ my: 3 }} />

                    {/* Preview */}
                    <Typography variant="h6" gutterBottom>
                        Preview
                    </Typography>
                    <Paper
                        sx={{
                            p: 2,
                            backgroundColor: localTheme === 'dark' ? '#1a1a1a' : '#ffffff',
                            color: localTextColor,
                            fontSize: `${localFontSize}rem`,
                            lineHeight: localLineHeight,
                            fontFamily: localFontFamily
                        }}
                    >
                        <Typography component="span" sx={{ backgroundColor: localSentenceHighlightColor, p: 0.5 }}>
                            This is a sample sentence with{' '}
                            <Typography
                                component="span"
                                sx={{
                                    backgroundColor: localHighlightColor,
                                    color: '#ffffff',
                                    p: '0 2px',
                                    borderRadius: '3px'
                                }}
                            >
                                highlighted
                            </Typography>
                            {' '}word to show how the theme looks.
                        </Typography>
                    </Paper>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}; 