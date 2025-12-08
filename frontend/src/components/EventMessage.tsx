import React from 'react';
import { User, Bot, Terminal, Cpu, CheckCircle, XCircle } from 'lucide-react';
import type { MessageState, ThinkingState, ToolCallState } from '../lib/EventProcessor';
import { StreamingMarkdown } from './StreamingMarkdown';
import { StreamingText } from './StreamingText';
import './EventMessage.css';

interface EventMessageProps {
    message?: MessageState;
    thinking?: ThinkingState;
    toolCall?: ToolCallState;
}

export const EventMessage: React.FC<EventMessageProps> = ({
    message,
    thinking,
    toolCall
}) => {
    // Render thinking block
    if (thinking) {
        return (
            <div className="event-message thinking">
                <div className="event-avatar thinking-avatar">
                    <Cpu size={20} />
                </div>
                <div className="event-body">
                    <div className="thinking-label">Thinking...</div>
                    <div className="thinking-content">
                        {thinking.isComplete ? (
                            <pre>{thinking.content}</pre>
                        ) : (
                            <pre><StreamingText text={thinking.content} speed={10} interval={10} /></pre>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Render tool call
    if (toolCall) {
        return (
            <div className="event-message tool-call">
                <div className="event-avatar tool-avatar">
                    <Terminal size={20} />
                </div>
                <div className="event-body">
                    <div className="tool-header">
                        <span className="tool-name">{toolCall.name}</span>
                        {toolCall.isComplete && (
                            <span className="tool-status">
                                {toolCall.isError ? (
                                    <XCircle size={14} className="text-red-500" />
                                ) : (
                                    <CheckCircle size={14} className="text-green-500" />
                                )}
                            </span>
                        )}
                    </div>
                    {toolCall.args && (
                        <details className="tool-details">
                            <summary>Arguments</summary>
                            <pre className="tool-args">{toolCall.args}</pre>
                        </details>
                    )}
                    {toolCall.result && (
                        <details className="tool-details">
                            <summary>Result</summary>
                            <pre className="tool-result">
                                {typeof toolCall.result === 'string'
                                    ? toolCall.result
                                    : JSON.stringify(toolCall.result, null, 2)}
                            </pre>
                        </details>
                    )}
                </div>
            </div>
        );
    }

    // Render message
    if (message) {
        const isUser = message.role === 'user';

        return (
            <div className={`event-message ${isUser ? 'user' : 'assistant'}`}>
                <div className={`event-avatar ${isUser ? 'user-avatar' : 'assistant-avatar'}`}>
                    {isUser ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className="event-body">
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
        );
    }

    return null;
};
