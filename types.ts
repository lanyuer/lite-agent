
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  // Persist attachment data for context reconstruction
  attachment?: {
    mimeType: string;
    data: string;
  };
}

export interface Session {
  id: string;
  title: string;
  lastActive: number;
  messages: Message[];
}

export interface SuggestionCard {
  id: string;
  title: string;
  subtitle?: string;
  tag?: string;
  tagColor?: string;
}
