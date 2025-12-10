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

        // Add user message to state
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

        try {
            // Include session_id in request body to maintain conversation context
            const requestBody: { message: string; session_id?: string } = { message };
            if (sessionIdRef.current) {
                requestBody.session_id = sessionIdRef.current;
            }

            const response = await fetch('http://localhost:8000/api/response', {
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
                            
                            // Handle SessionInfo event to capture session_id
                            // CustomEvent sets its own 'type' field, so check event.type directly
                            if (event.type === 'SessionInfo') {
                                const sessionId = (event as any).data?.session_id;
                                if (sessionId) {
                                    sessionIdRef.current = sessionId;
                                    console.log('[useAgentEvents] Session ID captured:', sessionId);
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
            abortControllerRef.current.abort();
        }
    }, []);

    const resetSession = useCallback(() => {
        // Clear session ID to start a new conversation
        sessionIdRef.current = null;
        // Reset processor to clear message history
        if (processorRef.current) {
            processorRef.current.reset();
            updateState();
        }
        console.log('[useAgentEvents] Session reset');
    }, [updateState]);

    return {
        state,
        sendMessage,
        stopGeneration,
        processEvent,
        resetSession,
        sessionId: sessionIdRef.current,
    };
}
