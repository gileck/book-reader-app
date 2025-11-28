import React, { ReactNode, createContext, useContext } from 'react';
import { ThemeProvider, createTheme } from '@mui/material';

interface UserThemeContextType {
    theme: 'light' | 'dark';
    highlightColor: string;
    sentenceHighlightColor: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColor: string;
}

const UserThemeContext = createContext<UserThemeContextType>({
    theme: 'light',
    highlightColor: '#ffeb3b',
    sentenceHighlightColor: '#e3f2fd',
    fontSize: 1.0,
    lineHeight: 1.5,
    fontFamily: 'Inter, system-ui, sans-serif',
    textColor: '#000000'
});

export const useUserTheme = () => useContext(UserThemeContext);

interface UserThemeProviderProps {
    children: ReactNode;
    theme: 'light' | 'dark';
    highlightColor: string;
    sentenceHighlightColor: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    textColor: string;
}

export const UserThemeProvider: React.FC<UserThemeProviderProps> = ({
    children,
    theme,
    highlightColor,
    sentenceHighlightColor,
    fontSize,
    lineHeight,
    fontFamily,
    textColor
}) => {
    // Apple Books-inspired warm color palette
    const warmPalette = {
        light: {
            background: {
                default: '#fbf8f3',
                paper: '#ffffff',
            },
            text: {
                primary: '#2c2c2c',
                secondary: '#6b6b6b',
            },
        },
        dark: {
            background: {
                default: '#1c1a18',
                paper: '#2a2826',
            },
            text: {
                primary: '#e8e4df',
                secondary: '#a8a4a0',
            },
        },
    };

    const currentPalette = warmPalette[theme];

    const muiTheme = createTheme({
        palette: {
            mode: theme,
            primary: {
                main: theme === 'dark' ? '#E8B77D' : '#D4A574',
            },
            secondary: {
                main: theme === 'dark' ? '#30d158' : '#34C759',
            },
            background: currentPalette.background,
            text: currentPalette.text,
        },
        typography: {
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
        },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundColor: currentPalette.background.paper,
                        color: currentPalette.text.primary,
                    }
                }
            }
        }
    });

    const userThemeValue: UserThemeContextType = {
        theme,
        highlightColor,
        sentenceHighlightColor,
        fontSize,
        lineHeight,
        fontFamily,
        textColor
    };

    return (
        <UserThemeContext.Provider value={userThemeValue}>
            <ThemeProvider theme={muiTheme}>
                {children}
            </ThemeProvider>
        </UserThemeContext.Provider>
    );
}; 