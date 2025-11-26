import React, { useState } from 'react';
import { X, Copy, Download, Code, Eye, Terminal, Check } from 'lucide-react';

interface ArtifactPanelProps {
  content: string;
  onClose: () => void;
  onMockAction: (msg: string) => void;
  isMobile: boolean;
}

export const ArtifactPanel: React.FC<ArtifactPanelProps> = ({ content, onClose, onMockAction, isMobile }) => {
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [isCopied, setIsCopied] = useState(false);

  // Extract code from markdown block if present
  const codeContent = content.match(/```(?:\w+)?\n([\s\S]*?)```/)?.[1] || content;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setIsCopied(true);
    onMockAction('Copied to clipboard');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-border-sub animate-slide-in shadow-xl w-full">
      {/* Panel Header */}
      <div className="h-14 md:h-12 border-b border-border-sub flex items-center justify-between px-4 bg-[#FAFAFA] shrink-0">
        <div className="flex items-center gap-2 text-sm text-text-sub">
          <span className="font-medium text-text-main">React Component</span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span className="text-xs">Generated</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleCopy}
            className="p-2 md:p-1.5 hover:bg-gray-200 rounded text-text-sub transition-colors active:scale-95" 
            title="Copy code"
          >
            {isCopied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
          <button 
            onClick={() => onMockAction('Download started')}
            className="p-2 md:p-1.5 hover:bg-gray-200 rounded text-text-sub transition-colors active:scale-95" 
            title="Download"
          >
            <Download size={16} />
          </button>
          <div className="w-px h-4 bg-gray-300 mx-1"></div>
          <button 
            onClick={onClose} 
            className="p-2 md:p-1.5 hover:bg-gray-200 rounded text-text-sub transition-colors active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 bg-white border-b border-border-sub flex gap-4 shrink-0">
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md transition-colors active:scale-95 ${
            activeTab === 'code' 
              ? 'bg-[#F0F0EB] text-text-main' 
              : 'text-text-sub hover:bg-[#F9F9F7]'
          }`}
        >
          <Code size={14} />
          Code
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md transition-colors active:scale-95 ${
            activeTab === 'preview' 
              ? 'bg-[#F0F0EB] text-text-main' 
              : 'text-text-sub hover:bg-[#F9F9F7]'
          }`}
        >
          <Eye size={14} />
          Preview
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-[#FBFBFB] relative">
        {activeTab === 'code' ? (
          <div className="p-4 font-mono text-sm leading-relaxed overflow-x-auto">
             <pre className="text-text-main whitespace-pre-wrap break-all md:whitespace-pre md:break-normal">{codeContent}</pre>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-text-sub">
            <div className="w-full max-w-md bg-white border border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center text-center">
              <Terminal size={48} className="mb-4 text-gray-300" />
              <h3 className="text-sm font-medium text-text-main mb-2">Preview Mode</h3>
              <p className="text-xs text-text-sub max-w-[200px]">
                This is a mock preview environment. In a real app, the component would render here.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer Status */}
      <div className="h-8 border-t border-border-sub bg-white flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-text-sub">
             <div className="w-2 h-2 rounded-full bg-green-500"></div>
             <span>Ready</span>
          </div>
          <div className="text-[10px] text-text-sub font-mono">
             TypeScript • React
          </div>
      </div>
    </div>
  );
};