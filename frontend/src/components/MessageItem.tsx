import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, Terminal, Cpu, CheckCircle, XCircle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { StreamingText } from './StreamingText';
import { StreamingMarkdown } from './StreamingMarkdown';
import './MessageItem.css';

interface MessageProps {
    message: any;
}

const CollapsibleBlock: React.FC<{
    title: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    className?: string;
    headerClassName?: string;
}> = ({ title, children, defaultOpen = false, className = '', headerClassName = '' }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`collapsible-block ${className}`}>
            <div
                className={`collapsible-header ${headerClassName}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="header-content">{title}</div>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {isOpen && <div className="collapsible-content">{children}</div>}
        </div>
    );
};

export const MessageItem: React.FC<MessageProps> = ({ message }) => {
    const msgObj = useMemo(() => {
        if (typeof message === 'string') {
            try {
                return JSON.parse(message);
            } catch (e) {
                return { type: 'Unknown', content: message };
            }
        }
        return message;
    }, [message]);

    // Determine role and type
    const type = msgObj.type || 'Unknown';
    const role = msgObj.role || (type === 'UserMessage' ? 'user' : type === 'SystemMessage' ? 'system' : 'assistant');
    const isUser = role === 'user';
    const isSystem = role === 'system';

    const renderBlock = (block: any, idx: string | number): React.ReactNode => {
        if (!block) return null;

        // Handle nested Message objects (AssistantMessage, etc.)
        if (block.content && Array.isArray(block.content)) {
            return (
                <div key={idx} className="nested-message">
                    {block.content.map((subBlock: any, subIdx: number) => renderBlock(subBlock, `${idx}-${subIdx}`))}
                </div>
            );
        }

        // Handle ThinkingBlock
        if (block.type === 'thinking' || block.thinking) {
            return (
                <CollapsibleBlock
                    key={idx}
                    title={
                        <div className="thinking-header-inner">
                            <Cpu size={14} />
                            <span>Thinking Process</span>
                        </div>
                    }
                    defaultOpen={true}
                    className="thinking-block"
                    headerClassName="thinking-header"
                >
                    <div className="thinking-content">
                        <StreamingText text={block.thinking} speed={5} interval={20} />
                    </div>
                </CollapsibleBlock>
            );
        }

        // Handle ToolUseBlock
        if (block.type === 'tool_use' || block.tool_use_id) {
            return (
                <div key={idx} className="tool-use-block">
                    <div className="tool-header">
                        <Terminal size={14} />
                        <span>Used Tool: <strong>{block.name}</strong></span>
                    </div>
                    <div className="tool-input-container">
                        <pre className="tool-input">{JSON.stringify(block.input, null, 2)}</pre>
                    </div>
                </div>
            );
        }

        // Handle ToolResultBlock
        if (block.type === 'tool_result' || (block.tool_use_id && block.content !== undefined)) {
            const isError = block.is_error;
            return (
                <CollapsibleBlock
                    key={idx}
                    title={
                        <div className="tool-result-header-inner">
                            {isError ? <XCircle size={14} className="text-red-500" /> : <CheckCircle size={14} className="text-green-500" />}
                            <span>Tool Result</span>
                        </div>
                    }
                    defaultOpen={false}
                    className={`tool-result-block ${isError ? 'error' : ''}`}
                    headerClassName="tool-result-header"
                >
                    <pre className="tool-output">{typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2)}</pre>
                </CollapsibleBlock>
            );
        }

        // Handle SystemMessage
        if (block.type === 'SystemMessage') {
            return (
                <CollapsibleBlock
                    key={idx}
                    title={
                        <div className="system-indicator">
                            <Info size={14} />
                            <span>System: {block.subtype || 'Info'}</span>
                        </div>
                    }
                    defaultOpen={false}
                    className="system-message-block"
                    headerClassName="system-header"
                >
                    <pre className="system-content">{JSON.stringify(block.data || block, null, 2)}</pre>
                </CollapsibleBlock>
            );
        }

        // Handle ResultMessage
        if (block.type === 'ResultMessage') {
            // ResultMessage typically contains summary info, not the actual response
            // We'll show it as a collapsible metadata block
            const metadata = {
                subtype: block.subtype,
                duration_ms: block.duration_ms,
                is_error: block.is_error,
                num_turns: block.num_turns,
                total_cost_usd: block.total_cost_usd,
            };

            return (
                <CollapsibleBlock
                    key={idx}
                    title={
                        <div className="result-header-inner">
                            {block.is_error ? <XCircle size={14} className="text-red-500" /> : <CheckCircle size={14} className="text-green-500" />}
                            <span>Session Result: {block.subtype}</span>
                            {block.duration_ms && <span className="duration-badge">{(block.duration_ms / 1000).toFixed(2)}s</span>}
                        </div>
                    }
                    defaultOpen={false}
                    className="result-message-block"
                    headerClassName="result-header"
                >
                    <pre className="result-metadata">{JSON.stringify(metadata, null, 2)}</pre>
                </CollapsibleBlock>
            );
        }

        // Handle TextBlock
        if (block.type === 'text' || block.text) {
            return (
                <div key={idx} className="text-block">
                    <StreamingMarkdown text={block.text} speed={5} interval={20} />
                </div>
            );
        }

        // Handle simple string block
        if (typeof block === 'string') {
            return <div key={idx} className="text-block"><ReactMarkdown>{block}</ReactMarkdown></div>;
        }

        // Fallback
        return (
            <div key={idx} className="unknown-block">
                <pre>{JSON.stringify(block, null, 2)}</pre>
            </div>
        );
    };

    const renderContent = () => {
        const content = msgObj.content;

        if (Array.isArray(content)) {
            return content.map((block: any, idx: number) => renderBlock(block, idx));
        } else if (typeof content === 'string') {
            return <div className="text-block"><ReactMarkdown>{content}</ReactMarkdown></div>;
        } else {
            return <pre>{JSON.stringify(content, null, 2)}</pre>;
        }
    };

    if (isSystem) {
        return (
            <div className="message system">
                <div className="system-indicator">
                    <Info size={14} />
                    <span>System Message</span>
                </div>
                <div className="message-body system-body">
                    {renderContent()}
                </div>
            </div>
        );
    }

    return (
        <div className={`message ${isUser ? 'user' : 'assistant'}`}>
            <div className="avatar">
                {isUser ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className="message-body">
                {renderContent()}
            </div>
        </div>
    );
};
