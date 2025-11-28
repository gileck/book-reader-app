import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, CircularProgress, Box } from '@mui/material';
import { type TtsProvider, getVoiceTier, getVoiceById } from '../../common/tts/ttsUtils';
import { useTtsUsage } from '../hooks/useTtsUsage';
import { getVoiceTypeUsage } from '../../common/tts/ttsUsageCalculator';
import { VoicePickerSheet } from './VoicePickerSheet';

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
}

// Voice tier configuration for display
const getTierLabel = (tier: string): string => {
    switch (tier) {
        case 'chirp3-hd': return 'Chirp 3 HD';
        case 'studio': return 'Studio';
        case 'neural2': return 'Neural2';
        case 'wavenet': return 'WaveNet';
        case 'standard': return 'Standard';
        case 'long-form': return 'Long-Form';
        case 'generative': return 'Generative';
        case 'neural': return 'Neural';
        default: return tier;
    }
};

const getProviderDisplayName = (provider: TtsProvider): string => {
    switch (provider) {
        case 'google': return 'Google';
        case 'polly': return 'Polly';
        case 'elevenlabs': return 'ElevenLabs';
        default: return provider;
    }
};

const isPremiumTier = (tier: string): boolean => {
    return ['chirp3-hd', 'studio', 'neural2', 'long-form', 'generative', 'neural'].includes(tier);
};

// iOS-style CSS
const styles = {
    sheet: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        background: 'var(--ios-bg, #1c1c1e)',
        color: 'var(--ios-label, #fff)',
        borderRadius: '14px 14px 0 0',
        overflow: 'hidden',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column' as const,
    },
    grabber: {
        width: 36,
        height: 5,
        background: 'rgba(255,255,255,0.3)',
        borderRadius: 3,
        margin: '8px auto 4px',
    },
    header: {
        padding: '12px 16px 14px',
        textAlign: 'center' as const,
        borderBottom: '0.5px solid rgba(255,255,255,0.1)',
    },
    title: {
        fontSize: 17,
        fontWeight: 600,
        margin: 0,
    },
    content: {
        flex: 1,
        overflowY: 'auto' as const,
        WebkitOverflowScrolling: 'touch' as const,
    },
    section: {
        padding: '20px 16px 8px',
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.55)',
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        minHeight: 44,
        padding: '0 16px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        marginBottom: 8,
    },
    rowLabel: {
        flex: 1,
        fontSize: 17,
    },
    rowValue: {
        fontSize: 17,
        color: 'rgba(255,255,255,0.55)',
    },
    voiceCard: {
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '12px 16px',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
    },
    voiceCardTop: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    voiceCardProvider: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    voiceCardBadge: {
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 4,
        background: 'rgba(10,132,255,0.2)',
        color: '#0a84ff',
    },
    voiceCardName: {
        fontSize: 17,
        fontWeight: 600,
        color: '#fff',
    },
    voiceCardGender: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.4)',
        marginLeft: 8,
    },
    changeButton: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 15,
        color: '#0a84ff',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
    },
    toggle: {
        width: 51,
        height: 31,
        borderRadius: 16,
        padding: 2,
        cursor: 'pointer',
        transition: 'background 0.2s ease',
    },
    toggleKnob: {
        width: 27,
        height: 27,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
    },
    slider: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 0',
    },
    sliderTrack: {
        flex: 1,
        height: 4,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        position: 'relative' as const,
    },
    sliderFill: {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        height: '100%',
        background: '#0a84ff',
        borderRadius: 2,
    },
    sliderThumb: {
        width: 28,
        height: 28,
        background: '#fff',
        borderRadius: '50%',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        position: 'absolute' as const,
        top: -12,
        transform: 'translateX(-50%)',
        cursor: 'pointer',
    },
    usageBar: {
        height: 4,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
        marginTop: 8,
    },
    usageFill: {
        height: '100%',
        background: '#30d158',
        borderRadius: 2,
        transition: 'width 0.3s ease',
    },
    footer: {
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        borderTop: '0.5px solid rgba(255,255,255,0.1)',
    },
    doneButton: {
        width: '100%',
        padding: '14px',
        fontSize: 17,
        fontWeight: 600,
        background: '#0a84ff',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'opacity 0.15s ease',
    },
};

