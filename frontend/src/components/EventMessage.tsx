import React, { useState } from 'react';
import { Terminal, CheckCircle, XCircle, ChevronDown, ChevronRight, Lightbulb, Loader2 } from 'lucide-react';
import type { MessageState, ThinkingState, ToolCallState, UIComponentState } from '../lib/EventProcessor';
import { StreamingMarkdown } from './StreamingMarkdown';
import { StreamingText } from './StreamingText';
import { CostDisplay } from './CostDisplay';
import { ToolResultRenderer } from './ToolResultRenderer';
import { GenerativeUI } from './GenerativeUI';
import type { UIComponent } from '../types/events';
import './EventMessage.css';

interface EventMessageProps {
    message?: MessageState;
    thinking?: ThinkingState;
    toolCall?: ToolCallState;
    uiComponents?: UIComponentState[]; // Generative UI components associated with this message
    hideHeader?: boolean;
    usage?: any; // Usage information for cost display
    cumulativeUsage?: {
        total_cost_usd?: number;
        total_input_tokens?: number;
        total_output_tokens?: number;
    };
    showCumulative?: boolean; // Whether to show cumulative usage
    onUIInteraction?: (componentId: string, interactionType: string, data: any) => void;
}

export const EventMessage: React.FC<EventMessageProps> = ({
    message,
    thinking,
    toolCall,
    uiComponents = [],
    hideHeader = false,
    usage,
    cumulativeUsage,
    showCumulative = false,
    onUIInteraction
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
                                        <div className="tool-section-content">
                                            <ToolResultRenderer
                                                result={toolCall.result}
                                                metadata={toolCall.metadata}
                                                isError={toolCall.isError}
                                            />
                                        </div>
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

                    {/* Generative UI Components */}
                    {uiComponents && uiComponents.length > 0 && (
                        <div className="generative-ui-section">
                            {uiComponents.map((uiComp) => {
                                // Convert UIComponentState to UIComponent format
                                const component: UIComponent = {
                                    type: 'UIComponent',
                                    timestamp: new Date().toISOString(),
                                    component_id: uiComp.component_id,
                                    component_type: uiComp.component_type,
                                    props: uiComp.props,
                                    children: uiComp.children,
                                    constraints: uiComp.constraints,
                                    parent_component_id: uiComp.parent_component_id,
                                    message_id: uiComp.message_id,
                                };
                                return (
                                    <GenerativeUI
                                        key={uiComp.component_id}
                                        component={component}
                                        onInteraction={onUIInteraction}
                                    />
                                );
                            })}
                        </div>
                    )}
                    
                    {/* Show cost info when message is complete */}
                    {message.isComplete && (usage || (showCumulative && cumulativeUsage)) && (
                        <CostDisplay 
                            usage={usage} 
                            cumulativeUsage={cumulativeUsage}
                            showCumulative={showCumulative}
                        />
                    )}
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
