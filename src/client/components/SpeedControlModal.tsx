import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Slider,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Divider,
    IconButton
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';

interface SpeedControlModalProps {
    open: boolean;
    onClose: () => void;
    currentSpeed: number;
    currentVoice: string;
    wordTimingOffset: number;
    onSpeedChange: (speed: number) => void;
    onVoiceChange: (voice: string) => void;
    onWordTimingOffsetChange: (offset: number) => void;
    onPreviewVoice: (voice: string) => void;
}

const AVAILABLE_VOICES = [
    { id: 'en-US-Neural2-A', name: 'Emma (Female)', gender: 'Female' },
    { id: 'en-US-Neural2-C', name: 'Brian (Male)', gender: 'Male' },
    { id: 'en-US-Neural2-D', name: 'Jenny (Female)', gender: 'Female' },
    { id: 'en-US-Neural2-E', name: 'Davis (Male)', gender: 'Male' },
    { id: 'en-US-Neural2-F', name: 'Clara (Female)', gender: 'Female' },
    { id: 'en-US-Neural2-G', name: 'Jason (Male)', gender: 'Male' },
    { id: 'en-US-Neural2-H', name: 'Tony (Male)', gender: 'Male' },
    { id: 'en-US-Neural2-I', name: 'Nancy (Female)', gender: 'Female' },
    { id: 'en-US-Neural2-J', name: 'Aaron (Male)', gender: 'Male' }
];

export const SpeedControlModal: React.FC<SpeedControlModalProps> = ({
    open,
    onClose,
    currentSpeed,
    currentVoice,
    wordTimingOffset,
    onSpeedChange,
    onVoiceChange,
    onWordTimingOffsetChange,
    onPreviewVoice
}) => {
    const [localSpeed, setLocalSpeed] = useState(currentSpeed);
    const [localVoice, setLocalVoice] = useState(currentVoice);
    const [localOffset, setLocalOffset] = useState(wordTimingOffset);

    useEffect(() => {
        setLocalSpeed(currentSpeed);
        setLocalVoice(currentVoice);
        setLocalOffset(wordTimingOffset);
    }, [currentSpeed, currentVoice, wordTimingOffset]);

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
        onPreviewVoice(localVoice);
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

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Playback Settings</DialogTitle>
            <DialogContent>
                <Box sx={{ py: 2 }}>
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
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Choose your preferred voice. Note: Changing voice will clear audio cache.
                    </Typography>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Voice</InputLabel>
                        <Select
                            value={localVoice}
                            label="Voice"
                            onChange={(e) => handleVoiceChange(e.target.value)}
                        >
                            {AVAILABLE_VOICES.map((voice) => (
                                <MenuItem key={voice.id} value={voice.id}>
                                    {voice.name} ({voice.gender})
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