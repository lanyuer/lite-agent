
import React, { useState, useRef } from 'react';
import { ArrowUp, Paperclip, X } from 'lucide-react';

interface FloatingInputProps {
  onSend: (text: string, attachment?: { mimeType: string; data: string }) => void;
  disabled?: boolean;
  onMockAction: (msg: string) => void;
}

export const FloatingInput: React.FC<FloatingInputProps> = ({ onSend, disabled, onMockAction }) => {
  const [value, setValue] = useState('');
  const [attachment, setAttachment] = useState<{ mimeType: string; data: string; previewUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || attachment) && !disabled) {
        handleSend();
      }
    }
  };

  const handleSend = () => {
    if ((value.trim() || attachment) && !disabled) {
      onSend(value, attachment ? { mimeType: attachment.mimeType, data: attachment.data } : undefined);
      setValue('');
      setAttachment(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        onMockAction('Only image files are supported');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64Data = (evt.target?.result as string).split(',')[1];
        setAttachment({
          mimeType: file.type,
          data: base64Data,
          previewUrl: URL.createObjectURL(file)
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 pb-6 pt-2 shrink-0">
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-accent-orange/20 focus-within:border-accent-orange/50 transition-all flex flex-col">
        
        {/* Attachment Preview */}
        {attachment && (
          <div className="px-3 pt-3 pb-0">
            <div className="relative inline-block">
              <img 
                src={attachment.previewUrl} 
                alt="Preview" 
                className="h-16 w-auto rounded-lg border border-gray-200 object-cover"
              />
              <button 
                onClick={() => setAttachment(null)}
                className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white rounded-full p-0.5 hover:bg-gray-700 transition-colors shadow-sm"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply to Agent..."
          disabled={disabled}
          className="w-full p-3 pr-12 max-h-[200px] min-h-[50px] bg-transparent resize-none outline-none text-[16px] md:text-[15px] placeholder:text-gray-400"
          rows={1}
          style={{ height: 'auto', minHeight: '52px' }}
        />
        
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept="image/*"
            onChange={handleFileSelect}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-gray-400 hover:text-text-main rounded-lg transition-colors active:bg-gray-100"
            title="Attach image"
          >
            <Paperclip size={18} />
          </button>
           <button 
             onClick={handleSend}
             disabled={(!value.trim() && !attachment) || disabled}
             className={`p-1.5 rounded-lg transition-colors active:scale-95 ${
               (value.trim() || attachment) ? 'bg-[#DA7756] text-white' : 'bg-gray-100 text-gray-300'
             }`}
           >
             <ArrowUp size={18} />
           </button>
        </div>
      </div>
      <div className="text-center mt-2">
         <p className="text-[11px] text-gray-400">Agent can make mistakes. Please use with caution.</p>
      </div>
    </div>
  );
};
