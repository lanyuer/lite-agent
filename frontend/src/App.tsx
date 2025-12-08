import { useState, useRef, useEffect } from 'react'
import { Send, StopCircle, Paperclip, Mic, ArrowUp, Plus } from 'lucide-react'
import { MessageItem } from './components/MessageItem'
import { Sidebar } from './components/Sidebar'
import './App.css'

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: any;
  type?: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      // Add a placeholder assistant message that we will update
      setMessages(prev => [...prev, { role: 'assistant', content: [] }]);

      // Use a Map to track messages by their unique identifiers to avoid duplicates
      const messageMap = new Map<string, any>();
      let messageCounter = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              // If it's an error
              if (data.error) {
                console.error("Error from server:", data.error);
                continue;
              }

              // Create a unique key for this message
              // Use type + counter for now, or use session_id if available
              const msgKey = data.session_id || data.uuid || `msg-${messageCounter++}`;

              // Check if we've seen this exact message before
              if (!messageMap.has(msgKey)) {
                messageMap.set(msgKey, data);
              } else {
                // Update existing message if it's the same type
                const existing = messageMap.get(msgKey);
                // For streaming content, we might want to merge or replace
                // For now, we'll skip duplicates
                if (JSON.stringify(existing) === JSON.stringify(data)) {
                  continue; // Skip exact duplicates
                }
              }

              // Convert map to array
              const uniqueMessages = Array.from(messageMap.values());

              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === 'assistant') {
                  lastMsg.content = uniqueMessages;
                }
                return newMessages;
              });

            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted');
      } else {
        console.error('Error sending message:', error);
        setMessages(prev => [...prev, { role: 'system', content: `Error: ${error.message}` }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="app-layout">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

      <main className="main-content">
        {messages.length === 0 ? (
          <div className="hero-container">
            <div className="hero-content">
              <h1 className="hero-title">What can I do for you?</h1>

              <div className="hero-input-container">
                <div className="hero-input-wrapper">
                  <textarea
                    ref={textareaRef}
                    className="hero-input"
                    placeholder="Assign a task or ask any question..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />
                  <div className="hero-input-actions">
                    <div className="left-actions">
                      <button className="action-btn"><Plus size={20} /></button>
                      <button className="action-btn"><Paperclip size={20} /></button>
                    </div>
                    <div className="right-actions">
                      <button className="action-btn"><Mic size={20} /></button>
                      <button
                        className={`send-btn ${input.trim() ? 'active' : ''}`}
                        onClick={handleSendMessage}
                        disabled={!input.trim()}
                      >
                        <ArrowUp size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="quick-actions">
                <button className="quick-action-pill">
                  <span>🍌 Create Slides</span>
                </button>
                <button className="quick-action-pill">
                  <span>🌐 Create Website</span>
                </button>
                <button className="quick-action-pill">
                  <span>🔍 Wide Research</span>
                </button>
                <button className="quick-action-pill">
                  <span>More New</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <div className="header-title">Lite Agent 1.0</div>
            </header>
            <div className="chat-messages">
              {messages.map((msg, index) => (
                <MessageItem key={index} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-container">
              <div className="input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  placeholder="Type a message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isLoading}
                />
                {isLoading ? (
                  <button
                    className="send-button active"
                    onClick={handleStop}
                    title="Stop generation"
                  >
                    <StopCircle size={20} />
                  </button>
                ) : (
                  <button
                    className={`send-button ${input.trim() ? 'active' : ''}`}
                    onClick={handleSendMessage}
                    disabled={!input.trim()}
                    title="Send message"
                  >
                    <Send size={20} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App
