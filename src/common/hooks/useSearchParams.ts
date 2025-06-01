import { useMemo } from 'react';

export const useSearchParams = () => {
    return useMemo(() => {
        if (typeof window === 'undefined') {
            return {};
        }

        const params = new URLSearchParams(window.location.search);
        const result: Record<string, string> = {};

        for (const [key, value] of params.entries()) {
            result[key] = value;
        }

        return result;
    }, []);
}; 