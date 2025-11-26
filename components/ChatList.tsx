
import React, { useEffect, useRef, memo } from 'react';
import { Message } from '../types';
import { Bot, User, SquareTerminal, Download, Maximize2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatListProps {
  messages: Message[];
  isThinking: boolean;
  onOpenArtifact?: (content: string) => void;
}

// Memoized Message Component to prevent re-rendering massive base64 images on every keystroke
const MemoizedMessage = memo(({ msg, onOpenArtifact }: { msg: Message, onOpenArtifact?: (c: string) => void }) => {
  return (
    <div className="flex gap-4 animate-fade-in group">
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center mt-0.5 select-none transition-transform group-hover:scale-105 ${
        msg.role === 'assistant' ? 'bg-[#DA7756] text-white' : 'bg-[#E6E6E3] text-text-sub'
      }`}>
        {msg.role === 'assistant' ? (
            <Bot size={18} />
        ) : (
          <User size={18} />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 pt-1">
        <div className="font-medium text-[13px] text-text-main mb-1 select-none opacity-80">
          {msg.role === 'assistant' ? 'Agent' : 'You'}
        </div>
        
        <div className="text-[15px] leading-relaxed tracking-tight prose prose-p:text-text-main prose-a:text-accent-orange prose-pre:bg-[#F5F5F2] prose-pre:border prose-pre:border-[#E6E6E3] prose-pre:rounded-lg max-w-none">
          
          {/* Render User Attachment explicitly if it exists */}
          {msg.attachment && (
            <div className="mb-3 max-w-xs rounded-xl overflow-hidden border border-gray-200 shadow-sm">
               <img 
                 src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`}
                 alt="Uploaded Reference"
                 className="w-full h-auto block"
               />
            </div>
          )}

          <ReactMarkdown
              urlTransform={(value) => value} // Critical: Allow data: URIs
              components={{
                code({node, className, children, ...props}) {
                  return (
                    <code className={`${className} bg-black/5 px-1.5 py-0.5 rounded text-[0.9em] font-mono text-text-main`} {...props}>
                      {children}
                    </code>
                  )
                },
                pre({children}) {
                  return <pre className="not-prose bg-[#F5F5F2] border border-[#E6E6E3] rounded-lg p-3 overflow-x-auto text-sm my-3 font-mono shadow-sm">{children}</pre>
                },
                img({src, alt}) {
                  if (!src) return null;
                  return (
                    <div className="group/image relative my-4 rounded-xl overflow-hidden border border-gray-200/80 shadow-sm bg-gray-50 max-w-md">
                        {/* Glassmorphism overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/5 transition-colors pointer-events-none" />
                        
                        <img 
                          src={src} 
                          alt={alt || "Generated Image"} 
                          className="w-full h-auto object-cover block"
                          loading="lazy"
                        />
                        
                        {/* Image Actions */}
                        <div className="absolute bottom-3 right-3 flex gap-2 opacity-0 group-hover/image:opacity-100 transition-opacity transform translate-y-2 group-hover/image:translate-y-0 duration-200">
                          <button 
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = src;
                                link.download = 'generated-image.png';
                                link.click();
                            }}
                            className="p-1.5 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 rounded-lg shadow-md border border-gray-200/50"
                            title="Download"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                    </div>
                  );
                }
              }}
          >
            {msg.content}
          </ReactMarkdown>
          
          {/* Artifact Call-to-Action */}
          {msg.role === 'assistant' && msg.content.includes('```') && !msg.isStreaming && (
            <div 
              onClick={() => onOpenArtifact && onOpenArtifact(msg.content)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 hover:border-accent-orange/30 transition-all group/artifact"
            >
              <div className="p-1 bg-accent-orange/10 rounded-md text-accent-orange group-hover/artifact:bg-accent-orange/20">
                <SquareTerminal size={16} />
              </div>
              <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-text-main">Code Artifact</span>
                  <span className="text-[11px] text-text-sub">Click to view & run code</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  // Custom equality check for memoization
  // Only re-render if content changed or streaming status changed
  return prev.msg.content === next.msg.content && prev.msg.isStreaming === next.msg.isStreaming;
});

export const ChatList: React.FC<ChatListProps> = ({ messages, isThinking, onOpenArtifact }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollEnabled = useRef(true);

  // Smart Auto-scroll
  useEffect(() => {
    if (isAutoScrollEnabled.current) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  // Handle scroll events to disable auto-scroll if user scrolls up
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Tolerance of 50px
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAutoScrollEnabled.current = isAtBottom;
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide"
    >
      <div className="max-w-3xl mx-auto space-y-8 pb-4">
        {messages.map((msg) => (
          <MemoizedMessage 
            key={msg.id} 
            msg={msg} 
            onOpenArtifact={onOpenArtifact} 
          />
        ))}
        
        {/* Thinking State */}
        {isThinking && (
          <div className="flex gap-4 animate-fade-in pl-1">
             <div className="flex-shrink-0 w-8 h-8 rounded bg-[#DA7756] text-white flex items-center justify-center mt-1 shadow-sm">
               <Bot size={18} />
             </div>
             <div className="flex flex-col gap-1 pt-1">
               <div className="flex items-center gap-2">
                 <div className="flex items-center gap-1.5 h-6">
                   <span className="w-1.5 h-1.5 bg-accent-orange/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                   <span className="w-1.5 h-1.5 bg-accent-orange/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                   <span className="w-1.5 h-1.5 bg-accent-orange/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                 </div>
                 <span className="text-xs text-text-sub/70 font-medium animate-pulse">Formulating concept...</span>
               </div>
             </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
