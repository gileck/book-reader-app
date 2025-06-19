import React, { useState, useEffect } from 'react';
import { 
    FormControl, 
    InputLabel, 
    Select, 
    MenuItem, 
    SelectChangeEvent, 
    Box, 
    Typography,
    Chip
} from '@mui/material';
import { getTtsProviders, setTtsProvider } from '../../apis/tts/client';
import { type TtsProvider } from '../../common/tts/ttsUtils';

interface TtsProviderSelectorProps {
    onProviderChange?: (provider: TtsProvider) => void;
}

export const TtsProviderSelector: React.FC<TtsProviderSelectorProps> = ({
    onProviderChange
}) => {
    const [providers, setProviders] = useState<TtsProvider[]>([]);
    const [currentProvider, setCurrentProvider] = useState<TtsProvider>('google');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProviders();
    }, []);

    const loadProviders = async () => {
        try {
            const result = await getTtsProviders();
            if (result.data?.success) {
                setProviders(result.data.providers || []);
                setCurrentProvider(result.data.currentProvider || 'google');
            }
        } catch (error) {
            console.error('Failed to load TTS providers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProviderChange = async (event: SelectChangeEvent<TtsProvider>) => {
        const newProvider = event.target.value as TtsProvider;
        
        try {
            const result = await setTtsProvider({ provider: newProvider });
            if (result.data?.success) {
                setCurrentProvider(newProvider);
                onProviderChange?.(newProvider);
            }
        } catch (error) {
            console.error('Failed to set TTS provider:', error);
        }
    };

    const getProviderDisplayName = (provider: TtsProvider): string => {
        switch (provider) {
            case 'google':
                return 'Google Text-to-Speech';
            case 'polly':
                return 'Amazon Polly';
            case 'elevenlabs':
                return 'ElevenLabs';
            default:
                return provider;
        }
    };

    const getProviderDescription = (provider: TtsProvider): string => {
        switch (provider) {
            case 'google':
                return 'High-quality neural voices with precise word timing';
            case 'polly':
                return 'Natural-sounding AI voices with speech marks';
            case 'elevenlabs':
                return 'Premium AI voices with character-level alignment';
            default:
                return '';
        }
    };

    if (loading) {
        return <Typography variant="body2">Loading TTS providers...</Typography>;
    }

    if (providers.length === 0) {
        return (
            <Box>
                <Typography variant="body2" color="text.secondary">
                    No TTS providers available
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <FormControl fullWidth size="small">
                <InputLabel id="tts-provider-label">TTS Provider</InputLabel>
                <Select
                    labelId="tts-provider-label"
                    value={currentProvider}
                    label="TTS Provider"
                    onChange={handleProviderChange}
                >
                    {providers.map((provider) => (
                        <MenuItem key={provider} value={provider}>
                            <Box>
                                <Typography variant="body2">
                                    {getProviderDisplayName(provider)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {getProviderDescription(provider)}
                                </Typography>
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {providers.map((provider) => (
                    <Chip
                        key={provider}
                        label={provider}
                        size="small"
                        variant={provider === currentProvider ? 'filled' : 'outlined'}
                        color={provider === currentProvider ? 'primary' : 'default'}
                    />
                ))}
            </Box>
        </Box>
    );
}; 