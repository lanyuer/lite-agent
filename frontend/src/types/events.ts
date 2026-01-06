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
    raw_event?: any;
}

// ============================================================================
// Lifecycle Events
// ============================================================================

export interface RunStarted extends BaseEvent {
    type: 'RunStarted';
    run_id: string;
    session_id?: string;
}

export interface RunFinished extends BaseEvent {
    type: 'RunFinished';
    run_id: string;
    duration_ms?: number;
    total_cost_usd?: number;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        total_cost_usd?: number;
        [key: string]: any;
    };
}

export interface RunError extends BaseEvent {
    type: 'RunError';
    run_id: string;
    error: string;
    error_type?: string;
}

export interface StepStarted extends BaseEvent {
    type: 'StepStarted';
    step_id: string;
    run_id: string;
    step_name?: string;
}

export interface StepFinished extends BaseEvent {
    type: 'StepFinished';
    step_id: string;
    run_id: string;
    duration_ms?: number;
}

// ============================================================================
// Text Message Events
// ============================================================================

export interface TextMessageStart extends BaseEvent {
    type: 'TextMessageStart';
    message_id: string;
    role: 'user' | 'assistant' | 'system';
}

export interface TextMessageContent extends BaseEvent {
    type: 'TextMessageContent';
    message_id: string;
    delta: string;
}

export interface TextMessageEnd extends BaseEvent {
    type: 'TextMessageEnd';
    message_id: string;
}

// ============================================================================
// Tool Call Events
// ============================================================================

export interface ToolCallStart extends BaseEvent {
    type: 'ToolCallStart';
    tool_call_id: string;
    tool_call_name: string;
    parent_message_id?: string;
}

export interface ToolCallArgs extends BaseEvent {
    type: 'ToolCallArgs';
    tool_call_id: string;
    delta: string;
}

export interface ToolCallEnd extends BaseEvent {
    type: 'ToolCallEnd';
    tool_call_id: string;
}

export interface ToolCallResult extends BaseEvent {
    type: 'ToolCallResult';
    message_id: string;
    tool_call_id: string;
    content: any;
    role: 'tool';
    is_error: boolean;
    metadata?: {
        content_type?: string; // 'image' | 'video' | 'audio' | 'url' | 'json' | 'text' | 'file' | 'list' | 'unknown'
        media_type?: string; // MIME type (e.g., 'image/jpeg', 'image/png')
        url?: string; // URL for remote resources
        data?: any; // Additional data (base64, JSON, etc.)
        encoding?: string; // 'base64' for base64-encoded content
        file_path?: string; // File path for local files
        source_key?: string; // Key in JSON that contains the content
        items?: any[]; // For list types
    };
}

// ============================================================================
// Thinking/Reasoning Events
// ============================================================================

export interface ThinkingStart extends BaseEvent {
    type: 'ThinkingStart';
    thinking_id: string;
    parent_message_id?: string;
}

export interface ThinkingContent extends BaseEvent {
    type: 'ThinkingContent';
    thinking_id: string;
    delta: string;
}

export interface ThinkingEnd extends BaseEvent {
    type: 'ThinkingEnd';
    thinking_id: string;
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
// Generative UI Events (AG-UI Protocol)
// ============================================================================

export interface UIComponent extends BaseEvent {
    type: 'UIComponent';
    component_id: string;
    component_type: string; // e.g., 'button', 'image', 'form', 'card', 'chart', etc.
    props: Record<string, any>; // Component properties
    children?: Array<Record<string, any>>; // Nested components
    constraints?: Record<string, any>; // Validation constraints
    parent_component_id?: string; // For nested components
    message_id?: string; // Associated message
}

export interface UIUpdate extends BaseEvent {
    type: 'UIUpdate';
    component_id: string;
    props: Record<string, any>; // Updated properties
    merge?: boolean; // Whether to merge with existing props
}

export interface UIRemove extends BaseEvent {
    type: 'UIRemove';
    component_id: string;
}

export interface UIInteraction extends BaseEvent {
    type: 'UIInteraction';
    component_id: string;
    interaction_type: string; // e.g., 'click', 'submit', 'change', 'focus', etc.
    data: Record<string, any>; // Interaction data
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
    | UIComponent
    | UIUpdate
    | UIRemove
    | UIInteraction
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
    onUIComponent?: EventHandler<UIComponent>;
    onUIUpdate?: EventHandler<UIUpdate>;
    onUIRemove?: EventHandler<UIRemove>;
    onUIInteraction?: EventHandler<UIInteraction>;
    onCustomEvent?: EventHandler<AgentCustomEvent>;
    onAnyEvent?: EventHandler<AgentEvent>;
}
