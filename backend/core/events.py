"""
Event types for the Lite Agent system.
Based on the Agent User Interaction Protocol (AG-UI).
"""

from typing import Literal, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


# ============================================================================
# Base Event
# ============================================================================

class BaseEvent(BaseModel):
    """Base class for all events."""
    model_config = ConfigDict(populate_by_name=True, alias_generator=lambda x: ''.join(word.capitalize() if i > 0 else word for i, word in enumerate(x.split('_'))))
    
    type: str
    timestamp: datetime = Field(default_factory=datetime.now)
    raw_event: Optional[Dict[str, Any]] = Field(default=None, alias='rawEvent')


# ============================================================================
# Lifecycle Events
# ============================================================================

class RunStarted(BaseEvent):
    """Emitted when an agent run starts."""
    type: Literal["RunStarted"] = "RunStarted"
    run_id: str
    session_id: Optional[str] = None


class RunFinished(BaseEvent):
    """Emitted when an agent run completes successfully."""
    type: Literal["RunFinished"] = "RunFinished"
    run_id: str
    duration_ms: Optional[int] = None
    total_cost_usd: Optional[float] = None


class RunError(BaseEvent):
    """Emitted when an agent run encounters an error."""
    type: Literal["RunError"] = "RunError"
    run_id: str
    error: str
    error_type: Optional[str] = None


class StepStarted(BaseEvent):
    """Emitted when a step within a run starts."""
    type: Literal["StepStarted"] = "StepStarted"
    step_id: str
    run_id: str
    step_name: Optional[str] = None


class StepFinished(BaseEvent):
    """Emitted when a step completes."""
    type: Literal["StepFinished"] = "StepFinished"
    step_id: str
    run_id: str
    duration_ms: Optional[int] = None


# ============================================================================
# Text Message Events
# ============================================================================

class TextMessageStart(BaseEvent):
    """Emitted when a text message begins."""
    type: Literal["TextMessageStart"] = "TextMessageStart"
    message_id: str
    role: Literal["user", "assistant", "system"] = "assistant"


class TextMessageContent(BaseEvent):
    """Emitted for each chunk of text content."""
    type: Literal["TextMessageContent"] = "TextMessageContent"
    message_id: str
    delta: str  # The incremental text content


class TextMessageEnd(BaseEvent):
    """Emitted when a text message completes."""
    type: Literal["TextMessageEnd"] = "TextMessageEnd"
    message_id: str


# ============================================================================
# Tool Call Events
# ============================================================================

class ToolCallStart(BaseEvent):
    """Emitted when a tool call begins."""
    type: Literal["ToolCallStart"] = "ToolCallStart"
    tool_call_id: str
    tool_call_name: str
    parent_message_id: Optional[str] = None


class ToolCallArgs(BaseEvent):
    """Emitted for streaming tool arguments."""
    type: Literal["ToolCallArgs"] = "ToolCallArgs"
    tool_call_id: str
    delta: str  # Incremental JSON arguments


class ToolCallEnd(BaseEvent):
    """Emitted when a tool call completes."""
    type: Literal["ToolCallEnd"] = "ToolCallEnd"
    tool_call_id: str


class ToolCallResult(BaseEvent):
    """Emitted when a tool returns a result."""
    type: Literal["ToolCallResult"] = "ToolCallResult"
    message_id: str
    tool_call_id: str
    content: Any
    role: Literal["tool"] = "tool"
    is_error: bool = False


# ============================================================================
# Thinking/Reasoning Events
# ============================================================================

class ThinkingStart(BaseEvent):
    """Emitted when thinking/reasoning begins."""
    type: Literal["ThinkingStart"] = "ThinkingStart"
    thinking_id: str
    parent_message_id: Optional[str] = None


class ThinkingContent(BaseEvent):
    """Emitted for streaming thinking content."""
    type: Literal["ThinkingContent"] = "ThinkingContent"
    thinking_id: str
    delta: str


class ThinkingEnd(BaseEvent):
    """Emitted when thinking completes."""
    type: Literal["ThinkingEnd"] = "ThinkingEnd"
    thinking_id: str


# ============================================================================
# State Management Events
# ============================================================================

class StateSnapshot(BaseEvent):
    """Complete state snapshot."""
    type: Literal["StateSnapshot"] = "StateSnapshot"
    state: Dict[str, Any]


class StateDelta(BaseEvent):
    """Incremental state change."""
    type: Literal["StateDelta"] = "StateDelta"
    delta: Dict[str, Any]


# ============================================================================
# Custom/Extension Events
# ============================================================================

class CustomEvent(BaseEvent):
    """Custom event for extensions."""
    type: str  # Custom type name
    data: Dict[str, Any]


# ============================================================================
# Event Union Type
# ============================================================================

AgentEvent = (
    RunStarted | RunFinished | RunError |
    StepStarted | StepFinished |
    TextMessageStart | TextMessageContent | TextMessageEnd |
    ToolCallStart | ToolCallArgs | ToolCallEnd | ToolCallResult |
    ThinkingStart | ThinkingContent | ThinkingEnd |
    StateSnapshot | StateDelta |
    CustomEvent
)
