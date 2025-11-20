import { useState, useEffect, useCallback } from 'react';

const HISTORY_KEY = 'reader_search_history';
const MAX_HISTORY_ITEMS = 10;

export function useSearchHistory() {
    const [history, setHistory] = useState<string[]>([]);

    // Load history from local storage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(HISTORY_KEY);
            if (stored) {
                setHistory(JSON.parse(stored));
            }
        } catch (err) {
            console.error('Failed to load search history:', err);
        }
    }, []);

    const addToHistory = useCallback((query: string) => {
        if (!query.trim()) return;
        
        setHistory(prev => {
            const filtered = prev.filter(item => item.toLowerCase() !== query.toLowerCase());
            const newHistory = [query.trim(), ...filtered].slice(0, MAX_HISTORY_ITEMS);
            
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            } catch (err) {
                console.error('Failed to save search history:', err);
            }
            
            return newHistory;
        });
    }, []);

    const removeFromHistory = useCallback((query: string) => {
        setHistory(prev => {
            const newHistory = prev.filter(item => item !== query);
            
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            } catch (err) {
                console.error('Failed to update search history:', err);
            }
            
            return newHistory;
        });
    }, []);

    const clearHistory = useCallback(() => {
        setHistory([]);
        try {
            localStorage.removeItem(HISTORY_KEY);
        } catch (err) {
            console.error('Failed to clear search history:', err);
        }
    }, []);

    return {
        history,
        addToHistory,
        removeFromHistory,
        clearHistory
    };
}

