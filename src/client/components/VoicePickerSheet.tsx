import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, CircularProgress, Box } from '@mui/material';
import { VOICE_MAPPINGS, type Voice, type TtsProvider, getVoiceTier } from '../../common/tts/ttsUtils';
import { useTtsUsage } from '../hooks/useTtsUsage';
import { getVoiceTypeUsage } from '../../common/tts/ttsUsageCalculator';
import { generateTts } from '../../apis/tts/client';

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
            : ['neural'];

    tierOrder.forEach(tier => {
        groups[tier] = { config: getTierConfig(provider, tier), voices: [] };
    });

    voices.forEach(voice => {
        if (groups[voice.tier]) groups[voice.tier].voices.push(voice);
    });

    return tierOrder.filter(tier => groups[tier]?.voices.length > 0).map(tier => groups[tier]);
};

const getProviderDisplayName = (provider: TtsProvider): string => {
    switch (provider) {
        case 'google': return 'Google';
        case 'polly': return 'Polly';
        case 'elevenlabs': return 'ElevenLabs';
        default: return provider;
    }
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
        padding: '16px 16px 8px',
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.55)',
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
        marginBottom: 8,
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
    playButtonActive: {
        background: 'rgba(10,132,255,0.3)',
        color: '#0a84ff',
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
        display: 'flex',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        padding: '14px',
        fontSize: 17,
        fontWeight: 600,
        background: 'rgba(255,255,255,0.1)',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'opacity 0.15s ease',
    },
    doneButton: {
        flex: 1,
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

// Audio Waveform Animation for playing state
const WaveformIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
        <style>
            {`
                @keyframes wave1 { 0%, 100% { height: 4px; y: 5px; } 50% { height: 10px; y: 2px; } }
                @keyframes wave2 { 0%, 100% { height: 8px; y: 3px; } 50% { height: 4px; y: 5px; } }
                @keyframes wave3 { 0%, 100% { height: 6px; y: 4px; } 50% { height: 12px; y: 1px; } }
            `}
        </style>
        <rect x="2" y="5" width="2" height="4" rx="1" style={{ animation: 'wave1 0.6s ease-in-out infinite' }} />
        <rect x="6" y="3" width="2" height="8" rx="1" style={{ animation: 'wave2 0.6s ease-in-out infinite 0.1s' }} />
        <rect x="10" y="4" width="2" height="6" rx="1" style={{ animation: 'wave3 0.6s ease-in-out infinite 0.2s' }} />
    </svg>
);

export interface VoicePickerSheetProps {
    open: boolean;
    onClose: () => void;
    currentVoice: string;
    currentProvider: TtsProvider;
    onConfirm: (voice: string, provider: TtsProvider) => void;
}

type PreviewState = 'idle' | 'loading' | 'playing';

