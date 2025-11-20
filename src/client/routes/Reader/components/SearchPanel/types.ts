import type { SearchResultItem } from '@/apis/search/types';
import type { ChapterClient } from '@/apis/chapters/types';

export interface SearchPanelProps {
    bookId: string;
    currentChapter: ChapterClient | null;
    query: string;
    searchScope: 'current' | 'all';
    onQueryChange: (query: string) => void;
    onSearchScopeChange: (scope: 'current' | 'all') => void;
    onNavigateToChunk: (chapterNumber: number, chunkIndex: number) => void;
    onBookmark: (chapterNumber: number, chunkIndex: number, text: string) => void;
}

export interface GroupedResults {
    chapterNumber: number;
    chapterTitle: string;
    results: SearchResultItem[];
}

export interface ResultPopupProps {
    open: boolean;
    result: SearchResultItem | null;
    onClose: () => void;
    onNavigate: () => void;
    onBookmark: () => void;
}
