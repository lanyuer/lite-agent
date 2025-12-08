import React, { useState } from 'react';
import { Terminal, CheckCircle, XCircle, ChevronDown, ChevronRight, Lightbulb, Loader2 } from 'lucide-react';
import type { MessageState, ThinkingState, ToolCallState } from '../lib/EventProcessor';
import { StreamingMarkdown } from './StreamingMarkdown';
import { StreamingText } from './StreamingText';
import './EventMessage.css';

interface EventMessageProps {
    message?: MessageState;
    thinking?: ThinkingState;
    toolCall?: ToolCallState;
    hideHeader?: boolean;
}

export const EventMessage: React.FC<EventMessageProps> = ({
    message,
    thinking,
    toolCall,
    hideHeader = false
}) => {
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
    const [isToolExpanded, setIsToolExpanded] = useState(false);

    // Render tool call (standalone) - Minimalist style
    if (toolCall && !message && !thinking) {
        return (
            <div className={`event-message assistant-message ${hideHeader ? 'no-header' : ''}`}>
                {!hideHeader && (
                    <div className="message-header">
                        <span className="sender-name">Lite Agent</span>
                    </div>
                )}
                <div className="message-body">
                    <div className="tool-call-section-minimal">
                        <button
                            className="tool-call-toggle-minimal"
                            onClick={() => setIsToolExpanded(!isToolExpanded)}
                        >
                            <Terminal size={14} className="icon-tool" />
                            <span className="tool-label-text">{toolCall.name}</span>
                            {toolCall.isComplete && (
                                toolCall.isError ? (
                                    <XCircle size={14} className="icon-error" />
                                ) : (
                                    <CheckCircle size={14} className="icon-success" />
                                )
                            )}
                            {isToolExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        
                        {isToolExpanded && (
                            <div className="tool-call-content-minimal">
                                {toolCall.args && (
                                    <div className="tool-section">
                                        <div className="tool-section-title">Arguments</div>
                                        <pre className="tool-section-content">{toolCall.args}</pre>
                                    </div>
                                )}
                                {toolCall.result && (
                                    <div className="tool-section">
                                        <div className="tool-section-title">Result</div>
                                        <pre className="tool-section-content">
                                            {typeof toolCall.result === 'string'
                                                ? toolCall.result
                                                : JSON.stringify(toolCall.result, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Render user message (standalone)
    if (message && message.role === 'user') {
        return (
            <div className="event-message user-message">
                {!hideHeader && (
                    <div className="message-header">
                        <span className="sender-name">User</span>
                    </div>
                )}
                <div className="message-body">
                    <div className="message-content">
                        {/* Render user message as plain text to avoid markdown formatting issues */}
                        {message.content}
                    </div>
                </div>
            </div>
        );
    }

    // Render assistant message with optional thinking (merged)
    if (message && message.role === 'assistant') {
        const hasThinking = thinking && thinking.content.trim().length > 0;
        const isThinkingRunning = thinking && !thinking.isComplete;

        return (
            <div className={`event-message assistant-message ${hideHeader ? 'no-header' : ''}`}>
                {!hideHeader && (
                    <div className="message-header">
                        <span className="sender-name">Lite Agent</span>
                    </div>
                )}
                
                <div className="message-body">
                    {/* Thinking section - Minimalist style */}
                    {hasThinking && (
                        <div className="thinking-section-minimal">
                            <button
                                className="thinking-toggle-minimal"
                                onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                            >
                                {isThinkingRunning ? (
                                    <Loader2 size={14} className="icon-thinking spin-animation" />
                                ) : (
                                    <Lightbulb size={14} className="icon-complete" />
                                )}
                                <span className="thinking-label-text">
                                    Thinking Process
                                </span>
                                {isThinkingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            
                            {isThinkingExpanded && (
                                <div className="thinking-content-minimal">
                                    {thinking.isComplete ? (
                                        <div className="thinking-text">{thinking.content}</div>
                                    ) : (
                                        <div className="thinking-text">
                                            <StreamingText text={thinking.content} speed={10} interval={10} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Main message content */}
                    <div className="message-content-wrapper">
                        {message.isComplete ? (
                            <div className="message-content">
                                <StreamingMarkdown text={message.content} speed={5} interval={20} />
                            </div>
                        ) : (
                            <div className="message-content streaming">
                                <StreamingMarkdown text={message.content} speed={5} interval={20} />
                                <span className="cursor">▊</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Render standalone thinking (fallback)
    if (thinking && !message) {
        const isThinkingRunning = !thinking.isComplete;
        
        return (
            <div className={`event-message assistant-message ${hideHeader ? 'no-header' : ''}`}>
                {!hideHeader && (
                    <div className="message-header">
                        <span className="sender-name">Lite Agent</span>
                    </div>
                )}
                <div className="message-body">
                    <div className="thinking-section-minimal">
                        <button
                            className="thinking-toggle-minimal"
                            onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        >
                            {isThinkingRunning ? (
                                <Loader2 size={14} className="icon-thinking spin-animation" />
                            ) : (
                                <Lightbulb size={14} className="icon-complete" />
                            )}
                            <span className="thinking-label-text">
                                Thinking Process
                            </span>
                            {isThinkingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        
                        {(isThinkingExpanded || isThinkingRunning) && (
                            <div className="thinking-content-minimal">
                                <div className="thinking-text">
                                    <StreamingText text={thinking.content} speed={10} interval={10} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