export const VoicePickerSheet: React.FC<VoicePickerSheetProps> = ({
    open,
    onClose,
    currentVoice,
    currentProvider,
    onConfirm,
}) => {
    // Browsing state (not committed until user confirms)
    const [browsingProvider, setBrowsingProvider] = useState<TtsProvider>(currentProvider);
    const [pendingVoice, setPendingVoice] = useState<string>(currentVoice);
    const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
    
    // Preview state
    const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
    const [previewState, setPreviewState] = useState<PreviewState>('idle');
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    const { summary, loading: usageLoading } = useTtsUsage(open);

    const availableVoices = useMemo(() => VOICE_MAPPINGS[browsingProvider] || [], [browsingProvider]);
    const voiceGroups = useMemo(() => groupVoicesByTier(availableVoices, browsingProvider), [availableVoices, browsingProvider]);

    // Reset browsing state when modal opens
    useEffect(() => {
        if (open) {
            setBrowsingProvider(currentProvider);
            setPendingVoice(currentVoice);
            setExpandedTiers(new Set());
            setPreviewingVoiceId(null);
            setPreviewState('idle');
        }
    }, [open, currentProvider, currentVoice]);

    // Auto-expand tier containing selected voice
    useEffect(() => {
        const voice = availableVoices.find(v => v.id === pendingVoice);
        if (voice) {
            setExpandedTiers(prev => new Set([...prev, voice.tier]));
        }
    }, [pendingVoice, availableVoices]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }
        };
    }, []);

    const handleProviderClick = (provider: TtsProvider) => {
        // Just browse - don't select any voice automatically
        setBrowsingProvider(provider);
        setExpandedTiers(new Set());
        
        // Stop any playing preview
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }
        setPreviewingVoiceId(null);
        setPreviewState('idle');
    };

    const toggleTier = (tierKey: string) => {
        setExpandedTiers(prev => {
            const next = new Set(prev);
            if (next.has(tierKey)) next.delete(tierKey);
            else next.add(tierKey);
            return next;
        });
    };

    const handleVoiceSelect = (voiceId: string) => {
        setPendingVoice(voiceId);
    };

    const handlePreviewVoice = useCallback(async (voiceId: string) => {
        // If clicking the same voice that's playing, stop it
        if (previewingVoiceId === voiceId && previewState === 'playing') {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }
            setPreviewingVoiceId(null);
            setPreviewState('idle');
            return;
        }

        // Stop any current preview
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }

        setPreviewingVoiceId(voiceId);
        setPreviewState('loading');

        try {
            const previewText = "Hello! This is a preview of the selected voice.";
            const result = await generateTts({
                text: previewText,
                voiceId: voiceId,
                provider: browsingProvider
            });

            if (result.data?.success && result.data.audioContent) {
                const audio = new Audio(`data:audio/mp3;base64,${result.data.audioContent}`);
                previewAudioRef.current = audio;

                audio.addEventListener('play', () => {
                    setPreviewState('playing');
                });

                audio.addEventListener('ended', () => {
                    setPreviewingVoiceId(null);
                    setPreviewState('idle');
                    previewAudioRef.current = null;
                });

                audio.addEventListener('error', () => {
                    setPreviewingVoiceId(null);
                    setPreviewState('idle');
                    previewAudioRef.current = null;
                });

                await audio.play();
            } else {
                setPreviewingVoiceId(null);
                setPreviewState('idle');
            }
        } catch (error) {
            console.error('Error generating voice preview:', error);
            setPreviewingVoiceId(null);
            setPreviewState('idle');
        }
    }, [previewingVoiceId, previewState, browsingProvider]);

    const handleConfirm = () => {
        // Stop any preview
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }
        
        // Only confirm if user has selected a voice for the current browsing provider
        // Check if pendingVoice exists in the current provider
        const voiceExistsInProvider = availableVoices.some(v => v.id === pendingVoice);
        
        if (voiceExistsInProvider) {
            onConfirm(pendingVoice, browsingProvider);
        } else {
            // If no valid selection for this provider, just close without changes
            onClose();
        }
    };

    const handleCancel = () => {
        // Stop any preview
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }
        onClose();
    };

    const pendingVoiceTier = getVoiceTier(browsingProvider, pendingVoice);
    const usageInfo = summary?.freeTierMonthUsage
        ? getVoiceTypeUsage(browsingProvider, pendingVoiceTier, summary.freeTierMonthUsage)
        : null;

    // Check if there's a valid selection
    const hasValidSelection = availableVoices.some(v => v.id === pendingVoice);

    const renderPreviewButton = (voiceId: string) => {
        const isThisVoicePreviewing = previewingVoiceId === voiceId;
        const isLoading = isThisVoicePreviewing && previewState === 'loading';
        const isPlaying = isThisVoicePreviewing && previewState === 'playing';

        return (
            <button
                style={{
                    ...styles.playButton,
                    ...(isPlaying ? styles.playButtonActive : {})
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    void handlePreviewVoice(voiceId);
                }}
                disabled={isLoading}
            >
                {isLoading ? (
                    <CircularProgress size={14} sx={{ color: 'rgba(255,255,255,0.6)' }} />
                ) : isPlaying ? (
                    <WaveformIcon />
                ) : (
                    <PlayIcon />
                )}
            </button>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={handleCancel}
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
                    <h2 style={styles.title}>Choose Voice</h2>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {/* Provider Segmented Control */}
                    <div style={styles.section}>
                        <div style={styles.sectionLabel}>Provider</div>
                        <div style={styles.segmentedControl}>
                            {(['google', 'polly', 'elevenlabs'] as TtsProvider[]).map(provider => (
                                <button
                                    key={provider}
                                    style={{
                                        ...styles.segment,
                                        ...(browsingProvider === provider ? styles.segmentActive : {})
                                    }}
                                    onClick={() => handleProviderClick(provider)}
                                >
                                    {getProviderDisplayName(provider)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Voice List */}
                    <div style={styles.section}>
                        <div style={styles.sectionLabel}>Voices</div>
                        <div>
                            {voiceGroups.map(group => {
                                const isExpanded = expandedTiers.has(group.config.key);
                                const hasSelected = group.voices.some(v => v.id === pendingVoice);

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
                                                    const isSelected = pendingVoice === voice.id;
                                                    return (
                                                        <div
                                                            key={voice.id}
                                                            style={{
                                                                ...styles.voiceRow,
                                                                ...(isSelected ? styles.voiceRowSelected : {})
                                                            }}
                                                            onClick={() => handleVoiceSelect(voice.id)}
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
                                                            {renderPreviewButton(voice.id)}
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
                        {hasValidSelection && (
                            usageLoading ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, opacity: 0.5 }}>
                                    <CircularProgress size={12} sx={{ color: 'rgba(255,255,255,0.4)' }} />
                                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading usage...</span>
                                </Box>
                            ) : usageInfo && (
                                <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Free tier ({pendingVoiceTier})</span>
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
                            )
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <button
                        style={styles.cancelButton}
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                    <button
                        style={{
                            ...styles.doneButton,
                            opacity: hasValidSelection ? 1 : 0.5,
                            cursor: hasValidSelection ? 'pointer' : 'not-allowed',
                        }}
                        onClick={handleConfirm}
                        disabled={!hasValidSelection}
                    >
                        Done
                    </button>
                </div>
            </div>
        </Dialog>
    );
};

