import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Slider,
    Typography,
    FormControlLabel,
    Switch,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Divider,
    IconButton,
    ButtonGroup,
    LinearProgress,
    Alert,
    CircularProgress
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import { VOICE_MAPPINGS, type Voice, type TtsProvider, getVoiceTier } from '../../common/tts/ttsUtils';
import { useTtsUsage } from '../hooks/useTtsUsage';
import { getVoiceTypeUsage, getTotalCostBeyondFreeTier } from '../../common/tts/ttsUsageCalculator';

interface SpeedControlModalProps {
    open: boolean;
    onClose: () => void;
    ttsEnabled?: boolean;
    currentSpeed: number;
    currentVoice: string;
    currentProvider: string;
    wordTimingOffset: number;
    onSpeedChange: (speed: number) => void;
    onTtsEnabledChange?: (enabled: boolean) => void;
    onVoiceChange: (voice: string) => void;
    onProviderChange: (provider: string) => void;
    onWordTimingOffsetChange: (offset: number) => void;
    onPreviewVoice: (voice: string, provider: string) => void;
}

export const SpeedControlModal: React.FC<SpeedControlModalProps> = ({
    open,
    onClose,
    ttsEnabled = true,
    currentSpeed,
    currentVoice,
    currentProvider,
    wordTimingOffset,
    onSpeedChange,
    onTtsEnabledChange,
    onVoiceChange,
    onProviderChange,
    onWordTimingOffsetChange,
    onPreviewVoice
}) => {
    const [localSpeed, setLocalSpeed] = useState(currentSpeed);
    const [localVoice, setLocalVoice] = useState(currentVoice);
    const [localOffset, setLocalOffset] = useState(wordTimingOffset);
    const [selectedProvider, setSelectedProvider] = useState<TtsProvider>(currentProvider as TtsProvider || 'google');
    const [availableVoices, setAvailableVoices] = useState<Voice[]>(VOICE_MAPPINGS[currentProvider as TtsProvider] || VOICE_MAPPINGS.google);
    const [localTtsEnabled, setLocalTtsEnabled] = useState<boolean>(ttsEnabled);

    // Fetch TTS usage when modal opens
    const { summary, loading: usageLoading, error: usageError } = useTtsUsage(open);

    useEffect(() => {
        setLocalSpeed(currentSpeed);
        setLocalVoice(currentVoice);
        setLocalOffset(wordTimingOffset);
        setLocalTtsEnabled(ttsEnabled);
    }, [currentSpeed, currentVoice, wordTimingOffset, ttsEnabled]);

    // Ensure we have a valid voice selected when modal opens
    useEffect(() => {
        if (open && availableVoices.length > 0 && !availableVoices.some(v => v.id === localVoice)) {
            const firstVoice = availableVoices[0].id;
            setLocalVoice(firstVoice);
            onVoiceChange(firstVoice);
        }
    }, [open, availableVoices, localVoice, onVoiceChange]);

    const handleProviderClick = (provider: TtsProvider) => {
        setSelectedProvider(provider);
        const voices = VOICE_MAPPINGS[provider];
        setAvailableVoices(voices);

        // Save provider change
        onProviderChange(provider);

        // Auto-select the first voice when switching providers
        if (voices.length > 0) {
            const firstVoice = voices[0].id;
            setLocalVoice(firstVoice);
            onVoiceChange(firstVoice);
        }
    };

    const handleSpeedChange = (value: number) => {
        setLocalSpeed(value);
        onSpeedChange(value);
    };

    const handleVoiceChange = (voice: string) => {
        setLocalVoice(voice);
        onVoiceChange(voice);
    };

    const handleOffsetChange = (value: number) => {
        setLocalOffset(value);
        onWordTimingOffsetChange(value);
    };

    const handlePreview = () => {
        onPreviewVoice(localVoice, selectedProvider);
    };

    const handleSpeedDecrease = () => {
        const newSpeed = Math.max(0.5, Math.round((localSpeed - 0.05) * 100) / 100);
        setLocalSpeed(newSpeed);
        onSpeedChange(newSpeed);
    };

    const handleSpeedIncrease = () => {
        const newSpeed = Math.min(2, Math.round((localSpeed + 0.05) * 100) / 100);
        setLocalSpeed(newSpeed);
        onSpeedChange(newSpeed);
    };

    const handleOffsetDecrease = () => {
        const newOffset = Math.max(-500, localOffset - 25);
        setLocalOffset(newOffset);
        onWordTimingOffsetChange(newOffset);
    };

    const handleOffsetIncrease = () => {
        const newOffset = Math.min(500, localOffset + 25);
        setLocalOffset(newOffset);
        onWordTimingOffsetChange(newOffset);
    };

    const speedMarks = [
        { value: 0.5, label: '0.5x' },
        { value: 1, label: '1x' },
        { value: 2, label: '2x' }
    ];

    const offsetMarks = [
        { value: -500, label: '-500ms' },
        { value: 0, label: '0ms' },
        { value: 500, label: '+500ms' }
    ];

    // Helper function to get current voice tier
    const getCurrentVoiceTier = (): string => {
        return getVoiceTier(selectedProvider, localVoice);
    };

    // Helper function to format usage display
    const formatUsageDisplay = () => {
        if (usageLoading) {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                        Loading usage data...
                    </Typography>
                </Box>
            );
        }

        if (usageError) {
            return (
                <Alert severity="warning" sx={{ mt: 2 }}>
                    Unable to load usage data
                </Alert>
            );
        }

        if (!summary?.freeTierMonthUsage) {
            return null;
        }

        const currentTier = getCurrentVoiceTier();
        const usageInfo = getVoiceTypeUsage(selectedProvider, currentTier, summary.freeTierMonthUsage);

        const formatNumber = (num: number) => num.toLocaleString();

        if (usageInfo.isInFreeTier) {
            // Still in free tier - show percentage
            return (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Free Tier Usage ({currentTier})
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LinearProgress
                            variant="determinate"
                            value={usageInfo.percentageUsed}
                            sx={{ flex: 1, height: 8, borderRadius: 1 }}
                            color={usageInfo.percentageUsed > 80 ? 'warning' : 'primary'}
                        />
                        <Typography variant="body2" fontWeight="medium">
                            {usageInfo.percentageUsed.toFixed(1)}%
                        </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {formatNumber(usageInfo.usedCharacters)} / {formatNumber(usageInfo.freeLimit)} characters used this month
                    </Typography>
                </Box>
            );
        } else {
            // Beyond free tier - show total cost
            const totalCost = getTotalCostBeyondFreeTier(summary.freeTierMonthUsage);
            return (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                    <Typography variant="body2" color="warning.main" gutterBottom fontWeight="medium">
                        Beyond Free Tier
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Current voice type ({currentTier}): {formatNumber(usageInfo.exceededCharacters)} characters beyond free tier
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" fontWeight="medium">
                        Total cost beyond free tier (all providers): ${totalCost.toFixed(2)}
                    </Typography>
                </Box>
            );
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Playback Settings</DialogTitle>
            <DialogContent>
                <Box sx={{ py: 2 }}>
                    {/* TTS Enable Toggle */}
                    <Box sx={{ mb: 3 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={localTtsEnabled}
                                    onChange={(e) => {
                                        const value = e.target.checked;
                                        setLocalTtsEnabled(value);
                                        if (onTtsEnabledChange) {
                                            onTtsEnabledChange(value);
                                        }
                                    }}
                                />
                            }
                            label={localTtsEnabled ? 'Text-to-Speech: On' : 'Text-to-Speech: Off'}
                        />
                        <Typography variant="body2" color="text.secondary">
                            When off, audio preloading and playback are disabled.
                        </Typography>
                    </Box>

                    {/* Playback Speed */}
                    <Typography variant="h6" gutterBottom>
                        Playback Speed
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Current speed: {localSpeed}x
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                        <IconButton
                            onClick={handleSpeedDecrease}
                            disabled={localSpeed <= 0.5}
                            size="small"
                            sx={{ minWidth: 40, height: 40 }}
                        >
                            <Remove />
                        </IconButton>
                        <Slider
                            value={localSpeed}
                            onChange={(_, value) => handleSpeedChange(value as number)}
                            min={0.5}
                            max={2}
                            step={0.05}
                            marks={speedMarks}
                            valueLabelDisplay="auto"
                            sx={{
                                flex: 1,
                                '& .MuiSlider-markLabel': {
                                    fontSize: '0.75rem'
                                }
                            }}
                        />
                        <IconButton
                            onClick={handleSpeedIncrease}
                            disabled={localSpeed >= 2}
                            size="small"
                            sx={{ minWidth: 40, height: 40 }}
                        >
                            <Add />
                        </IconButton>
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* Voice Selection */}
                    <Typography variant="h6" gutterBottom>
                        Voice Selection
                    </Typography>

                    {/* Provider Selection */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Choose provider:
                    </Typography>
                    <ButtonGroup variant="outlined" sx={{ mb: 3 }}>
                        <Button
                            variant={selectedProvider === 'google' ? 'contained' : 'outlined'}
                            onClick={() => handleProviderClick('google')}
                        >
                            Google
                        </Button>
                        <Button
                            variant={selectedProvider === 'polly' ? 'contained' : 'outlined'}
                            onClick={() => handleProviderClick('polly')}
                        >
                            Polly
                        </Button>
                        <Button
                            variant={selectedProvider === 'elevenlabs' ? 'contained' : 'outlined'}
                            onClick={() => handleProviderClick('elevenlabs')}
                        >
                            ElevenLabs
                        </Button>
                    </ButtonGroup>

                    {/* Voice Dropdown */}
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Voice</InputLabel>
                        <Select
                            value={availableVoices.some(v => v.id === localVoice) ? localVoice : (availableVoices[0]?.id || '')}
                            label="Voice"
                            onChange={(e) => handleVoiceChange(e.target.value)}
                        >
                            {availableVoices.map(voice => (
                                <MenuItem key={voice.id} value={voice.id}>
                                    {voice.name} ({voice.gender}) - {voice.tier}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        variant="outlined"
                        onClick={handlePreview}
                        sx={{ mb: 3 }}
                    >
                        Preview Voice
                    </Button>

                    {/* Usage Display */}
                    {formatUsageDisplay()}

                    <Divider sx={{ my: 3 }} />

                    {/* Word Timing Offset */}
                    <Typography variant="h6" gutterBottom>
                        Word Timing Adjustment
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Current offset: {localOffset}ms
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <IconButton
                            onClick={handleOffsetDecrease}
                            disabled={localOffset <= -500}
                            size="small"
                            sx={{ minWidth: 40, height: 40 }}
                        >
                            <Remove />
                        </IconButton>
                        <Slider
                            value={localOffset}
                            onChange={(_, value) => handleOffsetChange(value as number)}
                            min={-500}
                            max={500}
                            step={25}
                            marks={offsetMarks}
                            valueLabelDisplay="auto"
                            valueLabelFormat={(value) => `${value}ms`}
                            sx={{
                                flex: 1,
                                '& .MuiSlider-markLabel': {
                                    fontSize: '0.75rem'
                                }
                            }}
                        />
                        <IconButton
                            onClick={handleOffsetIncrease}
                            disabled={localOffset >= 500}
                            size="small"
                            sx={{ minWidth: 40, height: 40 }}
                        >
                            <Add />
                        </IconButton>
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}; 