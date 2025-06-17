import { ChatMessage } from '../../../../../apis/bookContentChat/types';
import { AnswerLength, AnswerLevel, AnswerStyle } from '../../../../../apis/bookContentChat/types';

export interface BookQAPanelProps {
    open: boolean;
    fullScreen: boolean;
    loading: boolean;
    messages: ChatMessage[];
    onClose: () => void;
    onToggleFullScreen: () => void;
    onSubmitQuestion: (question: string) => void;
    onClearHistory: () => void;
    onOpenSettings: () => void;
    currentBookTitle: string;
    currentChapterTitle: string;
    currentChapterNumber: number;
    currentSentence: string;
    contextLines: number;
    onContextLinesChange: (lines: number) => void;
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    onSetReplyContext: (messageIndex: number, messageContent: string) => void;
    getLastSentences: () => string;
    answerLength: AnswerLength;
    answerLevel: AnswerLevel;
    answerStyle: AnswerStyle;
}

export interface ChatContentProps {
    messages: ChatMessage[];
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    currentChapterNumber: number;
    currentChapterTitle: string;
    fullScreen: boolean;
    currentSentence: string;
    loading: boolean;
    onTextSelection: (selectedText: string) => void;
    onReply: (messageIndex: number, messageContent: string) => void;
}

export interface ChatInputProps {
    question: string;
    loading: boolean;
    onQuestionChange: (question: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
    fullScreen: boolean;
    contextLines: number;
    onContextLinesChange: (lines: number) => void;
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    currentBookTitle: string;
    currentChapterTitle: string;
    currentChapterNumber: number;
    currentSentence: string;
    messages: ChatMessage[];
    getLastSentences: () => string;
    answerLength: AnswerLength;
    answerLevel: AnswerLevel;
    answerStyle: AnswerStyle;
}

export interface MessageBubbleProps {
    message: ChatMessage;
    index: number;
    fullScreen: boolean;
    onTextSelection: (selectedText: string) => void;
    onReply: (messageIndex: number, messageContent: string) => void;
}

export interface PanelHeaderProps {
    onClose: () => void;
    onToggleFullScreen: () => void;
    onClearHistory: () => void;
    onOpenSettings: () => void;
    fullScreen: boolean;
} 