import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, CircularProgress, Box } from '@mui/material';
import { VOICE_MAPPINGS, type Voice, type TtsProvider, getVoiceTier } from '../../common/tts/ttsUtils';
import { useTtsUsage } from '../hooks/useTtsUsage';
import { getVoiceTypeUsage } from '../../common/tts/ttsUsageCalculator';

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

// Voice tier configuration
interface TierConfig {
    key: string;
    label: string;
    price: string;
    freeLimit: string;
    isPremium: boolean;
}

const getTierConfig = (provider: TtsProvider, tier: string): TierConfig => {
    if (provider === 'google') {
        switch (tier) {
            case 'chirp3-hd': return { key: 'chirp3-hd', label: 'Chirp 3 HD', price: '$30/1M', freeLimit: '1M free', isPremium: true };
            case 'studio': return { key: 'studio', label: 'Studio', price: '$160/1M', freeLimit: '1M free', isPremium: true };
            case 'neural2': return { key: 'neural2', label: 'Neural2', price: '$16/1M', freeLimit: '1M free', isPremium: true };
            case 'wavenet': return { key: 'wavenet', label: 'WaveNet', price: '$4/1M', freeLimit: '4M free', isPremium: false };
            default: return { key: 'standard', label: 'Standard', price: '$4/1M', freeLimit: '4M free', isPremium: false };
        }
    } else if (provider === 'polly') {
        switch (tier) {
            case 'long-form': return { key: 'long-form', label: 'Long-Form', price: '$100/1M', freeLimit: '500K free', isPremium: true };
            case 'generative': return { key: 'generative', label: 'Generative', price: '$30/1M', freeLimit: '100K free', isPremium: true };
            case 'neural': return { key: 'neural', label: 'Neural', price: '$16/1M', freeLimit: '1M free', isPremium: true };
            default: return { key: 'standard', label: 'Standard', price: '$4/1M', freeLimit: '5M free', isPremium: false };
        }
    } else if (provider === 'gemini') {
        switch (tier) {
            case 'gemini-pro': return { key: 'gemini-pro', label: 'Pro (HQ)', price: '$30/1M', freeLimit: 'Pay per use', isPremium: true };
            case 'gemini-flash-lite': return { key: 'gemini-flash-lite', label: 'Flash Lite', price: '$4/1M', freeLimit: 'Pay per use', isPremium: false };
            default: return { key: 'gemini-flash', label: 'Flash', price: '$8/1M', freeLimit: 'Pay per use', isPremium: false };
        }
    } else {
        return { key: 'neural', label: 'Premium AI', price: '~$0.22/1K', freeLimit: '10K free', isPremium: true };
    }
};

const groupVoicesByTier = (voices: Voice[], provider: TtsProvider) => {
    const groups: Record<string, { config: TierConfig; voices: Voice[] }> = {};
    const tierOrder = provider === 'google'
        ? ['chirp3-hd', 'studio', 'neural2', 'wavenet', 'standard']
        : provider === 'polly'
            ? ['long-form', 'generative', 'neural', 'standard']
            : provider === 'gemini'
                ? ['gemini-pro', 'gemini-flash', 'gemini-flash-lite']
                : ['neural'];

    tierOrder.forEach(tier => {
        groups[tier] = { config: getTierConfig(provider, tier), voices: [] };
    });

    voices.forEach(voice => {
        if (groups[voice.tier]) groups[voice.tier].voices.push(voice);
    });

    return tierOrder.filter(tier => groups[tier]?.voices.length > 0).map(tier => groups[tier]);
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
    segmentedControl: {
        display: 'flex',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 9,
        padding: 2,
        gap: 2,
    },
    segment: {
        flex: 1,
        padding: '8px 12px',
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'center' as const,
        borderRadius: 7,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        color: 'rgba(255,255,255,0.6)',
        background: 'transparent',
        border: 'none',
    },
    segmentActive: {
        background: 'rgba(255,255,255,0.15)',
        color: '#fff',
        fontWeight: 600,
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
    tierHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        cursor: 'pointer',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        marginBottom: 2,
    },
    tierLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: 600,
    },
    tierBadge: {
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 4,
        background: 'rgba(255,255,255,0.15)',
        marginLeft: 8,
    },
    tierMeta: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
    },
    voiceRow: {
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px 12px 32px',
        cursor: 'pointer',
        borderRadius: 8,
        marginBottom: 1,
        transition: 'background 0.15s ease',
    },
    voiceRowSelected: {
        background: 'rgba(10,132,255,0.15)',
    },
    voiceName: {
        flex: 1,
        fontSize: 17,
    },
    voiceGender: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.4)',
        marginRight: 12,
    },
    playButton: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.6)',
        transition: 'all 0.15s ease',
    },
    checkmark: {
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: '#0a84ff',
        marginRight: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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

// Play Icon SVG
const PlayIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <path d="M3 1.5v11l9-5.5L3 1.5z" />
    </svg>
);

// Checkmark Icon SVG
const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="#fff">
        <path d="M5.5 10.5L2 7l1-1 2.5 2.5L11 3l1 1-6.5 6.5z" />
    </svg>
);

