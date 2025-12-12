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

export interface UsageInfo {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    total_cost_usd?: number;
    [key: string]: any;
}

export interface RunState {
    run_id: string;
    messages: Map<string, MessageState>;
    thinking: Map<string, ThinkingState>;
    toolCalls: Map<string, ToolCallState>;
    isRunning: boolean;
    error?: string;
    sequenceCounter: number; // Global sequence counter
    usage?: UsageInfo; // Token usage and cost information
}

export class EventProcessor {
    private handlers: EventHandlers;
    private state: RunState;

    constructor(handlers: EventHandlers = {}) {
        this.handlers = handlers;
        this.state = {
            run_id: '',
            messages: new Map(),
            thinking: new Map(),
            toolCalls: new Map(),
            isRunning: false,
            sequenceCounter: 0,
        };
    }

    /**
     * Process a single event and update state.
     * @param event The event to process
     * @param sequence Optional sequence number (for loading from database). If not provided, uses sequenceCounter++.
     */
    processEvent(event: AgentEvent, sequence?: number): void {
        // Update state FIRST, before calling handlers
        // This ensures handlers see the updated state
        switch (event.type) {
            case 'RunStarted':
                console.log('[EventProcessor] RunStarted - setting isRunning = true');
                this.state.run_id = (event as any).run_id;
                this.state.isRunning = true;
                this.state.error = undefined;
                break;

            case 'RunFinished':
                console.log('[EventProcessor] RunFinished - setting isRunning = false');
                this.state.isRunning = false;
                // Store usage information if available
                const runFinishedEvent = event as any;
                console.log('[EventProcessor] RunFinished event:', runFinishedEvent);
                console.log('[EventProcessor] total_cost_usd:', runFinishedEvent.total_cost_usd);
                console.log('[EventProcessor] usage:', runFinishedEvent.usage);
                
                // Extract usage and cost (using snake_case)
                const totalCost = runFinishedEvent.total_cost_usd;
                const usageData = runFinishedEvent.usage || {};
                
                console.log('[EventProcessor] Extracted totalCost:', totalCost);
                console.log('[EventProcessor] Extracted usageData:', usageData);
                
                if (usageData && Object.keys(usageData).length > 0) {
                    // Merge usage data with total_cost_usd
                    this.state.usage = {
                        ...usageData,
                        total_cost_usd: totalCost !== undefined && totalCost !== null ? totalCost : (usageData.total_cost_usd || 0),
                    };
                    console.log('[EventProcessor] Stored usage:', this.state.usage);
                } else if (totalCost !== undefined && totalCost !== null) {
                    // If we have cost but no usage object, create one
                    this.state.usage = {
                        total_cost_usd: totalCost,
                    };
                    console.log('[EventProcessor] Stored usage (cost only):', this.state.usage);
                } else {
                    console.log('[EventProcessor] No usage information in RunFinished event');
                }
                break;

            case 'RunError':
                this.state.isRunning = false;
                this.state.error = (event as any).error;
                break;

            case 'TextMessageStart':
                {
                    const msgId = (event as any).message_id;
                    const existingMsg = this.state.messages.get(msgId);
                    if (!existingMsg) {
                        // Use provided sequence or auto-increment
                        const msgSequence = sequence !== undefined ? sequence : this.state.sequenceCounter++;
                        this.state.messages.set(msgId, {
                            id: msgId,
                            role: (event as any).role,
                            content: '',
                            isComplete: false,
                            sequence: msgSequence,
                        });
                    } else if (sequence !== undefined && sequence !== existingMsg.sequence) {
                        // Update sequence if provided and different (for correcting optimistic updates)
                        existingMsg.sequence = sequence;
                    }
                }
                break;

            case 'TextMessageContent':
                {
                    const msg = this.state.messages.get((event as any).message_id);
                    if (msg) {
                        msg.content += (event as any).delta;
                    }
                }
                break;

            case 'TextMessageEnd':
                {
                    const msg = this.state.messages.get((event as any).message_id);
                    if (msg) {
                        msg.isComplete = true;
                    }
                }
                break;

            case 'ThinkingStart':
                {
                    const thinkingId = (event as any).thinking_id;
                    const existingThinking = this.state.thinking.get(thinkingId);
                    if (!existingThinking) {
                        // Use provided sequence or auto-increment
                        const thinkingSequence = sequence !== undefined ? sequence : this.state.sequenceCounter++;
                        this.state.thinking.set(thinkingId, {
                            id: thinkingId,
                    content: '',
                    isComplete: false,
                            sequence: thinkingSequence,
                });
                    }
                }
                break;

            case 'ThinkingContent':
                {
                    const thinking = this.state.thinking.get((event as any).thinking_id);
                    if (thinking) {
                        thinking.content += (event as any).delta;
                    }
                }
                break;

            case 'ThinkingEnd':
                {
                    const thinking = this.state.thinking.get((event as any).thinking_id);
                    if (thinking) {
                        thinking.isComplete = true;
                    }
                }
                break;

            case 'ToolCallStart':
                {
                    const toolCallId = (event as any).tool_call_id;
                    const existingToolCall = this.state.toolCalls.get(toolCallId);
                    if (!existingToolCall) {
                        // Use provided sequence or auto-increment
                        const toolCallSequence = sequence !== undefined ? sequence : this.state.sequenceCounter++;
                        this.state.toolCalls.set(toolCallId, {
                            id: toolCallId,
                    name: (event as any).tool_call_name,
                    args: '',
                    isComplete: false,
                            sequence: toolCallSequence,
                });
                    }
                }
                break;

            case 'ToolCallArgs':
                {
                    const toolCall = this.state.toolCalls.get((event as any).tool_call_id);
                    if (toolCall) {
                        toolCall.args += (event as any).delta;
                    }
                }
                break;

            case 'ToolCallEnd':
                {
                    const toolCall = this.state.toolCalls.get((event as any).tool_call_id);
                    if (toolCall) {
                        toolCall.isComplete = true;
                    }
                }
                break;

            case 'ToolCallResult':
                {
                    const toolCall = this.state.toolCalls.get((event as any).tool_call_id);
                    if (toolCall) {
                        toolCall.result = (event as any).content;
                        toolCall.isError = (event as any).is_error;
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
                if ('run_id' in event) this.handlers.onRunStarted?.(event);
                break;
            case 'RunFinished':
                if ('run_id' in event) this.handlers.onRunFinished?.(event);
                break;
            case 'RunError':
                if ('run_id' in event && 'error' in event) this.handlers.onRunError?.(event);
                break;
            case 'StepStarted':
                if ('step_id' in event) this.handlers.onStepStarted?.(event);
                break;
            case 'StepFinished':
                if ('step_id' in event) this.handlers.onStepFinished?.(event);
                break;
            case 'TextMessageStart':
                if ('message_id' in event) this.handlers.onTextMessageStart?.(event);
                break;
            case 'TextMessageContent':
                if ('message_id' in event && 'delta' in event) this.handlers.onTextMessageContent?.(event);
                break;
            case 'TextMessageEnd':
                if ('message_id' in event) this.handlers.onTextMessageEnd?.(event);
                break;
            case 'ToolCallStart':
                if ('tool_call_id' in event) this.handlers.onToolCallStart?.(event);
                break;
            case 'ToolCallArgs':
                if ('tool_call_id' in event && 'delta' in event) this.handlers.onToolCallArgs?.(event);
                break;
            case 'ToolCallEnd':
                if ('tool_call_id' in event) this.handlers.onToolCallEnd?.(event);
                break;
            case 'ToolCallResult':
                if ('tool_call_id' in event && 'content' in event) this.handlers.onToolCallResult?.(event);
                break;
            case 'ThinkingStart':
                if ('thinking_id' in event) this.handlers.onThinkingStart?.(event);
                break;
            case 'ThinkingContent':
                if ('thinking_id' in event && 'delta' in event) this.handlers.onThinkingContent?.(event);
                break;
            case 'ThinkingEnd':
                if ('thinking_id' in event) this.handlers.onThinkingEnd?.(event);
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
     * Get the maximum sequence number from all messages, thinking, and tool calls.
     */
    getMaxSequence(): number {
        let maxSequence = -1;
        
        // Check messages
        for (const msg of this.state.messages.values()) {
            if (msg.sequence > maxSequence) {
                maxSequence = msg.sequence;
            }
        }
        
        // Check thinking
        for (const thinking of this.state.thinking.values()) {
            if (thinking.sequence > maxSequence) {
                maxSequence = thinking.sequence;
            }
        }
        
        // Check tool calls
        for (const toolCall of this.state.toolCalls.values()) {
            if (toolCall.sequence > maxSequence) {
                maxSequence = toolCall.sequence;
            }
        }
        
        return maxSequence;
    }

    /**
     * Set usage information.
     */
    setUsage(usage: UsageInfo): void {
        this.state.usage = usage;
    }

    /**
     * Reset the processor state.
     */
    reset(): void {
        this.state = {
            run_id: '',
            messages: new Map(),
            thinking: new Map(),
            toolCalls: new Map(),
            isRunning: false,
            sequenceCounter: 0,
            usage: undefined,
        };
    }
}
