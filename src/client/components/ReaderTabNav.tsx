import React, { useState } from 'react';
import { Box } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

export type ReaderTab = 'full' | 'focus' | 'qa' | 'search' | 'overview';

interface ReaderTabNavProps {
    activeTab: ReaderTab;
    onTabChange: (tab: ReaderTab) => void;
}

const tabs: { id: ReaderTab; label: string }[] = [
    { id: 'full', label: 'Full' },
    { id: 'focus', label: 'Focus' },
    { id: 'qa', label: 'QA Chat' },
    { id: 'search', label: 'Search' },
    { id: 'overview', label: 'Overview' },
];

/**
 * ReaderTabNav - Apple Books-inspired floating pill navigation
 * 
 * A modern, iOS-style segmented control for switching between reader modes.
 * Features collapsible Dynamic Island style, translucent backdrop blur, and smooth animations.
 */
export const ReaderTabNav: React.FC<ReaderTabNavProps> = ({ activeTab, onTabChange }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    
    const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Full';

    const handleToggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <Box
            sx={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                py: 0.75,
                px: 2,
                display: 'flex',
                justifyContent: 'center',
                // Transparent container - content scrolls underneath
                backgroundColor: 'transparent',
                pointerEvents: 'none',
                '& > *': {
                    pointerEvents: 'auto',
                },
            }}
        >
            {/* Floating pill container - iOS Dynamic Island style */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isCollapsed ? '0px' : '3px',
                    p: '3px',
                    // Translucent dark pill with blur
                    backdropFilter: 'saturate(180%) blur(20px)',
                    WebkitBackdropFilter: 'saturate(180%) blur(20px)',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    borderRadius: '20px',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
                    border: '0.5px solid rgba(255, 255, 255, 0.1)',
                    maxWidth: '100%',
                    overflowX: 'auto',
                    // Smooth transition for collapse/expand
                    transition: 'all 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                    // Hide scrollbar
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    '&::-webkit-scrollbar': {
                        display: 'none',
                    },
                }}
            >
                {isCollapsed ? (
                    // Collapsed state - just show active tab and expand button
                    <Box
                        component="button"
                        onClick={handleToggleCollapse}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1.5,
                            py: 0.75,
                            border: 'none',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            color: '#ffffff',
                            fontFamily: 'var(--reader-font-sans)',
                            fontSize: '13px',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            transition: 'all 180ms ease',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                            },
                            '&:active': {
                                transform: 'scale(0.97)',
                            },
                        }}
                    >
                        {activeTabLabel}
                        <ExpandMore sx={{ fontSize: 18, opacity: 0.7 }} />
                    </Box>
                ) : (
                    // Expanded state - show all tabs
                    <>
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <Box
                                    key={tab.id}
                                    component="button"
                                    onClick={() => onTabChange(tab.id)}
                                    sx={{
                                        px: { xs: 1.5, sm: 2 },
                                        py: 0.75,
                                        border: 'none',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                                        fontFamily: 'var(--reader-font-sans)',
                                        fontSize: { xs: '13px', sm: '14px' },
                                        fontWeight: isActive ? 600 : 500,
                                        letterSpacing: '-0.01em',
                                        backgroundColor: isActive 
                                            ? 'rgba(255, 255, 255, 0.2)' 
                                            : 'transparent',
                                        color: isActive 
                                            ? '#ffffff' 
                                            : 'rgba(255, 255, 255, 0.6)',
                                        boxShadow: 'none',
                                        '&:hover': {
                                            backgroundColor: isActive 
                                                ? 'rgba(255, 255, 255, 0.25)' 
                                                : 'rgba(255, 255, 255, 0.1)',
                                            color: '#ffffff',
                                        },
                                        '&:active': {
                                            transform: 'scale(0.97)',
                                        },
                                        '&:focus-visible': {
                                            outline: '2px solid rgba(255, 255, 255, 0.5)',
                                            outlineOffset: '2px',
                                        },
                                    }}
                                >
                                    {tab.label}
                                </Box>
                            );
                        })}
                        {/* Collapse button */}
                        <Box
                            component="button"
                            onClick={handleToggleCollapse}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 0.5,
                                ml: 0.5,
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                backgroundColor: 'transparent',
                                color: 'rgba(255, 255, 255, 0.5)',
                                transition: 'all 180ms ease',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    color: '#ffffff',
                                },
                                '&:active': {
                                    transform: 'scale(0.9)',
                                },
                            }}
                            title="Collapse tabs"
                        >
                            <ExpandLess sx={{ fontSize: 18 }} />
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
};