// Chevron Icon SVG
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
    <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="rgba(255,255,255,0.4)"
        style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
        }}
    >
        <path d="M2 4l4 4 4-4" />
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
    onPreviewVoice
}) => {
    const [localSpeed, setLocalSpeed] = useState(currentSpeed);
    const [localVoice, setLocalVoice] = useState(currentVoice);
    const [localOffset, setLocalOffset] = useState(wordTimingOffset);
    const [selectedProvider, setSelectedProvider] = useState<TtsProvider>(currentProvider as TtsProvider || 'google');
    const [localTtsEnabled, setLocalTtsEnabled] = useState<boolean>(ttsEnabled);
    const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());

    const { summary, loading: usageLoading } = useTtsUsage(open);

    const availableVoices = useMemo(() => VOICE_MAPPINGS[selectedProvider] || [], [selectedProvider]);
    const voiceGroups = useMemo(() => groupVoicesByTier(availableVoices, selectedProvider), [availableVoices, selectedProvider]);

    useEffect(() => {
        setLocalSpeed(currentSpeed);
        setLocalVoice(currentVoice);
        setLocalOffset(wordTimingOffset);
        setLocalTtsEnabled(ttsEnabled);
    }, [currentSpeed, currentVoice, wordTimingOffset, ttsEnabled]);

    // Auto-expand tier containing selected voice
    useEffect(() => {
        const voice = availableVoices.find(v => v.id === localVoice);
        if (voice) {
            setExpandedTiers(prev => new Set([...prev, voice.tier]));
        }
    }, [localVoice, availableVoices]);

    useEffect(() => {
        if (open && availableVoices.length > 0 && !availableVoices.some(v => v.id === localVoice)) {
            const firstVoice = availableVoices[0].id;
            setLocalVoice(firstVoice);
            onVoiceChange(firstVoice);
        }
    }, [open, availableVoices, localVoice, onVoiceChange]);

    const handleProviderClick = (provider: TtsProvider) => {
        setSelectedProvider(provider);
        onProviderChange(provider);
        const voices = VOICE_MAPPINGS[provider];
        if (voices.length > 0) {
            setLocalVoice(voices[0].id);
            onVoiceChange(voices[0].id);
        }
        setExpandedTiers(new Set());
    };

    const toggleTier = (tierKey: string) => {
        setExpandedTiers(prev => {
            const next = new Set(prev);
            if (next.has(tierKey)) next.delete(tierKey);
            else next.add(tierKey);
            return next;
        });
    };

    const handleSpeedChange = (value: number) => {
        setLocalSpeed(value);
        onSpeedChange(value);
    };

    const currentVoiceTier = getVoiceTier(selectedProvider, localVoice);
    const usageInfo = summary?.freeTierMonthUsage
        ? getVoiceTypeUsage(selectedProvider, currentVoiceTier, summary.freeTierMonthUsage)
        : null;

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

                    {/* Voice Selection */}
                    <div style={styles.section}>
                        <div style={styles.sectionLabel}>Voice</div>

                        {/* Provider Segmented Control */}
                        <div style={styles.segmentedControl}>
                            {(['google', 'gemini', 'polly', 'elevenlabs'] as TtsProvider[]).map(provider => (
                                <button
                                    key={provider}
                                    style={{
                                        ...styles.segment,
                                        ...(selectedProvider === provider ? styles.segmentActive : {})
                                    }}
                                    onClick={() => handleProviderClick(provider)}
                                >
                                    {provider === 'google' ? 'Google' : provider === 'gemini' ? 'Gemini' : provider === 'polly' ? 'Polly' : 'ElevenLabs'}
                                </button>
                            ))}
                        </div>

                        {/* Voice List */}
                        <div style={{ marginTop: 16 }}>
                            {voiceGroups.map(group => {
                                const isExpanded = expandedTiers.has(group.config.key);
                                const hasSelected = group.voices.some(v => v.id === localVoice);

                                return (
                                    <div key={group.config.key}>
                                        {/* Tier Header */}
                                        <div
                                            style={styles.tierHeader}
                                            onClick={() => toggleTier(group.config.key)}
                                        >
                                            <span style={styles.tierLabel}>
                                                {group.config.label}
                                                {group.config.isPremium && (
                                                    <span style={styles.tierBadge}>HQ</span>
                                                )}
                                            </span>
                                            <span style={styles.tierMeta}>
                                                {group.config.price} · {group.config.freeLimit}
                                            </span>
                                            <ChevronIcon expanded={isExpanded || hasSelected} />
                                        </div>

                                        {/* Voices */}
                                        {(isExpanded || hasSelected) && (
                                            <div style={{ marginBottom: 8 }}>
                                                {group.voices.map(voice => {
                                                    const isSelected = localVoice === voice.id;
                                                    return (
                                                        <div
                                                            key={voice.id}
                                                            style={{
                                                                ...styles.voiceRow,
                                                                ...(isSelected ? styles.voiceRowSelected : {})
                                                            }}
                                                            onClick={() => {
                                                                setLocalVoice(voice.id);
                                                                onVoiceChange(voice.id);
                                                            }}
                                                        >
                                                            {isSelected ? (
                                                                <div style={styles.checkmark}>
                                                                    <CheckIcon />
                                                                </div>
                                                            ) : (
                                                                <div style={{ width: 34 }} />
                                                            )}
                                                            <span style={styles.voiceName}>{voice.name}</span>
                                                            <span style={styles.voiceGender}>{voice.gender}</span>
                                                            <button
                                                                style={styles.playButton}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onPreviewVoice(voice.id, selectedProvider);
                                                                }}
                                                            >
                                                                <PlayIcon />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Usage */}
                        {usageLoading ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, opacity: 0.5 }}>
                                <CircularProgress size={12} sx={{ color: 'rgba(255,255,255,0.4)' }} />
                                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading usage...</span>
                            </Box>
                        ) : usageInfo && (
                            <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
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
        </Dialog>
    );
};
