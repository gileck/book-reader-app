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
    const muiTheme = createTheme({
        palette: {
            mode: theme,
            primary: {
                main: '#1976d2',
            },
            secondary: {
                main: '#dc004e',
            },
            ...(theme === 'dark' && {
                background: {
                    default: '#121212',
                    paper: '#1e1e1e',
                },
                text: {
                    primary: '#ffffff',
                    secondary: '#b0b0b0',
                },
            })
        },
        typography: {
            fontSize: 14 * fontSize,
            fontFamily: fontFamily,
            body1: {
                lineHeight: lineHeight,
            },
            body2: {
                lineHeight: lineHeight,
            }
        },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: {
                        ...(theme === 'dark' && {
                            backgroundColor: '#1e1e1e',
                            color: '#ffffff',
                        })
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