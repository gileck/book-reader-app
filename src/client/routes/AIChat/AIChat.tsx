import React, { useState, useRef, useEffect } from 'react';
import {
  TextField,
  Typography,
  Paper,
  Container,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  IconButton,
  Chip
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { AIModelDefinition, getAllModels } from '@/server/ai/models';
import { sendChatMessage } from '@/apis/chat/client';
import { useSettings } from '@/client/settings/SettingsContext';

// Message type definition
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  cost?: number;
  timestamp: Date;
  isFromCache?: boolean;
  cacheProvider?: 'fs' | 's3' | 'localStorage';
}

export function AIChat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<AIModelDefinition[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { settings, updateSettings } = useSettings();

  // Load models on component mount
  useEffect(() => {
    const availableModels = getAllModels();
    setModels(availableModels);
  }, []);

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleModelChange = (event: SelectChangeEvent) => {
    updateSettings({ aiModel: event.target.value });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !settings.aiModel) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
      isFromCache: false
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call the API
      const { data, isFromCache, metadata } = await sendChatMessage({
        modelId: settings.aiModel,
        text: input
      });
      const { cost, result } = data

      // Add AI message
      const aiMessage: Message = {
        id: Date.now().toString(),
        text: result,
        sender: 'ai',
        cost: cost.totalCost,
        timestamp: new Date(),
        isFromCache,
        cacheProvider: metadata?.provider
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        sender: 'ai',
        timestamp: new Date(),
        isFromCache: false
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Format cost to display in a readable format
  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  return (
    <Container maxWidth="md" sx={{ py: 4, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        AI Chat
      </Typography>

      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="model-select-label">AI Model</InputLabel>
        <Select
          labelId="model-select-label"
          id="model-select"
          value={settings.aiModel}
          label="AI Model"
          onChange={handleModelChange}
        >
          {models.map((model) => (
            <MenuItem key={model.id} value={model.id}>
              {model.name} ({model.provider})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Paper
        elevation={3}
        sx={{
          p: 2,
          mb: 2,
          flexGrow: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {messages.length === 0 ? (
          <Typography
            variant="body1"
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              color: 'text.secondary'
            }}
          >
            Start a conversation with the AI
          </Typography>
        ) : (
          <>
            {messages.map((message) => (
              <Paper
                key={message.id}
                elevation={1}
                sx={{
                  p: 2,
                  mb: 2,
                  maxWidth: '80%',
                  alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: message.sender === 'user' ? 'primary.light' : 'background.paper',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {message.text}
                </Typography>

                {message.cost !== undefined && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                    {message.isFromCache ? (
                      <span>
                        <Chip
                          size="small"
                          label={`From cache (${message.cacheProvider || 'unknown'})`}
                          color={message.cacheProvider === 's3' ? 'primary' : message.cacheProvider === 'localStorage' ? 'secondary' : 'default'}
                          variant="outlined"
                          sx={{ mr: 1 }}
                        />
                      </span>
                    ) : (
                      `Cost: ${formatCost(message.cost)}`
                    )}
                  </Typography>
                )}
              </Paper>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </Paper>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type your message..."
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <IconButton
          color="primary"
          type="submit"
          disabled={isLoading || !input.trim()}
          sx={{ p: '10px' }}
        >
          {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
        </IconButton>
      </form>
    </Container>
  );
}
