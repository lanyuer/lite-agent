import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, Paperclip, Mic, ArrowUp, Plus } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { EventMessage } from './components/EventMessage';
import { useAgentEvents } from './hooks/useAgentEvents';
import './App.css';

function AppWithEvents() {
    const [input, setInput] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { state, sendMessage, stopGeneration } = useAgentEvents({
        onError: (error) => {
            console.error('Agent error:', error);
            alert(`Error: ${error}`);
        },
        onComplete: () => {
            console.log('Agent completed');
        },
    });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [state.messages, state.thinking, state.toolCalls]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleSendMessage = async () => {
        console.log('[AppWithEvents] handleSendMessage called, isRunning:', state.isRunning, 'input:', input.trim());
        if (!input.trim() || state.isRunning) {
            console.log('[AppWithEvents] Blocked: input empty or isRunning');
            return;
        }

        const message = input;
        setInput('');
        await sendMessage(message);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const hasMessages = state.messages.length > 0 || state.thinking.length > 0 || state.toolCalls.length > 0;

    return (
        <div className="app-layout">
            <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

            <main className="main-content">
                {!hasMessages ? (
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
                            {/* Create unified timeline of all events */}
                            {(() => {
                                // Combine all events with their types and sequence
                                const timeline: Array<{
                                    id: string;
                                    type: 'message' | 'thinking' | 'toolCall';
                                    data: any;
                                    sequence: number;
                                }> = [];

                                // Add messages
                                state.messages.forEach(msg => {
                                    timeline.push({
                                        id: msg.id,
                                        type: 'message',
                                        data: msg,
                                        sequence: msg.sequence
                                    });
                                });

                                // Add thinking
                                state.thinking.forEach(think => {
                                    timeline.push({
                                        id: think.id,
                                        type: 'thinking',
                                        data: think,
                                        sequence: think.sequence
                                    });
                                });

                                // Add tool calls
                                state.toolCalls.forEach(tool => {
                                    timeline.push({
                                        id: tool.id,
                                        type: 'toolCall',
                                        data: tool,
                                        sequence: tool.sequence
                                    });
                                });

                                // Sort by sequence number to maintain chronological order
                                timeline.sort((a, b) => a.sequence - b.sequence);

                                return timeline.map(item => {
                                    switch (item.type) {
                                        case 'message':
                                            return <EventMessage key={item.id} message={item.data} />;
                                        case 'thinking':
                                            return <EventMessage key={item.id} thinking={item.data} />;
                                        case 'toolCall':
                                            return <EventMessage key={item.id} toolCall={item.data} />;
                                        default:
                                            return null;
                                    }
                                });
                            })()}
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
                                    disabled={state.isRunning}
                                />
                                {state.isRunning ? (
                                    <button
                                        className="send-button active"
                                        onClick={stopGeneration}
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
    );
}

export default AppWithEvents;
