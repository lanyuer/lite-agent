
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { WelcomeHero } from './components/WelcomeHero';
import { ChatList } from './components/ChatList';
import { FloatingInput } from './components/FloatingInput';
import { ArtifactPanel } from './components/ArtifactPanel';
import { Login } from './components/Login';
import { Session, Message } from './types';
import { generateId } from './services/mockService'; 
import { streamGeminiChat } from './services/genai'; 
import { PanelLeft, Layout, LogOut } from 'lucide-react';

const Toast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-[#2D2D2D] text-white px-4 py-2 rounded-lg shadow-xl text-xs font-medium z-50 animate-fade-in transition-all border border-white/10">
      {message}
    </div>
  );
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isTyping, setIsTyping] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [showArtifact, setShowArtifact] = useState(false);
  const [artifactContent, setArtifactContent] = useState('');

  // New: Model Selection State
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-image');

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile && !sidebarOpen) setSidebarOpen(true);
      if (mobile && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const createNewSession = () => {
    const newSession: Session = {
      id: generateId(),
      title: 'New Creative Project',
      lastActive: Date.now(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setShowArtifact(false);
    if (isMobile) setSidebarOpen(false);
    return newSession.id;
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setSessions([]);
    setCurrentSessionId(null);
    setShowArtifact(false);
    showToast('Logged out successfully');
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const handleSendMessage = async (text: string, attachment?: { mimeType: string; data: string }) => {
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = createNewSession();
    }

    const newUserMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text, // Don't append [Attached Image] text, we render it via attachment prop now
      timestamp: Date.now(),
      attachment: attachment // Persist the attachment!
    };

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const title = s.messages.length === 0 
          ? text.slice(0, 30) + (text.length > 30 ? '...' : '') 
          : s.title;
        return {
          ...s,
          title,
          lastActive: Date.now(),
          messages: [...s.messages, newUserMessage]
        };
      }
      return s;
    }));

    setIsTyping(true);

    const botMessageId = generateId();
    let accumulatedResponse = "";
    let hasOpenedArtifact = false;

    setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
            return {
                ...s,
                messages: [...s.messages, {
                    id: botMessageId,
                    role: 'assistant',
                    content: '', 
                    timestamp: Date.now(),
                    isStreaming: true
                }]
            };
        }
        return s;
    }));

    try {
      const sessionHistory = sessions.find(s => s.id === activeSessionId)?.messages || [];
      // Note: We need to include the NEW user message in history for the service call context
      // or the service needs to handle it. streamGeminiChat takes history AND newMessage.
      // Ideally, pass the updated history (including current user message) to the service 
      // if the service is stateless, but here we pass history + newMsg.
      
      const stream = streamGeminiChat(sessionHistory, text, selectedModel, attachment);

      for await (const chunk of stream) {
        accumulatedResponse += chunk;

        if (accumulatedResponse.includes('```') && !hasOpenedArtifact && !showArtifact) {
           setShowArtifact(true);
           hasOpenedArtifact = true;
        }
        
        if (showArtifact) {
           setArtifactContent(accumulatedResponse);
        }

        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            const messages = [...s.messages];
            const msgIndex = messages.findIndex(m => m.id === botMessageId);
            if (msgIndex !== -1) {
              messages[msgIndex] = {
                ...messages[msgIndex],
                content: accumulatedResponse,
                isStreaming: true
              };
            }
            return { ...s, messages };
          }
          return s;
        }));
      }

    } catch (error) {
      console.error("Gemini API Error:", error);
      showToast("Error generating content. Please try again.");
      accumulatedResponse += "\n\n[System Error: Unable to complete request]";
    } finally {
      setIsTyping(false);
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
           const messages = [...s.messages];
           const idx = messages.findIndex(m => m.id === botMessageId);
           if (idx !== -1) {
              messages[idx] = { 
                  ...messages[idx], 
                  content: accumulatedResponse,
                  isStreaming: false 
              };
           }
           return { ...s, messages };
        }
        return s;
      }));
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <Login onLogin={() => setIsAuthenticated(true)} />
        <Toast message={toastMessage} />
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-warm-bg text-text-main font-sans bg-dot-pattern bg-[length:24px_24px] bg-fixed">
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={(id) => {
          setCurrentSessionId(id);
          setShowArtifact(false);
          if (isMobile) setSidebarOpen(false);
        }}
        onNewSession={createNewSession}
        isOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        isMobile={isMobile}
        onMockAction={showToast}
      />

      <div className="fixed bottom-4 left-4 z-50 hidden md:block opacity-0 hover:opacity-100 transition-opacity">
        <button onClick={handleLogout} className="p-2 bg-white rounded-full shadow border border-gray-200 text-gray-500 hover:text-red-500" title="Logout">
          <LogOut size={16} />
        </button>
      </div>

      <div className="flex-1 flex min-w-0 transition-all duration-300 relative">
        <div className={`
          flex flex-col h-full relative transition-all duration-300 w-full
          ${showArtifact && !isMobile ? 'md:w-1/2 border-r border-border-sub' : ''}
        `}>
          <div className="absolute top-4 left-4 z-20 flex gap-2">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-[#EAEAE7] rounded-md text-text-sub transition-colors shadow-sm active:scale-95 bg-white/50 backdrop-blur-sm"
              >
                <PanelLeft size={20} />
              </button>
            )}
          </div>

          {currentSession && !showArtifact && currentSession.messages.length > 0 && (
             <div className="absolute top-4 right-4 z-20">
                <button 
                  onClick={() => {
                     const lastBotMsg = [...currentSession.messages].reverse().find(m => m.role === 'assistant' && m.content.includes('```'));
                     if (lastBotMsg) {
                        setArtifactContent(lastBotMsg.content);
                        setShowArtifact(true);
                     } else {
                        showToast("No code to preview");
                     }
                  }}
                  className="p-2 bg-white/80 hover:bg-gray-50 backdrop-blur-sm border border-gray-200 rounded-md text-text-sub transition-colors shadow-sm active:scale-95"
                  title="Open Preview"
                >
                  <Layout size={20} />
                </button>
             </div>
          )}

          {currentSession && currentSession.messages.length > 0 ? (
            <>
              <div className="h-14 border-b border-transparent flex items-center justify-center px-6 z-10 shrink-0"></div>
              <ChatList 
                messages={currentSession.messages} 
                isThinking={isTyping} 
                onOpenArtifact={(content) => {
                   setArtifactContent(content);
                   setShowArtifact(true);
                }}
              />
              <FloatingInput 
                onSend={handleSendMessage} 
                disabled={isTyping} 
                onMockAction={showToast}
              />
            </>
          ) : (
            <WelcomeHero 
              onSend={handleSendMessage} 
              onMockAction={showToast} 
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
            />
          )}
        </div>

        {showArtifact && (
           <div className={`
             bg-white z-30 transition-all duration-300 shadow-xl border-l border-border-sub
             ${isMobile ? 'fixed inset-0 w-full h-full' : 'w-1/2 h-full'}
           `}>
              <ArtifactPanel 
                content={artifactContent} 
                onClose={() => setShowArtifact(false)} 
                onMockAction={showToast}
                isMobile={isMobile}
              />
           </div>
        )}
      </div>

      <Toast message={toastMessage} />
    </div>
  );
};

export default App;
