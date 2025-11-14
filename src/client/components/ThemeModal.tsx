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
    Paper,
    IconButton,
    Tabs,
    Tab,
    Autocomplete,
    Stack,
    Chip
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';

interface FontOption {
    label: string;
    value: string;
    category: string;
}

const FONT_FAMILY_OPTIONS: FontOption[] = [
    // Sans-serif fonts
    { label: 'Inter', value: 'Inter, system-ui, sans-serif', category: 'Sans-serif' },
    { label: 'SF Pro', value: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif', category: 'Sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif', category: 'Sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif', category: 'Sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif', category: 'Sans-serif' },
    { label: 'Open Sans', value: 'Open Sans, sans-serif', category: 'Sans-serif' },
    { label: 'Lato', value: 'Lato, sans-serif', category: 'Sans-serif' },
    { label: 'Montserrat', value: 'Montserrat, sans-serif', category: 'Sans-serif' },
    { label: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif', category: 'Sans-serif' },
    { label: 'Poppins', value: 'Poppins, sans-serif', category: 'Sans-serif' },
    { label: 'Raleway', value: 'Raleway, sans-serif', category: 'Sans-serif' },
    { label: 'Nunito', value: 'Nunito, sans-serif', category: 'Sans-serif' },
    { label: 'Ubuntu', value: 'Ubuntu, sans-serif', category: 'Sans-serif' },
    { label: 'PT Sans', value: 'PT Sans, sans-serif', category: 'Sans-serif' },
    { label: 'Noto Sans', value: 'Noto Sans, sans-serif', category: 'Sans-serif' },
    { label: 'Work Sans', value: 'Work Sans, sans-serif', category: 'Sans-serif' },
    { label: 'Quicksand', value: 'Quicksand, sans-serif', category: 'Sans-serif' },
    { label: 'Mulish', value: 'Mulish, sans-serif', category: 'Sans-serif' },
    { label: 'Barlow', value: 'Barlow, sans-serif', category: 'Sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif', category: 'Sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif', category: 'Sans-serif' },
    { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif', category: 'Sans-serif' },
    { label: 'IBM Plex Sans', value: 'IBM Plex Sans, sans-serif', category: 'Sans-serif' },
    { label: 'Space Grotesk', value: '"Space Grotesk", sans-serif', category: 'Sans-serif' },

    // Serif fonts
    { label: 'Georgia', value: 'Georgia, serif', category: 'Serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif', category: 'Serif' },
    { label: 'Merriweather', value: 'Merriweather, serif', category: 'Serif' },
    { label: 'Crimson Text', value: 'Crimson Text, serif', category: 'Serif' },
    { label: 'Playfair Display', value: 'Playfair Display, serif', category: 'Serif' },
    { label: 'Lora', value: 'Lora, serif', category: 'Serif' },
    { label: 'PT Serif', value: 'PT Serif, serif', category: 'Serif' },
    { label: 'Noto Serif', value: 'Noto Serif, serif', category: 'Serif' },
    { label: 'Source Serif Pro', value: 'Source Serif Pro, serif', category: 'Serif' },
    { label: 'EB Garamond', value: 'EB Garamond, serif', category: 'Serif' },
    { label: 'Libre Baskerville', value: 'Libre Baskerville, serif', category: 'Serif' },
    { label: 'Cormorant', value: 'Cormorant, serif', category: 'Serif' },
    { label: 'Spectral', value: 'Spectral, serif', category: 'Serif' },
    { label: 'Cardo', value: 'Cardo, serif', category: 'Serif' },
    { label: 'Gentium Plus', value: '"Gentium Plus", serif', category: 'Serif' },
    { label: 'Literata', value: 'Literata, serif', category: 'Serif' },

    // Monospace fonts
    { label: 'Courier New', value: 'Courier New, monospace', category: 'Monospace' },
    { label: 'Monaco', value: 'Monaco, monospace', category: 'Monospace' },
    { label: 'Consolas', value: 'Consolas, monospace', category: 'Monospace' },
    { label: 'Fira Code', value: 'Fira Code, monospace', category: 'Monospace' },
    { label: 'Source Code Pro', value: 'Source Code Pro, monospace', category: 'Monospace' },
    { label: 'JetBrains Mono', value: 'JetBrains Mono, monospace', category: 'Monospace' },
    { label: 'IBM Plex Mono', value: 'IBM Plex Mono, monospace', category: 'Monospace' },
    { label: 'Roboto Mono', value: 'Roboto Mono, monospace', category: 'Monospace' },
    { label: 'Ubuntu Mono', value: 'Ubuntu Mono, monospace', category: 'Monospace' },
    { label: 'Inconsolata', value: 'Inconsolata, monospace', category: 'Monospace' },
    { label: 'Cascadia Code', value: '"Cascadia Code", monospace', category: 'Monospace' }
];

const findFontOptionByValue = (value: string) =>
    FONT_FAMILY_OPTIONS.find(
        (option) => option.value === value || option.label.toLowerCase() === value.toLowerCase()
    );

const getFontLabelFromValue = (value: string) => {
    const match = findFontOptionByValue(value);
    return match ? match.label : value;
};

const tabAccessibilityProps = (index: number) => ({
    id: `theme-modal-tab-${index}`,
    'aria-controls': `theme-modal-tabpanel-${index}`
});

const TabPanel: React.FC<{ value: number; index: number; children: React.ReactNode }> = ({ value, index, children }) => (
    <Box
        role="tabpanel"
        hidden={value !== index}
        id={`theme-modal-tabpanel-${index}`}
        aria-labelledby={`theme-modal-tab-${index}`}
    >
        {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </Box>
);

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
    currentChunkSpacing: number;
    currentAutoScrollSpeed: number;
    onThemeChange: (theme: 'light' | 'dark') => void;
    onHighlightColorChange: (color: string) => void;
    onSentenceHighlightColorChange: (color: string) => void;
    onFontSizeChange: (fontSize: number) => void;
    onLineHeightChange: (lineHeight: number) => void;
    onFontFamilyChange: (fontFamily: string) => void;
    onTextColorChange: (textColor: string) => void;
    onChunkSpacingChange: (spacing: number) => void;
    onAutoScrollSpeedChange: (speed: number) => void;
    highlightMode?: 'word' | 'line' | 'off';
    onHighlightModeChange?: (mode: 'word' | 'line' | 'off') => void;
    autoFontScaling?: boolean;
    onAutoFontScalingChange?: (enabled: boolean) => void;
    bionicReadingEnabled?: boolean;
    onBionicReadingChange?: (enabled: boolean) => void;
    onResetToDefaults: () => void;
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
    currentChunkSpacing,
    currentAutoScrollSpeed,
    onThemeChange,
    onHighlightColorChange,
    onSentenceHighlightColorChange,
    onFontSizeChange,
    onLineHeightChange,
    onFontFamilyChange,
    onTextColorChange,
    onChunkSpacingChange,
    onAutoScrollSpeedChange,
    highlightMode = 'word',
    onHighlightModeChange,
    autoFontScaling = true,
    onAutoFontScalingChange,
    bionicReadingEnabled = false,
    onBionicReadingChange,
    onResetToDefaults
}) => {
    const [activeTab, setActiveTab] = useState(0);
    const [localTheme, setLocalTheme] = useState(currentTheme);
    const [localHighlightColor, setLocalHighlightColor] = useState(currentHighlightColor);
    const [localSentenceHighlightColor, setLocalSentenceHighlightColor] = useState(currentSentenceHighlightColor);
    const [localFontSize, setLocalFontSize] = useState(currentFontSize);
    const [localLineHeight, setLocalLineHeight] = useState(currentLineHeight);
    const [localFontFamily, setLocalFontFamily] = useState(currentFontFamily);
    const [localTextColor, setLocalTextColor] = useState(currentTextColor);
    const [localChunkSpacing, setLocalChunkSpacing] = useState(currentChunkSpacing);
    const [localAutoScrollSpeed, setLocalAutoScrollSpeed] = useState(currentAutoScrollSpeed);
    const [localHighlightMode, setLocalHighlightMode] = useState<'word' | 'line' | 'off'>(highlightMode);
    const [localAutoFontScaling, setLocalAutoFontScaling] = useState(autoFontScaling);
    const [localBionicReadingEnabled, setLocalBionicReadingEnabled] = useState(bionicReadingEnabled);
    const [fontInputValue, setFontInputValue] = useState(getFontLabelFromValue(currentFontFamily));

    useEffect(() => {
        setLocalTheme(currentTheme);
        setLocalHighlightColor(currentHighlightColor);
        setLocalSentenceHighlightColor(currentSentenceHighlightColor);
        setLocalFontSize(currentFontSize);
        setLocalLineHeight(currentLineHeight);
        setLocalFontFamily(currentFontFamily);
        setLocalTextColor(currentTextColor);
        setLocalChunkSpacing(currentChunkSpacing);
        setLocalAutoScrollSpeed(currentAutoScrollSpeed);
        setLocalHighlightMode(highlightMode);
        setLocalAutoFontScaling(autoFontScaling);
        setLocalBionicReadingEnabled(bionicReadingEnabled);
        setFontInputValue(getFontLabelFromValue(currentFontFamily));
    }, [currentTheme, currentHighlightColor, currentSentenceHighlightColor, currentFontSize, currentLineHeight, currentFontFamily, currentTextColor, currentChunkSpacing, currentAutoScrollSpeed, highlightMode, autoFontScaling, bionicReadingEnabled]);

    useEffect(() => {
        if (open) {
            setActiveTab(0);
        }
    }, [open]);

    const handleThemeToggle = (checked: boolean) => {
        const newTheme = checked ? 'dark' : 'light';
        setLocalTheme(newTheme);
        onThemeChange(newTheme);

        // Auto-adjust sentence highlight color for better contrast
        if (newTheme === 'dark' && (localSentenceHighlightColor.startsWith('#e') || localSentenceHighlightColor.startsWith('#f'))) {
            const newColor = '#1a237e';
            setLocalSentenceHighlightColor(newColor);
            onSentenceHighlightColorChange(newColor);
        } else if (newTheme === 'light' && !localSentenceHighlightColor.startsWith('#e') && !localSentenceHighlightColor.startsWith('#f')) {
            const newColor = '#e3f2fd';
            setLocalSentenceHighlightColor(newColor);
            onSentenceHighlightColorChange(newColor);
        }
    };

    const handleHighlightColorChange = (color: string) => {
        setLocalHighlightColor(color);
    };

    const handleSentenceHighlightColorChange = (color: string) => {
        setLocalSentenceHighlightColor(color);
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
    };

    const handleFontSizeDecrease = () => {
        const newSize = Math.max(0.8, Math.round((localFontSize - 0.1) * 10) / 10);
        setLocalFontSize(newSize);
        onFontSizeChange(newSize);
    };

    const handleFontSizeIncrease = () => {
        const newSize = Math.min(2.0, Math.round((localFontSize + 0.1) * 10) / 10);
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

    const handleChunkSpacingChange = (value: number) => {
        setLocalChunkSpacing(value);
        onChunkSpacingChange(value);
    };

    const handleChunkSpacingDecrease = () => {
        const newSpacing = Math.max(0, Math.round((localChunkSpacing - 0.1) * 10) / 10);
        setLocalChunkSpacing(newSpacing);
        onChunkSpacingChange(newSpacing);
    };

    const handleChunkSpacingIncrease = () => {
        const newSpacing = Math.min(2.0, Math.round((localChunkSpacing + 0.1) * 10) / 10);
        setLocalChunkSpacing(newSpacing);
        onChunkSpacingChange(newSpacing);
    };

    const handleAutoScrollSpeedChangeInternal = (value: number) => {
        const clamped = Math.min(200, Math.max(20, Math.round(value)));
        setLocalAutoScrollSpeed(clamped);
        onAutoScrollSpeedChange(clamped);
    };

    const handleAutoScrollSpeedDecrease = () => {
        handleAutoScrollSpeedChangeInternal(localAutoScrollSpeed - 1);
    };

    const handleAutoScrollSpeedIncrease = () => {
        handleAutoScrollSpeedChangeInternal(localAutoScrollSpeed + 1);
    };

    const handleResetToDefaults = () => {
        onResetToDefaults();
    };

    const handleAutoFontScalingToggle = (enabled: boolean) => {
        setLocalAutoFontScaling(enabled);
        if (onAutoFontScalingChange) {
            onAutoFontScalingChange(enabled);
        }
    };

    const handleBionicReadingToggle = (enabled: boolean) => {
        setLocalBionicReadingEnabled(enabled);
        if (onBionicReadingChange) {
            onBionicReadingChange(enabled);
        }
    };

    const handleDialogClose = () => {
        if (localHighlightColor !== currentHighlightColor) onHighlightColorChange(localHighlightColor);
        if (localSentenceHighlightColor !== currentSentenceHighlightColor) onSentenceHighlightColorChange(localSentenceHighlightColor);
        if (localTextColor !== currentTextColor) onTextColorChange(localTextColor);
        if (onHighlightModeChange && localHighlightMode !== highlightMode) onHighlightModeChange(localHighlightMode);
        onClose();
    };

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const commitFontFamilyFromInput = (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) return;

        const match = FONT_FAMILY_OPTIONS.find(
            (opt) => opt.label.toLowerCase() === trimmed.toLowerCase()
        );

        if (match) {
            handleFontFamilyChange(match.value);
            setFontInputValue(match.label);
        } else {
            handleFontFamilyChange(trimmed);
            setFontInputValue(trimmed);
        }
    };

    const renderColorSwatch = (
        color: string,
        selectedColor: string,
        onChange: (color: string) => void,
        ariaLabel: string
    ) => {
        const isSelected = color === selectedColor;
        return (
            <Box
                key={color}
                onClick={() => onChange(color)}
                aria-label={`${ariaLabel} ${color}`}
                sx={{
                    width: 36,
                    height: 36,
                    backgroundColor: color,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: isSelected ? '3px solid' : '2px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    transition: 'all 0.2s',
                    '&:hover': {
                        transform: 'scale(1.1)',
                        borderColor: isSelected ? 'primary.main' : 'text.secondary'
                    }
                }}
            />
        );
    };

    const presetColors = [
        '#ffeb3b', '#ff9800', '#f44336', '#e91e63',
        '#9c27b0', '#3f51b5', '#2196f3', '#00bcd4',
        '#009688', '#4caf50', '#8bc34a', '#cddc39'
    ];

    const presetSentenceColors = localTheme === 'dark' ? [
        '#1a237e', '#4a148c', '#1b5e20', '#e65100',
        '#880e4f', '#33691e', '#004d40', '#f57f17'
    ] : [
        '#e3f2fd', '#f3e5f5', '#e8f5e8', '#fff3e0',
        '#fce4ec', '#f1f8e9', '#e0f2f1', '#fff8e1'
    ];

    const presetTextColors = localTheme === 'dark' ? [
        '#ffffff', '#e0e0e0', '#b0b0b0', '#90caf9',
        '#a5d6a7', '#ffcc80', '#f48fb1', '#ce93d8'
    ] : [
        '#000000', '#212121', '#424242', '#1976d2',
        '#388e3c', '#f57c00', '#c2185b', '#7b1fa2'
    ];

    const selectedFontOption = findFontOptionByValue(localFontFamily);
    const fontAutocompleteValue: FontOption | string = selectedFontOption ?? localFontFamily;

    return (
        <Dialog 
            open={open} 
            onClose={handleDialogClose} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: {
                    height: '90vh',
                    maxHeight: 800
                }
            }}
        >
            <DialogTitle sx={{ pb: 2 }}>Theme & Appearance</DialogTitle>
            <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    sx={{ 
                        borderBottom: 1, 
                        borderColor: 'divider',
                        px: 3,
                        minHeight: 48,
                        '& .MuiTab-root': {
                            minHeight: 48,
                            textTransform: 'none',
                            fontSize: '0.95rem',
                            fontWeight: 500
                        }
                    }}
                >
                    <Tab label="Colors" {...tabAccessibilityProps(0)} />
                    <Tab label="Typography" {...tabAccessibilityProps(1)} />
                    <Tab label="Features" {...tabAccessibilityProps(2)} />
                </Tabs>

                <Box sx={{ flex: 1, overflow: 'auto', px: 3 }}>
                    <TabPanel value={activeTab} index={0}>
                        <Stack spacing={3}>
                            {/* Theme Mode */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Theme Mode
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={localTheme === 'dark'}
                                            onChange={(e) => handleThemeToggle(e.target.checked)}
                                        />
                                    }
                                    label={localTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                                />
                            </Box>

                            {/* Text Color */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Text Color
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                    {presetTextColors.map((color) =>
                                        renderColorSwatch(color, localTextColor, handleTextColorChange, 'Set text color to')
                                    )}
                                </Box>
                                <TextField
                                    type="color"
                                    value={localTextColor}
                                    onChange={(e) => handleTextColorChange(e.target.value)}
                                    size="small"
                                    fullWidth
                                    sx={{ maxWidth: 200 }}
                                />
                            </Box>

                            {/* Word Highlight */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Word Highlight
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Highlights the currently playing word
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                    {presetColors.map((color) =>
                                        renderColorSwatch(color, localHighlightColor, handleHighlightColorChange, 'Set word highlight to')
                                    )}
                                </Box>
                                <TextField
                                    type="color"
                                    value={localHighlightColor}
                                    onChange={(e) => handleHighlightColorChange(e.target.value)}
                                    size="small"
                                    fullWidth
                                    sx={{ maxWidth: 200 }}
                                />
                            </Box>

                            {/* Sentence Highlight */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Sentence Background
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Background color for the current sentence
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                                    {presetSentenceColors.map((color) =>
                                        renderColorSwatch(color, localSentenceHighlightColor, handleSentenceHighlightColorChange, 'Set sentence background to')
                                    )}
                                </Box>
                                <TextField
                                    type="color"
                                    value={localSentenceHighlightColor}
                                    onChange={(e) => handleSentenceHighlightColorChange(e.target.value)}
                                    size="small"
                                    fullWidth
                                    sx={{ maxWidth: 200 }}
                                />
                            </Box>
                        </Stack>
                    </TabPanel>

                    <TabPanel value={activeTab} index={1}>
                        <Stack spacing={3}>
                            {/* Font Size */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Font Size
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <IconButton
                                        onClick={handleFontSizeDecrease}
                                        disabled={localFontSize <= 0.8}
                                        size="small"
                                    >
                                        <Remove />
                                    </IconButton>
                                    <Slider
                                        value={localFontSize}
                                        onChange={(_, value) => handleFontSizeChange(value as number)}
                                        min={0.8}
                                        max={2.0}
                                        step={0.1}
                                        valueLabelDisplay="auto"
                                        sx={{ flex: 1 }}
                                    />
                                    <IconButton
                                        onClick={handleFontSizeIncrease}
                                        disabled={localFontSize >= 2.0}
                                        size="small"
                                    >
                                        <Add />
                                    </IconButton>
                                    <Chip label={`${localFontSize}x`} size="small" sx={{ minWidth: 60 }} />
                                </Box>
                            </Box>

                            {/* Line Height */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Line Height
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <IconButton
                                        onClick={handleLineHeightDecrease}
                                        disabled={localLineHeight <= 1.2}
                                        size="small"
                                    >
                                        <Remove />
                                    </IconButton>
                                    <Slider
                                        value={localLineHeight}
                                        onChange={(_, value) => handleLineHeightChange(value as number)}
                                        min={1.2}
                                        max={2.0}
                                        step={0.1}
                                        valueLabelDisplay="auto"
                                        sx={{ flex: 1 }}
                                    />
                                    <IconButton
                                        onClick={handleLineHeightIncrease}
                                        disabled={localLineHeight >= 2.0}
                                        size="small"
                                    >
                                        <Add />
                                    </IconButton>
                                    <Chip label={`${localLineHeight}`} size="small" sx={{ minWidth: 60 }} />
                                </Box>
                            </Box>

                            {/* Chunk Spacing */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Sentence Spacing
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Space between sentences
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <IconButton
                                        onClick={handleChunkSpacingDecrease}
                                        disabled={localChunkSpacing <= 0}
                                        size="small"
                                    >
                                        <Remove />
                                    </IconButton>
                                    <Slider
                                        value={localChunkSpacing}
                                        onChange={(_, value) => handleChunkSpacingChange(value as number)}
                                        min={0}
                                        max={2.0}
                                        step={0.1}
                                        valueLabelDisplay="auto"
                                        sx={{ flex: 1 }}
                                    />
                                    <IconButton
                                        onClick={handleChunkSpacingIncrease}
                                        disabled={localChunkSpacing >= 2.0}
                                        size="small"
                                    >
                                        <Add />
                                    </IconButton>
                                    <Chip label={`${localChunkSpacing}em`} size="small" sx={{ minWidth: 60 }} />
                                </Box>
                            </Box>

                            {/* Font Family */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Font Family
                                </Typography>
                                <Autocomplete<FontOption | string, false, false, true>
                                    value={fontAutocompleteValue}
                                    options={FONT_FAMILY_OPTIONS}
                                    freeSolo
                                    inputValue={fontInputValue}
                                    onInputChange={(_, newInputValue) => setFontInputValue(newInputValue)}
                                    onChange={(_, newValue) => {
                                        if (typeof newValue === 'string') {
                                            commitFontFamilyFromInput(newValue);
                                        } else if (newValue?.value) {
                                            handleFontFamilyChange(newValue.value);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        const target = e.target as HTMLInputElement;
                                        if (target?.value) {
                                            commitFontFamilyFromInput(target.value);
                                        }
                                    }}
                                    groupBy={(option) => typeof option === 'string' ? 'Custom' : option.category}
                                    getOptionLabel={(option) => typeof option === 'string' ? option : option.label}
                                    renderOption={(props, option) => {
                                        const { key, ...otherProps } = props;
                                        return (
                                            <li key={key} {...otherProps}>
                                                {typeof option === 'string' ? option : option.label}
                                            </li>
                                        );
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder="Search or type font name..."
                                            size="small"
                                        />
                                    )}
                                />
                            </Box>
                        </Stack>
                    </TabPanel>

                    <TabPanel value={activeTab} index={2}>
                        <Stack spacing={3}>
                            {/* Auto Scroll Speed */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Auto Scroll Speed
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Controls how fast the page scrolls in fullscreen auto-scroll mode (pixels per second)
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <IconButton
                                        onClick={handleAutoScrollSpeedDecrease}
                                        disabled={localAutoScrollSpeed <= 20}
                                        size="small"
                                    >
                                        <Remove />
                                    </IconButton>
                                    <Slider
                                        value={localAutoScrollSpeed}
                                        onChange={(_, value) => handleAutoScrollSpeedChangeInternal(value as number)}
                                        min={20}
                                        max={200}
                                        step={1}
                                        valueLabelDisplay="auto"
                                        sx={{ flex: 1 }}
                                    />
                                    <IconButton
                                        onClick={handleAutoScrollSpeedIncrease}
                                        disabled={localAutoScrollSpeed >= 200}
                                        size="small"
                                    >
                                        <Add />
                                    </IconButton>
                                    <Chip label={`${localAutoScrollSpeed} px/s`} size="small" sx={{ minWidth: 80 }} />
                                </Box>
                            </Box>

                            {/* Highlight Mode */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Highlight Mode
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Choose how text is highlighted in Focus mode
                                </Typography>
                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant={localHighlightMode === 'word' ? 'contained' : 'outlined'}
                                        onClick={() => setLocalHighlightMode('word')}
                                        size="small"
                                    >
                                        Word
                                    </Button>
                                    <Button
                                        variant={localHighlightMode === 'line' ? 'contained' : 'outlined'}
                                        onClick={() => setLocalHighlightMode('line')}
                                        size="small"
                                    >
                                        Line
                                    </Button>
                                    <Button
                                        variant={localHighlightMode === 'off' ? 'contained' : 'outlined'}
                                        onClick={() => setLocalHighlightMode('off')}
                                        size="small"
                                    >
                                        Off
                                    </Button>
                                </Stack>
                            </Box>

                            {/* Auto Font Scaling */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Auto Font Scaling
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Automatically scale down long sentences in Focus mode
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={localAutoFontScaling}
                                            onChange={(e) => handleAutoFontScalingToggle(e.target.checked)}
                                        />
                                    }
                                    label={localAutoFontScaling ? 'Enabled' : 'Disabled'}
                                />
                            </Box>

                            {/* Bionic Reading */}
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Bionic Reading
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                                    Bold the first part of each word for faster reading
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={localBionicReadingEnabled}
                                            onChange={(e) => handleBionicReadingToggle(e.target.checked)}
                                        />
                                    }
                                    label={localBionicReadingEnabled ? 'Enabled' : 'Disabled'}
                                />
                            </Box>
                        </Stack>
                    </TabPanel>
                </Box>

                {/* Preview - Fixed at bottom */}
                <Paper
                    elevation={3}
                    sx={{
                        p: 2,
                        borderRadius: 0,
                        borderTop: 1,
                        borderColor: 'divider',
                        backgroundColor: 'background.paper'
                    }}
                >
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                        Preview
                    </Typography>
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 2,
                            backgroundColor: localTheme === 'dark' ? '#1a1a1a' : '#ffffff',
                            color: localTextColor,
                            fontSize: `${localFontSize}rem`,
                            lineHeight: localLineHeight,
                            fontFamily: localFontFamily
                        }}
                    >
                        <Box component="span" sx={{ backgroundColor: localSentenceHighlightColor, px: 0.5, py: 0.25, borderRadius: 0.5 }}>
                            Sample text with{' '}
                            <Box
                                component="span"
                                sx={{
                                    backgroundColor: localHighlightColor,
                                    color: '#fff',
                                    px: 1,
                                    py: 0.25,
                                    borderRadius: '12px',
                                    fontWeight: 600
                                }}
                            >
                                highlight
                            </Box>
                        </Box>
                    </Paper>
                </Paper>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleResetToDefaults} variant="outlined" color="secondary">
                    Reset
                </Button>
                <Button onClick={handleDialogClose} variant="contained">
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
};
