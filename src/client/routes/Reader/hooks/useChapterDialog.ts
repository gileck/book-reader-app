import { useState, useCallback } from 'react';

interface ChapterDialogState {
    isOpen: boolean;
}

const getDefaultChapterDialogState = (): ChapterDialogState => ({
    isOpen: false
});

export const useChapterDialog = () => {
    const [state, setState] = useState(getDefaultChapterDialogState());

    const updateState = useCallback((partialState: Partial<ChapterDialogState>) => {
        setState(prev => ({ ...prev, ...partialState }));
    }, []);

    const openDialog = useCallback(() => {
        updateState({ isOpen: true });
    }, [updateState]);

    const closeDialog = useCallback(() => {
        updateState({ isOpen: false });
    }, [updateState]);

    return {
        isOpen: state.isOpen,
        openDialog,
        closeDialog
    };
};