import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, StopCircle, Paperclip, Mic, ArrowUp, Plus } from 'lucide-react';
import { Sidebar, type Task } from './components/Sidebar';
import { EventMessage } from './components/EventMessage';
import { FileBrowser } from './components/FileBrowser';
import { useAgentEvents } from './hooks/useAgentEvents';
import type { MessageState, ThinkingState, ToolCallState } from './lib/EventProcessor';
import './App.css';

function AppWithEvents() {
    const { taskId } = useParams<{ taskId?: string }>();
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
    const [, setIsLoadingTasks] = useState(true);
    const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { state, sendMessage, stopGeneration, loadTask, setTaskId, resetSession } = useAgentEvents({
        onError: (error) => {
            console.error('Agent error:', error);
            alert(`Error: ${error}`);
        },
        onComplete: async () => {
            console.log('Agent completed');
            // Refresh tasks list after completion
            await fetchTasks();
        },
        onTaskIdReceived: (taskId: string) => {
            // When a new task_id is received (e.g., from SessionInfo event), update URL
            console.log(`[AppWithEvents] New task_id received: ${taskId}, updating URL`);
            if (taskId !== currentTaskId) {
                navigate(`/task/${taskId}`, { replace: true });
            }
        },
    });

    // Fetch tasks from API
    const fetchTasks = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/v1/tasks');
            if (response.ok) {
                const data = await response.json();
                setTasks(data);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setIsLoadingTasks(false);
        }
    };

    // Load tasks on mount
    useEffect(() => {
        fetchTasks();
    }, []);

    // Sync currentTaskId with URL params (one-way: URL -> state)
    // Only update when URL actually changes, not when currentTaskId changes
    useEffect(() => {
        if (taskId && taskId !== currentTaskId) {
            console.log(`[AppWithEvents] URL taskId changed: ${taskId}, loading task...`);
            setCurrentTaskId(taskId);
            if (loadTask) {
                loadTask(taskId).catch(console.error);
            }
        } else if (!taskId && currentTaskId) {
            // If URL has no taskId but we have one, clear it (user navigated away)
            console.log('[AppWithEvents] URL has no taskId, clearing current task');
            setCurrentTaskId(null);
            if (resetSession) {
                resetSession();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId]); // Only depend on taskId from URL, not currentTaskId to avoid loops

    // Update taskId in hook when currentTaskId changes
    useEffect(() => {
        if (setTaskId) {
            setTaskId(currentTaskId);
        }
    }, [currentTaskId, setTaskId]);

    // Handle new task creation
    const handleNewTask = async () => {
        try {
            // Stop any ongoing generation before creating new task
            if (state.isRunning) {
                console.log('[AppWithEvents] Stopping ongoing generation before creating new task');
                stopGeneration();
                // Wait a bit for the abort to take effect
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const response = await fetch('http://localhost:8000/api/v1/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: undefined }),
            });
            if (response.ok) {
                const newTask = await response.json();
                // Navigate to new task URL first (this will trigger useEffect to load task)
                navigate(`/task/${newTask.id}`, { replace: true });
                await fetchTasks();
            }
        } catch (error) {
            console.error('Error creating task:', error);
        }
    };

    // Handle task selection
    const handleTaskSelect = async (taskId: string) => {
        if (taskId === currentTaskId) return;
        
        try {
            // Stop any ongoing generation before switching tasks
            if (state.isRunning) {
                console.log('[AppWithEvents] Stopping ongoing generation before switching tasks');
                stopGeneration();
                // Wait a bit for the abort to take effect
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Navigate to task URL (this will trigger useEffect to load task)
            navigate(`/task/${taskId}`, { replace: true });
            // Refresh tasks list to get updated cumulative usage
            await fetchTasks();
        } catch (error) {
            console.error('Error loading task:', error);
        }
    };

    // Handle task deletion
    const handleTaskDelete = async (taskId: string) => {
        try {
            const response = await fetch(`http://localhost:8000/api/v1/tasks/${taskId}`, {
                method: 'DELETE',
            });
            if (response.ok || response.status === 204) {
                // If deleted task was current, navigate to home (this will trigger useEffect to clear state)
                if (taskId === currentTaskId) {
                    navigate('/', { replace: true });
                }
                // Refresh tasks list
                await fetchTasks();
            } else {
                throw new Error('Failed to delete task');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            alert(`Failed to delete task: ${error}`);
        }
    };

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
        // Send on Ctrl+Enter or Cmd+Enter
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const hasMessages = state.messages.length > 0 || state.thinking.length > 0 || state.toolCalls.length > 0;

    return (
        <div className="app-layout">
            <Sidebar 
                isOpen={isSidebarOpen} 
                toggleSidebar={toggleSidebar}
                tasks={tasks}
                currentTaskId={currentTaskId}
                onNewTask={handleNewTask}
                onTaskSelect={handleTaskSelect}
                onTaskDelete={handleTaskDelete}
                onOpenFileBrowser={() => setIsFileBrowserOpen(true)}
            />
            
            <FileBrowser 
                isOpen={isFileBrowserOpen} 
                onClose={() => setIsFileBrowserOpen(false)} 
            />

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
                            {/* Create unified timeline with thinking and messages merged */}
                            {(() => {
                                // Collect all events and sort by sequence
                                const allEvents: Array<{
                                    type: 'message' | 'thinking' | 'toolCall' | 'uiComponent';
                                    data: MessageState | ThinkingState | ToolCallState | import('./lib/EventProcessor').UIComponentState;
                                    sequence: number;
                                }> = [];

                                state.messages.forEach(msg => {
                                    allEvents.push({ type: 'message', data: msg, sequence: msg.sequence });
                                });
                                state.thinking.forEach(think => {
                                    allEvents.push({ type: 'thinking', data: think, sequence: think.sequence });
                                });
                                state.toolCalls.forEach(tool => {
                                    allEvents.push({ type: 'toolCall', data: tool, sequence: tool.sequence });
                                });
                                state.uiComponents.forEach(uiComp => {
                                    allEvents.push({ type: 'uiComponent', data: uiComp, sequence: uiComp.sequence });
                                });

                                // Sort by sequence
                                allEvents.sort((a, b) => a.sequence - b.sequence);

                                // Group thinking with the next assistant message
                                const grouped: Array<{
                                    id: string;
                                    message?: MessageState;
                                    thinking?: ThinkingState;
                                    toolCall?: ToolCallState;
                                    uiComponents?: import('./lib/EventProcessor').UIComponentState[];
                                }> = [];

                                for (let i = 0; i < allEvents.length; i++) {
                                    const event = allEvents[i];

                                    if (event.type === 'message') {
                                        const msg = event.data as MessageState;
                                        
                                        if (msg.role === 'user') {
                                            grouped.push({ id: msg.id, message: msg });
                                        } else if (msg.role === 'assistant') {
                                            // Find the most recent thinking before this message
                                            let associatedThinking: ThinkingState | undefined;
                                            
                                            // Look back for thinking
                                            for (let j = i - 1; j >= 0; j--) {
                                                const prevEvent = allEvents[j];
                                                // Stop if we hit another assistant message or user message
                                                if (prevEvent.type === 'message') break;
                                                
                                                if (prevEvent.type === 'thinking') {
                                                    associatedThinking = prevEvent.data as ThinkingState;
                                                    break; // Found it
                                                }
                                            }
                                            
                                            grouped.push({
                                                id: msg.id,
                                                message: msg,
                                                thinking: associatedThinking
                                            });
                                        }
                                    } else if (event.type === 'toolCall') {
                                        grouped.push({ id: (event.data as ToolCallState).id, toolCall: event.data as ToolCallState });
                                    } else if (event.type === 'thinking') {
                                        // Check if this thinking is consumed by a future message
                                        let isConsumed = false;
                                        for (let j = i + 1; j < allEvents.length; j++) {
                                            const nextEvent = allEvents[j];
                                            // If we hit an assistant message, this thinking belongs to it
                                            if (nextEvent.type === 'message' && (nextEvent.data as MessageState).role === 'assistant') {
                                                isConsumed = true;
                                                break;
                                            }
                                            // If we hit another thinking or user message, this thinking is standalone
                                            if (nextEvent.type === 'thinking' || (nextEvent.type === 'message' && (nextEvent.data as MessageState).role === 'user')) {
                                                break;
                                            }
                                        }
                                        
                                        if (!isConsumed) {
                                            grouped.push({ id: (event.data as ThinkingState).id, thinking: event.data as ThinkingState });
                                        }
                                    }
                                }

                                // Optimistic UI: Show loading thinking process immediately after user message
                                if (state.isRunning) {
                                    const hasAssistantActivity = grouped.some(item => 
                                        (item.message && item.message.role === 'assistant') || 
                                        item.thinking || 
                                        (item.toolCall)
                                    );

                                    if (!hasAssistantActivity) {
                                        grouped.push({
                                            id: 'optimistic-thinking',
                                            thinking: {
                                                id: 'optimistic-thinking',
                                                content: '',
                                                isComplete: false,
                                                sequence: Infinity
                                            }
                                        });
                                    }
                                }

                                return grouped.map((item, index) => {
                                    // Determine if header should be hidden
                                    // Hide if previous item was also an assistant event (thinking, tool, or assistant message)
                                    // and this item is also an assistant event
                                    let hideHeader = false;
                                    
                                    if (index > 0) {
                                        const prevItem = grouped[index - 1];
                                        const isPrevAssistant = 
                                            (prevItem.message?.role === 'assistant') || 
                                            (!!prevItem.thinking && !prevItem.message) || 
                                            (!!prevItem.toolCall);
                                            
                                        const isCurrentAssistant = 
                                            (item.message?.role === 'assistant') || 
                                            (!!item.thinking && !item.message);
                                            
                                        // Don't hide header for tool calls to keep them distinct
                                        if (isPrevAssistant && isCurrentAssistant && !item.toolCall) {
                                            hideHeader = true;
                                        }
                                    }

                                    // Show cost info on the last assistant message when run is finished
                                    // Check if this is the last assistant message that's complete
                                    const isLastAssistantMessage = 
                                        item.message?.role === 'assistant' && 
                                        item.message?.isComplete &&
                                        !state.isRunning &&
                                        // Check if this is the last assistant message in the list
                                        (() => {
                                            // Find the last assistant message index
                                            let lastAssistantIndex = -1;
                                            for (let i = grouped.length - 1; i >= 0; i--) {
                                                if (grouped[i].message?.role === 'assistant' && grouped[i].message?.isComplete) {
                                                    lastAssistantIndex = i;
                                                    break;
                                                }
                                            }
                                            return index === lastAssistantIndex;
                                        })();
                                    
                                    if (isLastAssistantMessage) {
                                        console.log('[AppWithEvents] Last assistant message found');
                                        console.log('[AppWithEvents] state.usage:', state.usage);
                                        console.log('[AppWithEvents] state.isRunning:', state.isRunning);
                                    }
                                    
                                    // Get cumulative usage from current task
                                    const currentTask = tasks.find(t => t.id === currentTaskId);
                                    const cumulativeUsage = currentTask ? {
                                        total_cost_usd: currentTask.total_cost_usd,
                                        total_input_tokens: currentTask.total_input_tokens,
                                        total_output_tokens: currentTask.total_output_tokens,
                                    } : undefined;
                                    
                                    return (
                                        <EventMessage
                                            key={item.id}
                                            message={item.message}
                                            thinking={item.thinking}
                                            toolCall={item.toolCall}
                                            uiComponents={item.uiComponents}
                                            hideHeader={hideHeader}
                                            usage={isLastAssistantMessage ? state.usage : undefined}
                                            cumulativeUsage={cumulativeUsage}
                                            showCumulative={isLastAssistantMessage}
                                            onUIInteraction={() => {}}
                                        />
                                    );
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
