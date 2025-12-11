/**
 * React hook for managing agent events and state.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { EventProcessor } from '../lib/EventProcessor';
import type { MessageState, ThinkingState, ToolCallState, UsageInfo } from '../lib/EventProcessor';
import type { AgentEvent } from '../types';

export interface UseAgentEventsOptions {
    onError?: (error: string) => void;
    onComplete?: () => void;
    onTaskIdReceived?: (taskId: string) => void;  // Callback when new task_id is received
}

export interface AgentState {
    messages: MessageState[];
    thinking: ThinkingState[];
    toolCalls: ToolCallState[];
    isRunning: boolean;
    error?: string;
    usage?: UsageInfo; // Token usage and cost information
}

export function useAgentEvents(options: UseAgentEventsOptions = {}) {
    const [state, setState] = useState<AgentState>({
        messages: [],
        thinking: [],
        toolCalls: [],
        isRunning: false,
    });

    const processorRef = useRef<EventProcessor | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const taskIdRef = useRef<string | null>(null);

    const updateState = useCallback(() => {
        if (!processorRef.current) return;

        const runState = processorRef.current.getState();

        console.log('[useAgentEvents] updateState called, isRunning:', runState.isRunning);

        // Use requestAnimationFrame to ensure smooth updates
        requestAnimationFrame(() => {
            setState({
                messages: Array.from(runState.messages.values()),
                thinking: Array.from(runState.thinking.values()),
                toolCalls: Array.from(runState.toolCalls.values()),
                isRunning: runState.isRunning,
                error: runState.error,
                usage: runState.usage, // Include usage information
            });
        });
    }, []);

    // Initialize processor
    useEffect(() => {
        if (processorRef.current) return; // Already initialized

        processorRef.current = new EventProcessor({
            onRunStarted: () => {
                console.log('[useAgentEvents] onRunStarted handler called');
                updateState();
            },
            onRunFinished: () => {
                console.log('[useAgentEvents] onRunFinished handler called');
                updateState();
                options.onComplete?.();
            },
            onRunError: (event) => {
                updateState();
                options.onError?.(event.error);
            },
            // Only update on content changes for streaming effect
            onTextMessageStart: () => updateState(),
            onTextMessageContent: () => updateState(),
            onTextMessageEnd: () => updateState(),
            onThinkingStart: () => updateState(),
            onThinkingContent: () => updateState(),
            onThinkingEnd: () => updateState(),
            onToolCallStart: () => updateState(),
            onToolCallArgs: () => updateState(),
            onToolCallEnd: () => updateState(),
            onToolCallResult: () => updateState(),
        });
    }, [updateState, options]);

    const processEvent = useCallback((event: AgentEvent) => {
        if (!processorRef.current) return;
        processorRef.current.processEvent(event);
    }, []);

    const sendMessage = useCallback(async (message: string) => {
        if (!processorRef.current) return;

        // Don't reset processor - keep conversation history
        // processorRef.current.reset();

        // If no task_id exists (homepage scenario), create a new task first
        // This ensures all logic is consistent with existing tasks
        if (!taskIdRef.current) {
            try {
                console.log('[useAgentEvents] No task_id, creating new task first...');
                const response = await fetch('http://localhost:8000/api/v1/tasks', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ title: message.substring(0, 50).trim() || undefined }),
                });
                
                if (!response.ok) {
                    throw new Error('Failed to create task');
                }
                
                const newTask = await response.json();
                const newTaskId = newTask.id;
                console.log('[useAgentEvents] Created new task:', newTaskId);
                
                // Update task_id ref
                taskIdRef.current = newTaskId;
                
                // Notify parent component about new task_id (for URL update)
                if (options.onTaskIdReceived) {
                    options.onTaskIdReceived(newTaskId);
                }
            } catch (error) {
                console.error('[useAgentEvents] Error creating task:', error);
                options.onError?.('Failed to create task');
                return;
            }
        }

        // Now we always have a task_id, so handle it like an existing task
        // Add user message to state immediately for better UX
        const userMessageId = `user-${Date.now()}`;
        processorRef.current.processEvent({
            type: 'TextMessageStart',
            message_id: userMessageId,
            role: 'user',
            timestamp: new Date().toISOString(),
        });
        processorRef.current.processEvent({
            type: 'TextMessageContent',
            message_id: userMessageId,
            delta: message,
            timestamp: new Date().toISOString(),
        });
        processorRef.current.processEvent({
            type: 'TextMessageEnd',
            message_id: userMessageId,
            timestamp: new Date().toISOString(),
        });

        // Manually trigger RunStarted to set isRunning = true immediately
        processorRef.current.processEvent({
            type: 'RunStarted',
            run_id: `run-${Date.now()}`,
            timestamp: new Date().toISOString(),
        } as any);

        updateState();

        // Create abort controller
        abortControllerRef.current = new AbortController();
        
        // Record the task_id at the start of this request to ensure events belong to this task
        const requestTaskId = taskIdRef.current;

        try {
            // Include session_id and task_id in request body
            const requestBody: { message: string; session_id?: string; task_id?: string } = { message };
            if (sessionIdRef.current) {
                requestBody.session_id = sessionIdRef.current;
            }
            if (taskIdRef.current) {
                requestBody.task_id = taskIdRef.current;
            }

            const response = await fetch('http://localhost:8000/api/v1/response', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No reader available');

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[useAgentEvents] Stream ended');
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (!dataStr) continue;

                        try {
                            const event = JSON.parse(dataStr) as AgentEvent;
                            
                            // Check if user has switched to a different task
                            // If so, ignore events from this stream to prevent cross-task contamination
                            if (taskIdRef.current !== requestTaskId) {
                                console.log(`[useAgentEvents] Ignoring event - task switched from ${requestTaskId} to ${taskIdRef.current}`);
                                continue;
                            }
                            
                            // Handle SessionInfo event to capture session_id and task_id
                            // CustomEvent sets its own 'type' field, so check event.type directly
                            if (event.type === 'SessionInfo') {
                                const sessionId = (event as any).data?.session_id;
                                const taskId = (event as any).data?.task_id;
                                if (sessionId) {
                                    sessionIdRef.current = sessionId;
                                    console.log('[useAgentEvents] Session ID captured:', sessionId);
                                }
                                if (taskId && taskId !== taskIdRef.current) {
                                    const previousTaskId = taskIdRef.current;
                                    taskIdRef.current = taskId;
                                    console.log('[useAgentEvents] Task ID captured:', taskId, '(previous:', previousTaskId, ')');
                                    // Notify parent component about new task_id (for URL update)
                                    if (options.onTaskIdReceived) {
                                        options.onTaskIdReceived(taskId);
                                    }
                                }
                            }
                            
                            processEvent(event);
                        } catch (e) {
                            console.error('Error parsing event:', e);
                        }
                    }
                }
            }

            // Ensure isRunning is set to false when stream completes
            if (processorRef.current) {
                const state = processorRef.current.getState();
                if (state.isRunning) {
                    console.log('[useAgentEvents] Stream ended but isRunning still true, forcing to false');
                    processorRef.current.processEvent({
                        type: 'RunFinished',
                        run_id: state.run_id,
                        timestamp: new Date().toISOString(),
                    } as any);
                    // Force state update
                    updateState();
                }
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Error sending message:', error);
                
                // Ensure we reset the running state on error
                if (processorRef.current) {
                    processorRef.current.processEvent({
                        type: 'RunError',
                        run_id: processorRef.current.getState().run_id || 'error',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                    } as any);
                    // Force update
                    updateState();
                }
                
                options.onError?.(error.message);
            }
        } finally {
            abortControllerRef.current = null;
        }
    }, [processEvent, updateState, options]);

    const stopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            console.log('[useAgentEvents] Stopping generation');
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            // Update processor state to mark as not running
            if (processorRef.current) {
                const state = processorRef.current.getState();
                if (state.isRunning) {
                    processorRef.current.processEvent({
                        type: 'RunFinished',
                        run_id: state.run_id || 'interrupted',
                        timestamp: new Date().toISOString(),
                    } as any);
                    updateState();
                }
            }
        }
    }, [updateState]);

    const resetSession = useCallback(() => {
        // Clear session ID and task ID to start a new conversation
        sessionIdRef.current = null;
        taskIdRef.current = null;
        // Reset processor to clear message history
        if (processorRef.current) {
            processorRef.current.reset();
            updateState();
        }
        console.log('[useAgentEvents] Session reset');
    }, [updateState]);

    const loadTask = useCallback(async (taskId: string) => {
        try {
            // Don't load task if we're currently running (sending message)
            // This prevents resetting processor state while user message is being sent
            if (processorRef.current?.getState().isRunning) {
                console.log('[useAgentEvents] Skipping loadTask - message is being sent');
                return;
            }
            
            // Stop any ongoing generation before loading a different task
            if (abortControllerRef.current) {
                console.log('[useAgentEvents] Aborting ongoing request before loading task');
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
                // Wait a bit for the abort to take effect
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Fetch task with conversations
            const taskResponse = await fetch(`http://localhost:8000/api/v1/tasks/${taskId}`);
            if (!taskResponse.ok) {
                throw new Error('Failed to load task');
            }
            const task = await taskResponse.json();
            
            // Set task ID and session ID
            taskIdRef.current = task.id;
            if (task.session_id) {
                sessionIdRef.current = task.session_id;
            }
            
            // Reset processor to clear any previous state
            if (processorRef.current) {
                processorRef.current.reset();
                
                // Try to fetch events first (new format)
                let events: any[] = [];
                try {
                    const eventsResponse = await fetch(`http://localhost:8000/api/v1/tasks/${taskId}/events`);
                    if (eventsResponse.ok) {
                        events = await eventsResponse.json();
                    }
                } catch (e) {
                    console.warn('Failed to load events, falling back to conversations:', e);
                }
                
                // If we have events, load them
                if (events && events.length > 0) {
                    console.log(`[loadTask] Loading ${events.length} events for task ${taskId}`);
                    // Ensure events are sorted by sequence (backend should already sort, but be safe)
                    events.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
                    let lastUsageInfo: any = null;
                    for (const event of events) {
                        try {
                            // Skip SystemMessage and SessionInfo events - these are handled separately
                            // SystemMessage is only used to extract session_id on the backend
                            // SessionInfo is sent to frontend but doesn't need to be replayed
                            if (event.event_type === 'SystemMessage' || event.event_type === 'SessionInfo') {
                                console.log(`[loadTask] Skipping ${event.event_type} event (handled separately)`);
                                continue;
                            }
                            
                            // Process each event
                            const eventData = event.event_data || {};
                            // eventData already contains 'type' from model_dump(), but we use event_type from DB
                            // Remove 'type' and 'timestamp' from eventData if present to avoid conflict
                            const { type: _, timestamp: __, ...restData } = eventData;
                            
                            // For CustomEvent types (like ResultMessage), eventData might be the 'data' field
                            // Reconstruct the event object properly
                            let eventObj: any;
                            if (event.event_type === 'ResultMessage' && eventData.data) {
                                // ResultMessage was saved as CustomEvent, reconstruct it
                                eventObj = {
                                    type: event.event_type,
                                    ...eventData,
                                    timestamp: event.created_at || new Date().toISOString(),
                                };
                            } else {
                                // Normal event reconstruction
                                eventObj = {
                                    type: event.event_type,
                                    ...restData,
                                    timestamp: event.created_at || new Date().toISOString(),
                                };
                            }
                            
                            // Validate required fields for specific event types
                            if (event.event_type === 'ThinkingStart' && !eventObj.thinking_id) {
                                console.warn(`[loadTask] ThinkingStart event missing thinking_id:`, eventObj);
                                continue; // Skip invalid event
                            }
                            if (event.event_type === 'ThinkingContent' && !eventObj.thinking_id) {
                                console.warn(`[loadTask] ThinkingContent event missing thinking_id:`, eventObj);
                                continue; // Skip invalid event
                            }
                            if (event.event_type === 'ThinkingEnd' && !eventObj.thinking_id) {
                                console.warn(`[loadTask] ThinkingEnd event missing thinking_id:`, eventObj);
                                continue; // Skip invalid event
                            }
                            if (event.event_type === 'TextMessageStart' && !eventObj.message_id) {
                                console.warn(`[loadTask] TextMessageStart event missing message_id:`, eventObj);
                                continue; // Skip invalid event
                            }
                            
                            console.log(`[loadTask] Processing event: ${event.event_type} (sequence=${event.sequence})`, eventObj);
                            // Use database sequence for proper ordering (interleaved user/assistant messages)
                            processorRef.current.processEvent(eventObj as AgentEvent, event.sequence);
                        } catch (e) {
                            console.error(`[loadTask] Error processing event ${event.event_type}:`, e, event);
                        }
                        
                        // Track usage from RunFinished event
                        if (event.event_type === 'RunFinished') {
                            const eventDataForUsage = event.event_data || {};
                            const usageData = eventDataForUsage.usage || {};
                            const totalCost = eventDataForUsage.total_cost_usd;
                            if (usageData && Object.keys(usageData).length > 0) {
                                lastUsageInfo = {
                                    ...usageData,
                                    total_cost_usd: totalCost !== undefined && totalCost !== null ? totalCost : (usageData.total_cost_usd || 0),
                                };
                            } else if (totalCost !== undefined && totalCost !== null) {
                                lastUsageInfo = {
                                    total_cost_usd: totalCost,
                                };
                            }
                        }
                    }
                    
                    // Set usage info if available
                    if (lastUsageInfo && processorRef.current) {
                        processorRef.current.setUsage(lastUsageInfo);
                    }
                } else {
                    // Fallback to conversations (for old tasks without events)
                    console.log(`[loadTask] No events found, loading conversations for task ${taskId}`);
                    if (task.conversations && task.conversations.length > 0) {
                        let lastAssistantConv = null;
                        for (const conv of task.conversations) {
                            const messageId = `msg-${conv.id}`;
                            processorRef.current.processEvent({
                                type: 'TextMessageStart',
                                message_id: messageId,
                                role: conv.role as 'user' | 'assistant',
                                timestamp: conv.created_at,
                            });
                            processorRef.current.processEvent({
                                type: 'TextMessageContent',
                                message_id: messageId,
                                delta: conv.content,
                                timestamp: conv.created_at,
                            });
                            processorRef.current.processEvent({
                                type: 'TextMessageEnd',
                                message_id: messageId,
                                timestamp: conv.created_at,
                            });
                            
                            // Track last assistant message for usage info
                            if (conv.role === 'assistant') {
                                lastAssistantConv = conv;
                            }
                        }
                        
                        // If last message was assistant and has usage info, restore it to state
                        if (lastAssistantConv && (lastAssistantConv.cost_usd || lastAssistantConv.input_tokens || lastAssistantConv.output_tokens)) {
                            const usageInfo: any = {};
                            if (lastAssistantConv.cost_usd) {
                                usageInfo.total_cost_usd = lastAssistantConv.cost_usd;
                            }
                            if (lastAssistantConv.input_tokens) {
                                usageInfo.input_tokens = lastAssistantConv.input_tokens;
                            }
                            if (lastAssistantConv.output_tokens) {
                                usageInfo.output_tokens = lastAssistantConv.output_tokens;
                            }
                            if (lastAssistantConv.usage_data) {
                                Object.assign(usageInfo, lastAssistantConv.usage_data);
                            }
                            
                            // Set usage in processor state
                            if (processorRef.current) {
                                processorRef.current.setUsage(usageInfo);
                            }
                        }
                    }
                }
                
                updateState();
            }
            
            return task;
        } catch (error) {
            console.error('Error loading task:', error);
            throw error;
        }
    }, [updateState]);

    const setTaskId = useCallback((taskId: string | null) => {
        taskIdRef.current = taskId;
    }, []);

    return {
        state,
        sendMessage,
        stopGeneration,
        processEvent,
        resetSession,
        loadTask,
        setTaskId,
        sessionId: sessionIdRef.current,
        taskId: taskIdRef.current,
    };
}
