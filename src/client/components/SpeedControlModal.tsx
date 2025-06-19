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
import { TtsProviderSelector } from './TtsProviderSelector';
import { getTtsProviders } from '../../apis/tts/client';
import { VOICE_MAPPINGS, type Voice, type TtsProvider } from '../../common/tts/ttsUtils';

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
    const [currentProvider, setCurrentProvider] = useState<TtsProvider>('google');
    const [availableVoices, setAvailableVoices] = useState<Voice[]>(VOICE_MAPPINGS.google);

    // Load current provider and update voices
    useEffect(() => {
        const loadCurrentProvider = async () => {
            try {
                const result = await getTtsProviders();
                if (result.data?.success && result.data.currentProvider) {
                    const provider = result.data.currentProvider;
                    setCurrentProvider(provider);
                    const newVoices = VOICE_MAPPINGS[provider] || VOICE_MAPPINGS.google;
                    setAvailableVoices(newVoices);
                    
                    // Debug logging
                    console.log('Current provider:', provider);
                    console.log('Available voices:', newVoices.map(v => `${v.id} (${v.tier})`));
                    console.log('Current voice:', currentVoice);
                    console.log('Local voice:', localVoice);
                }
            } catch (error) {
                console.error('Failed to load current TTS provider:', error);
            }
        };
        
        if (open) {
            loadCurrentProvider();
        }
    }, [open, currentVoice, localVoice]);

    useEffect(() => {
        setLocalSpeed(currentSpeed);
        setLocalVoice(currentVoice);
        setLocalOffset(wordTimingOffset);
    }, [currentSpeed, currentVoice, wordTimingOffset]);

    // Auto-select default voice if current voice is not available
    useEffect(() => {
        if (availableVoices.length > 0 && !availableVoices.some(v => v.id === localVoice)) {
            const defaultVoice = currentProvider === 'polly' ? 'Joanna' : 
                                currentProvider === 'elevenlabs' ? 'pNInz6obpgDQGcFmaJgB' : // Adam voice
                                'en-US-Neural2-A'; // Google default
            const voiceToUse = availableVoices.find(voice => voice.id === defaultVoice)?.id || availableVoices[0].id;
            setLocalVoice(voiceToUse);
            onVoiceChange(voiceToUse);
        }
    }, [availableVoices, localVoice, currentProvider, onVoiceChange]);

    // Handle provider change from TtsProviderSelector
    const handleProviderChange = (provider: TtsProvider) => {
        setCurrentProvider(provider);
        const newVoices = VOICE_MAPPINGS[provider] || VOICE_MAPPINGS.google;
        setAvailableVoices(newVoices);
        
        // If current voice is not available in new provider, switch to default voice for that provider
        const currentVoiceExists = newVoices.some(voice => voice.id === localVoice);
        if (!currentVoiceExists && newVoices.length > 0) {
            // Use preferred default voices for each provider
            const defaultVoice = provider === 'polly' ? 'Joanna' : 
                                provider === 'elevenlabs' ? 'pNInz6obpgDQGcFmaJgB' : // Adam voice
                                'en-US-Neural2-A'; // Google default
            const voiceToUse = newVoices.find(voice => voice.id === defaultVoice)?.id || newVoices[0].id;
            setLocalVoice(voiceToUse);
            onVoiceChange(voiceToUse);
        }
    };

    const handleSpeedChange = (value: number) => {
        setLocalSpeed(value);
        onSpeedChange(value);
    };

    const handleVoiceChange = (voice: string) => {
        console.log('Voice change requested:', voice);
        console.log('Available voices:', availableVoices.map(v => v.id));
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

                    {/* TTS Provider Selection */}
                    <Typography variant="h6" gutterBottom>
                        TTS Provider
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Choose your text-to-speech provider. Note: Changing provider will clear audio cache.
                    </Typography>
                    <Box sx={{ mb: 3 }}>
                        <TtsProviderSelector onProviderChange={handleProviderChange} />
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* Voice Selection */}
                    <Typography variant="h6" gutterBottom>
                        Voice Selection
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Choose your preferred voice for {
                            currentProvider === 'google' ? 'Google TTS' : 
                            currentProvider === 'polly' ? 'Amazon Polly' : 
                            currentProvider === 'elevenlabs' ? 'ElevenLabs' : 
                            'TTS Provider'
                        }. Note: Changing voice will clear audio cache.
                    </Typography>
                    <Typography variant="caption" color="primary" sx={{ mb: 2, display: 'block' }}>
                        Showing {availableVoices.length} voices available for {
                            currentProvider === 'google' ? 'Google TTS' : 
                            currentProvider === 'polly' ? 'Amazon Polly' : 
                            currentProvider === 'elevenlabs' ? 'ElevenLabs' : 
                            'Provider'
                        }
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                        Current selection: {localVoice || 'None'} | Valid: {availableVoices.some(v => v.id === localVoice) ? 'Yes' : 'No'}
                    </Typography>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Voice</InputLabel>
                        <Select
                            value={availableVoices.some(v => v.id === localVoice) ? localVoice : ''}
                            label="Voice"
                            onChange={(e) => {
                                console.log('Select onChange triggered:', e.target.value);
                                handleVoiceChange(e.target.value);
                            }}
                        >
                            {(() => {
                                const menuItems = [];
                                
                                // Handle ElevenLabs differently - all voices are neural tier with their pricing
                                if (currentProvider === 'elevenlabs') {
                                    const neuralVoices = availableVoices.filter(voice => voice.tier === 'neural');
                                    if (neuralVoices.length > 0) {
                                        menuItems.push(
                                            <MenuItem key="elevenlabs-header" disabled sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                                                ElevenLabs Voices - $0.18/1K chars (20K free/month)
                                            </MenuItem>
                                        );
                                        neuralVoices.forEach(voice => {
                                            menuItems.push(
                                                <MenuItem 
                                                    key={voice.id} 
                                                    value={voice.id} 
                                                    sx={{ pl: 3 }}
                                                    onClick={() => console.log('MenuItem clicked:', voice.id)}
                                                >
                                                    {voice.name} ({voice.gender})
                                                </MenuItem>
                                            );
                                        });
                                    }
                                } else {
                                    // Handle Google and Polly voices with their existing pricing
                                    
                                    // Standard Voices
                                    const standardVoices = availableVoices.filter(voice => voice.tier === 'standard');
                                    if (standardVoices.length > 0) {
                                        menuItems.push(
                                            <MenuItem key="standard-header" disabled sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                                                Standard Voices - $4/1M chars (5M free/month)
                                            </MenuItem>
                                        );
                                        standardVoices.forEach(voice => {
                                            menuItems.push(
                                                <MenuItem 
                                                    key={voice.id} 
                                                    value={voice.id} 
                                                    sx={{ pl: 3 }}
                                                    onClick={() => console.log('MenuItem clicked:', voice.id)}
                                                >
                                                    {voice.name} ({voice.gender})
                                                </MenuItem>
                                            );
                                        });
                                    }
                                    
                                    // Neural Voices
                                    const neuralVoices = availableVoices.filter(voice => voice.tier === 'neural');
                                    if (neuralVoices.length > 0) {
                                        menuItems.push(
                                            <MenuItem key="neural-header" disabled sx={{ fontWeight: 'bold', color: 'text.primary', mt: 1 }}>
                                                Neural Voices - {currentProvider === 'google' ? '$16/1M chars' : '$16/1M chars (1M free/month)'}
                                            </MenuItem>
                                        );
                                        neuralVoices.forEach(voice => {
                                            menuItems.push(
                                                <MenuItem 
                                                    key={voice.id} 
                                                    value={voice.id} 
                                                    sx={{ pl: 3 }}
                                                    onClick={() => console.log('MenuItem clicked:', voice.id)}
                                                >
                                                    {voice.name} ({voice.gender})
                                                </MenuItem>
                                            );
                                        });
                                    }
                                    
                                    // Long-Form Voices
                                    const longFormVoices = availableVoices.filter(voice => voice.tier === 'long-form');
                                    if (longFormVoices.length > 0) {
                                        menuItems.push(
                                            <MenuItem key="long-form-header" disabled sx={{ fontWeight: 'bold', color: 'text.primary', mt: 1 }}>
                                                Long-Form Voices - $100/1M chars (500K free/month)
                                            </MenuItem>
                                        );
                                        longFormVoices.forEach(voice => {
                                            menuItems.push(
                                                <MenuItem 
                                                    key={voice.id} 
                                                    value={voice.id} 
                                                    sx={{ pl: 3 }}
                                                    onClick={() => console.log('MenuItem clicked:', voice.id)}
                                                >
                                                    {voice.name} ({voice.gender})
                                                </MenuItem>
                                            );
                                        });
                                    }
                                    
                                    // Generative Voices
                                    const generativeVoices = availableVoices.filter(voice => voice.tier === 'generative');
                                    if (generativeVoices.length > 0) {
                                        menuItems.push(
                                            <MenuItem key="generative-header" disabled sx={{ fontWeight: 'bold', color: 'text.primary', mt: 1 }}>
                                                Generative Voices - $30/1M chars (100K free/month)
                                            </MenuItem>
                                        );
                                        generativeVoices.forEach(voice => {
                                            menuItems.push(
                                                <MenuItem 
                                                    key={voice.id} 
                                                    value={voice.id} 
                                                    sx={{ pl: 3 }}
                                                    onClick={() => console.log('MenuItem clicked:', voice.id)}
                                                >
                                                    {voice.name} ({voice.gender})
                                                </MenuItem>
                                            );
                                        });
                                    }
                                }
                                
                                return menuItems;
                            })()}
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