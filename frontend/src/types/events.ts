/**
 * Event types for the Lite Agent frontend.
 * Based on the Agent User Interaction Protocol (AG-UI).
 */

// ============================================================================
// Base Event
// ============================================================================

export interface BaseEvent {
    type: string;
    timestamp: string;
    rawEvent?: any;
}

// ============================================================================
// Lifecycle Events
// ============================================================================

export interface RunStarted extends BaseEvent {
    type: 'RunStarted';
    runId: string;
    sessionId?: string;
}

export interface RunFinished extends BaseEvent {
    type: 'RunFinished';
    runId: string;
    durationMs?: number;
    totalCostUsd?: number;
}

export interface RunError extends BaseEvent {
    type: 'RunError';
    runId: string;
    error: string;
    errorType?: string;
}

export interface StepStarted extends BaseEvent {
    type: 'StepStarted';
    stepId: string;
    runId: string;
    stepName?: string;
}

export interface StepFinished extends BaseEvent {
    type: 'StepFinished';
    stepId: string;
    runId: string;
    durationMs?: number;
}

// ============================================================================
// Text Message Events
// ============================================================================

export interface TextMessageStart extends BaseEvent {
    type: 'TextMessageStart';
    messageId: string;
    role: 'user' | 'assistant' | 'system';
}

export interface TextMessageContent extends BaseEvent {
    type: 'TextMessageContent';
    messageId: string;
    delta: string;
}

export interface TextMessageEnd extends BaseEvent {
    type: 'TextMessageEnd';
    messageId: string;
}

// ============================================================================
// Tool Call Events
// ============================================================================

export interface ToolCallStart extends BaseEvent {
    type: 'ToolCallStart';
    toolCallId: string;
    toolCallName: string;
    parentMessageId?: string;
}

export interface ToolCallArgs extends BaseEvent {
    type: 'ToolCallArgs';
    toolCallId: string;
    delta: string;
}

export interface ToolCallEnd extends BaseEvent {
    type: 'ToolCallEnd';
    toolCallId: string;
}

export interface ToolCallResult extends BaseEvent {
    type: 'ToolCallResult';
    messageId: string;
    toolCallId: string;
    content: any;
    role: 'tool';
    isError: boolean;
}

// ============================================================================
// Thinking/Reasoning Events
// ============================================================================

export interface ThinkingStart extends BaseEvent {
    type: 'ThinkingStart';
    thinkingId: string;
    parentMessageId?: string;
}

export interface ThinkingContent extends BaseEvent {
    type: 'ThinkingContent';
    thinkingId: string;
    delta: string;
}

export interface ThinkingEnd extends BaseEvent {
    type: 'ThinkingEnd';
    thinkingId: string;
}

// ============================================================================
// State Management Events
// ============================================================================

export interface StateSnapshot extends BaseEvent {
    type: 'StateSnapshot';
    state: Record<string, any>;
}

export interface StateDelta extends BaseEvent {
    type: 'StateDelta';
    delta: Record<string, any>;
}

// ============================================================================
// Custom/Extension Events
// ============================================================================

export interface AgentCustomEvent extends BaseEvent {
    type: string;
    data: Record<string, any>;
}

// ============================================================================
// Event Union Type
// ============================================================================

export type AgentEvent =
    | RunStarted
    | RunFinished
    | RunError
    | StepStarted
    | StepFinished
    | TextMessageStart
    | TextMessageContent
    | TextMessageEnd
    | ToolCallStart
    | ToolCallArgs
    | ToolCallEnd
    | ToolCallResult
    | ThinkingStart
    | ThinkingContent
    | ThinkingEnd
    | StateSnapshot
    | StateDelta
    | AgentCustomEvent;

// ============================================================================
// Event Handler Types
// ============================================================================

export type EventHandler<T extends AgentEvent = AgentEvent> = (event: T) => void;

export interface EventHandlers {
    onRunStarted?: EventHandler<RunStarted>;
    onRunFinished?: EventHandler<RunFinished>;
    onRunError?: EventHandler<RunError>;
    onStepStarted?: EventHandler<StepStarted>;
    onStepFinished?: EventHandler<StepFinished>;
    onTextMessageStart?: EventHandler<TextMessageStart>;
    onTextMessageContent?: EventHandler<TextMessageContent>;
    onTextMessageEnd?: EventHandler<TextMessageEnd>;
    onToolCallStart?: EventHandler<ToolCallStart>;
    onToolCallArgs?: EventHandler<ToolCallArgs>;
    onToolCallEnd?: EventHandler<ToolCallEnd>;
    onToolCallResult?: EventHandler<ToolCallResult>;
    onThinkingStart?: EventHandler<ThinkingStart>;
    onThinkingContent?: EventHandler<ThinkingContent>;
    onThinkingEnd?: EventHandler<ThinkingEnd>;
    onStateSnapshot?: EventHandler<StateSnapshot>;
    onStateDelta?: EventHandler<StateDelta>;
    onCustomEvent?: EventHandler<AgentCustomEvent>;
    onAnyEvent?: EventHandler<AgentEvent>;
}