// Chevron Right Icon SVG
const ChevronRightIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M4 2l4 4-4 4" />
    </svg>
);

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
}) => {
    const [localSpeed, setLocalSpeed] = useState(currentSpeed);
    const [localOffset, setLocalOffset] = useState(wordTimingOffset);
    const [localTtsEnabled, setLocalTtsEnabled] = useState<boolean>(ttsEnabled);
    const [voicePickerOpen, setVoicePickerOpen] = useState(false);

    const { summary, loading: usageLoading } = useTtsUsage(open);

    // Get current voice details for display
    const provider = currentProvider as TtsProvider || 'google';
    const currentVoiceData = useMemo(() => getVoiceById(provider, currentVoice), [provider, currentVoice]);
    const currentVoiceTier = getVoiceTier(provider, currentVoice);
    const usageInfo = summary?.freeTierMonthUsage
        ? getVoiceTypeUsage(provider, currentVoiceTier, summary.freeTierMonthUsage)
        : null;

    useEffect(() => {
        setLocalSpeed(currentSpeed);
        setLocalOffset(wordTimingOffset);
        setLocalTtsEnabled(ttsEnabled);
    }, [currentSpeed, wordTimingOffset, ttsEnabled]);

    const handleSpeedChange = (value: number) => {
        setLocalSpeed(value);
        onSpeedChange(value);
    };

    const handleVoiceConfirm = (voice: string, newProvider: TtsProvider) => {
        onProviderChange(newProvider);
        onVoiceChange(voice);
        setVoicePickerOpen(false);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            PaperProps={{
                sx: {
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    m: 0,
                    maxWidth: '100%',
                    width: '100%',
                    '@media (min-width: 500px)': {
                        position: 'relative',
                        bottom: 'auto',
                        maxWidth: 400,
                        borderRadius: '14px',
                        m: 2,
                    }
                }
            }}
            slotProps={{
                backdrop: {
                    sx: { background: 'rgba(0,0,0,0.5)' }
                }
            }}
        >
            <div style={styles.sheet}>
                {/* Grabber */}
                <div style={styles.grabber} />

                {/* Header */}
                <div style={styles.header}>
                    <h2 style={styles.title}>Playback Settings</h2>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {/* TTS Toggle */}
                    <div style={styles.section}>
                        <div style={styles.row}>
                            <span style={styles.rowLabel}>Text-to-Speech</span>
                            <div
                                style={{
                                    ...styles.toggle,
                                    background: localTtsEnabled ? '#30d158' : 'rgba(255,255,255,0.15)'
                                }}
                                onClick={() => {
                                    const newValue = !localTtsEnabled;
                                    setLocalTtsEnabled(newValue);
                                    onTtsEnabledChange?.(newValue);
                                }}
                            >
                                <div style={{
                                    ...styles.toggleKnob,
                                    transform: localTtsEnabled ? 'translateX(20px)' : 'translateX(0)'
                                }} />
                            </div>
                        </div>
                    </div>

                    {/* Speed */}
                    <div style={styles.section}>
                        <div style={styles.sectionLabel}>Speed</div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '8px 0',
                        }}>
                            <button
                                onClick={() => handleSpeedChange(Math.max(0.5, localSpeed - 0.1))}
                                disabled={localSpeed <= 0.5}
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 14,
                                    border: 'none',
                                    background: localSpeed <= 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                                    color: localSpeed <= 0.5 ? 'rgba(255,255,255,0.2)' : '#fff',
                                    fontSize: 28,
                                    fontWeight: 300,
                                    cursor: localSpeed <= 0.5 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.15s ease',
                                    flexShrink: 0,
                                }}
                            >
                                −
                            </button>
                            <div style={{
                                flex: 1,
                                textAlign: 'center',
                            }}>
                                <div style={{
                                    fontSize: 40,
                                    fontWeight: 600,
                                    letterSpacing: -1,
                                    color: '#fff',
                                }}>
                                    {localSpeed.toFixed(1)}x
                                </div>
                                <div style={{
                                    fontSize: 13,
                                    color: 'rgba(255,255,255,0.4)',
                                    marginTop: 2,
                                }}>
                                    Playback Speed
                                </div>
                            </div>
                            <button
                                onClick={() => handleSpeedChange(Math.min(2, localSpeed + 0.1))}
                                disabled={localSpeed >= 2}
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 14,
                                    border: 'none',
                                    background: localSpeed >= 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                                    color: localSpeed >= 2 ? 'rgba(255,255,255,0.2)' : '#fff',
                                    fontSize: 28,
                                    fontWeight: 300,
                                    cursor: localSpeed >= 2 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.15s ease',
                                    flexShrink: 0,
                                }}
                            >
                                +
                            </button>
                        </div>
                        <div style={styles.slider}>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>0.5x</span>
                            <div style={styles.sliderTrack}>
                                <div style={{
                                    ...styles.sliderFill,
                                    width: `${((localSpeed - 0.5) / 1.5) * 100}%`
                                }} />
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    value={localSpeed}
                                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                                    style={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: '100%',
                                        opacity: 0,
                                        cursor: 'pointer',
                                        top: -10,
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>2x</span>
                        </div>
                    </div>

                    {/* Voice Selection - Summary Card */}
                    <div style={styles.section}>
                        <div style={styles.sectionLabel}>Voice</div>

                        {/* Voice Summary Card */}
                        <div
                            style={styles.voiceCard}
                            onClick={() => setVoicePickerOpen(true)}
                        >
                            <div style={styles.voiceCardTop}>
                                <div style={styles.voiceCardProvider}>
                                    {getProviderDisplayName(provider)}
                                    {isPremiumTier(currentVoiceTier) && (
                                        <span style={styles.voiceCardBadge}>HQ</span>
                                    )}
                                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                                    <span>{getTierLabel(currentVoiceTier)}</span>
                                </div>
                                <button style={styles.changeButton}>
                                    Change
                                    <ChevronRightIcon />
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                <span style={styles.voiceCardName}>
                                    {currentVoiceData?.name || currentVoice}
                                </span>
                                {currentVoiceData && (
                                    <span style={styles.voiceCardGender}>
                                        {currentVoiceData.gender}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Usage */}
                        {usageLoading ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, opacity: 0.5 }}>
                                <CircularProgress size={12} sx={{ color: 'rgba(255,255,255,0.4)' }} />
                                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading usage...</span>
                            </Box>
                        ) : usageInfo && (
                            <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Free tier ({currentVoiceTier})</span>
                                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{usageInfo.percentageUsed.toFixed(0)}%</span>
                                </div>
                                <div style={styles.usageBar}>
                                    <div style={{
                                        ...styles.usageFill,
                                        width: `${Math.min(usageInfo.percentageUsed, 100)}%`,
                                        background: usageInfo.percentageUsed > 80 ? '#ff9f0a' : '#30d158'
                                    }} />
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                                    {usageInfo.usedCharacters.toLocaleString()} / {usageInfo.freeLimit.toLocaleString()} chars
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Word Timing */}
                    <div style={styles.section}>
                        <div style={styles.sectionLabel}>Advanced</div>
                        <div style={styles.row}>
                            <span style={styles.rowLabel}>Word Timing Offset</span>
                            <span style={styles.rowValue}>{localOffset}ms</span>
                        </div>
                        <div style={styles.slider}>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>-500</span>
                            <div style={styles.sliderTrack}>
                                <div style={{
                                    ...styles.sliderFill,
                                    left: '50%',
                                    width: `${Math.abs(localOffset) / 10}%`,
                                    transform: localOffset < 0 ? 'translateX(-100%)' : 'none'
                                }} />
                                <input
                                    type="range"
                                    min="-500"
                                    max="500"
                                    step="25"
                                    value={localOffset}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        setLocalOffset(val);
                                        onWordTimingOffsetChange(val);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: '100%',
                                        opacity: 0,
                                        cursor: 'pointer',
                                        top: -10,
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>+500</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <button
                        style={styles.doneButton}
                        onClick={onClose}
                    >
                        Done
                    </button>
                </div>
            </div>

            {/* Voice Picker Sheet */}
            <VoicePickerSheet
                open={voicePickerOpen}
                onClose={() => setVoicePickerOpen(false)}
                currentVoice={currentVoice}
                currentProvider={provider}
                onConfirm={handleVoiceConfirm}
            />
        </Dialog>
    );
};
