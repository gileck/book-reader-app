import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Select, MenuItem, CircularProgress, FormControl, InputLabel } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import CloseIcon from '@mui/icons-material/Close';

interface TranslationPopupProps {
  position: { x: number; y: number };
  onTranslate: (targetLanguage: string, sentenceCount: number) => void;
  onClose: () => void;
  isLoading?: boolean;
  defaultLanguage?: string;
}

// Common languages for translation
const COMMON_LANGUAGES = [
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
];

export const TranslationPopup: React.FC<TranslationPopupProps> = ({
  position,
  onTranslate,
  onClose,
  isLoading = false,
  defaultLanguage = 'es',
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState(defaultLanguage);
  const [sentenceCount, setSentenceCount] = useState(1);
  const [selectOpen, setSelectOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Update selected language when defaultLanguage changes
  useEffect(() => {
    setSelectedLanguage(defaultLanguage);
  }, [defaultLanguage]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if the Select dropdown is open
      if (selectOpen) {
        return;
      }
      
      const target = event.target as Node;
      
      // Check if click is inside the popup
      if (popupRef.current && popupRef.current.contains(target)) {
        return;
      }
      
      // Click is outside - close the popup
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, selectOpen]);

  const handleTranslate = () => {
    onTranslate(selectedLanguage, sentenceCount);
  };

  return (
    <Box
      ref={popupRef}
      sx={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: 3,
        zIndex: 1000,
        minWidth: '250px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
          <TranslateIcon fontSize="small" color="primary" />
          <span style={{ fontWeight: 500, fontSize: '14px' }}>Translate</span>
        </Box>
        <Button
          size="small"
          onClick={onClose}
          sx={{ minWidth: 'auto', padding: '4px', color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </Button>
      </Box>

      {/* Language Selector */}
      <FormControl size="small" fullWidth>
        <InputLabel id="translation-language-label">Language</InputLabel>
        <Select
          labelId="translation-language-label"
          value={selectedLanguage}
          label="Language"
          onChange={(e) => setSelectedLanguage(e.target.value)}
          disabled={isLoading}
          onOpen={() => setSelectOpen(true)}
          onClose={() => setSelectOpen(false)}
        >
          {COMMON_LANGUAGES.map((lang) => (
            <MenuItem key={lang.code} value={lang.code}>
              {lang.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Sentence Count Selector */}
      <FormControl size="small" fullWidth>
        <InputLabel id="sentence-count-label">Sentences</InputLabel>
        <Select
          labelId="sentence-count-label"
          value={sentenceCount}
          label="Sentences"
          onChange={(e) => setSentenceCount(e.target.value as number)}
          disabled={isLoading}
          onOpen={() => setSelectOpen(true)}
          onClose={() => setSelectOpen(false)}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
            <MenuItem key={count} value={count}>
              {count === 1 ? '1 sentence' : `${count} sentences`}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Translate Button */}
      <Button
        variant="contained"
        color="primary"
        onClick={handleTranslate}
        disabled={isLoading}
        startIcon={isLoading ? <CircularProgress size={16} /> : <TranslateIcon />}
        fullWidth
      >
        {isLoading ? 'Translating...' : 'Translate'}
      </Button>
    </Box>
  );
};

