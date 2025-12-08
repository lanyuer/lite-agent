/**
 * Event processor for handling AG-UI protocol events.
 * Manages state accumulation and dispatches to appropriate handlers.
 */

/**
 * Event processor for handling AG-UI protocol events.
 * Manages state accumulation and dispatches to appropriate handlers.
 */
import type { AgentEvent, EventHandlers, AgentCustomEvent } from '../types';

export interface MessageState {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    isComplete: boolean;
    sequence: number; // For ordering
}

export interface ThinkingState {
    id: string;
    content: string;
    isComplete: boolean;
    sequence: number; // For ordering
}

export interface ToolCallState {
    id: string;
    name: string;
    args: string;
    result?: any;
    isComplete: boolean;
    isError?: boolean;
    sequence: number; // For ordering
}

export interface RunState {
    runId: string;
    messages: Map<string, MessageState>;
    thinking: Map<string, ThinkingState>;
    toolCalls: Map<string, ToolCallState>;
    isRunning: boolean;
    error?: string;
    sequenceCounter: number; // Global sequence counter
}

export class EventProcessor {
    private handlers: EventHandlers;
    private state: RunState;

    constructor(handlers: EventHandlers = {}) {
        this.handlers = handlers;
        this.state = {
            runId: '',
            messages: new Map(),
            thinking: new Map(),
            toolCalls: new Map(),
            isRunning: false,
            sequenceCounter: 0,
        };
    }

    /**
     * Process a single event and update state.
     */
    processEvent(event: AgentEvent): void {
        // Update state FIRST, before calling handlers
        // This ensures handlers see the updated state
        switch (event.type) {
            case 'RunStarted':
                console.log('[EventProcessor] RunStarted - setting isRunning = true');
                this.state.runId = (event as any).runId;
                this.state.isRunning = true;
                this.state.error = undefined;
                break;

            case 'RunFinished':
                console.log('[EventProcessor] RunFinished - setting isRunning = false');
                this.state.isRunning = false;
                break;

            case 'RunError':
                this.state.isRunning = false;
                this.state.error = (event as any).error;
                break;

            case 'TextMessageStart':
                this.state.messages.set((event as any).messageId, {
                    id: (event as any).messageId,
                    role: (event as any).role,
                    content: '',
                    isComplete: false,
                    sequence: this.state.sequenceCounter++,
                });
                break;

            case 'TextMessageContent':
                {
                    const msg = this.state.messages.get((event as any).messageId);
                    if (msg) {
                        msg.content += (event as any).delta;
                    }
                }
                break;

            case 'TextMessageEnd':
                {
                    const msg = this.state.messages.get((event as any).messageId);
                    if (msg) {
                        msg.isComplete = true;
                    }
                }
                break;

            case 'ThinkingStart':
                this.state.thinking.set((event as any).thinkingId, {
                    id: (event as any).thinkingId,
                    content: '',
                    isComplete: false,
                    sequence: this.state.sequenceCounter++,
                });
                break;

            case 'ThinkingContent':
                {
                    const thinking = this.state.thinking.get((event as any).thinkingId);
                    if (thinking) {
                        thinking.content += (event as any).delta;
                    }
                }
                break;

            case 'ThinkingEnd':
                {
                    const thinking = this.state.thinking.get((event as any).thinkingId);
                    if (thinking) {
                        thinking.isComplete = true;
                    }
                }
                break;

            case 'ToolCallStart':
                this.state.toolCalls.set((event as any).toolCallId, {
                    id: (event as any).toolCallId,
                    name: (event as any).toolCallName,
                    args: '',
                    isComplete: false,
                    sequence: this.state.sequenceCounter++,
                });
                break;

            case 'ToolCallArgs':
                {
                    const toolCall = this.state.toolCalls.get((event as any).toolCallId);
                    if (toolCall) {
                        toolCall.args += (event as any).delta;
                    }
                }
                break;

            case 'ToolCallEnd':
                {
                    const toolCall = this.state.toolCalls.get((event as any).toolCallId);
                    if (toolCall) {
                        toolCall.isComplete = true;
                    }
                }
                break;

            case 'ToolCallResult':
                {
                    const toolCall = this.state.toolCalls.get((event as any).toolCallId);
                    if (toolCall) {
                        toolCall.result = (event as any).content;
                        toolCall.isError = (event as any).isError;
                    }
                }
                break;
        }

        // Call handlers AFTER state is updated
        this.callHandler(event);

        // Call generic handler
        if (this.handlers.onAnyEvent) {
            this.handlers.onAnyEvent(event);
        }
    }

    /**
     * Call the appropriate handler for an event.
     */
    private callHandler(event: AgentEvent): void {
        switch (event.type) {
            case 'RunStarted':
                if ('runId' in event) this.handlers.onRunStarted?.(event);
                break;
            case 'RunFinished':
                if ('runId' in event) this.handlers.onRunFinished?.(event);
                break;
            case 'RunError':
                if ('runId' in event && 'error' in event) this.handlers.onRunError?.(event);
                break;
            case 'StepStarted':
                if ('stepId' in event) this.handlers.onStepStarted?.(event);
                break;
            case 'StepFinished':
                if ('stepId' in event) this.handlers.onStepFinished?.(event);
                break;
            case 'TextMessageStart':
                if ('messageId' in event) this.handlers.onTextMessageStart?.(event);
                break;
            case 'TextMessageContent':
                if ('messageId' in event && 'delta' in event) this.handlers.onTextMessageContent?.(event);
                break;
            case 'TextMessageEnd':
                if ('messageId' in event) this.handlers.onTextMessageEnd?.(event);
                break;
            case 'ToolCallStart':
                if ('toolCallId' in event) this.handlers.onToolCallStart?.(event);
                break;
            case 'ToolCallArgs':
                if ('toolCallId' in event && 'delta' in event) this.handlers.onToolCallArgs?.(event);
                break;
            case 'ToolCallEnd':
                if ('toolCallId' in event) this.handlers.onToolCallEnd?.(event);
                break;
            case 'ToolCallResult':
                if ('toolCallId' in event && 'content' in event) this.handlers.onToolCallResult?.(event);
                break;
            case 'ThinkingStart':
                if ('thinkingId' in event) this.handlers.onThinkingStart?.(event);
                break;
            case 'ThinkingContent':
                if ('thinkingId' in event && 'delta' in event) this.handlers.onThinkingContent?.(event);
                break;
            case 'ThinkingEnd':
                if ('thinkingId' in event) this.handlers.onThinkingEnd?.(event);
                break;
            case 'StateSnapshot':
                if ('state' in event) this.handlers.onStateSnapshot?.(event);
                break;
            case 'StateDelta':
                if ('delta' in event) this.handlers.onStateDelta?.(event);
                break;
            default:
                this.handlers.onCustomEvent?.(event as AgentCustomEvent);
        }
    }

    /**
     * Get the current state.
     */
    getState(): Readonly<RunState> {
        return this.state;
    }

    /**
     * Reset the processor state.
     */
    reset(): void {
        this.state = {
            runId: '',
            messages: new Map(),
            thinking: new Map(),
            toolCalls: new Map(),
            isRunning: false,
            sequenceCounter: 0,
        };
    }
}
