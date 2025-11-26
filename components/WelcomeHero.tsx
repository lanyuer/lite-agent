
import React, { useState } from 'react';
import { ArrowUp, Image as ImageIcon, ChevronDown, Monitor, Palette, Gamepad2, ShoppingBag } from 'lucide-react';

interface WelcomeHeroProps {
  onSend: (text: string) => void;
  onMockAction: (msg: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({ onSend, onMockAction, selectedModel, onSelectModel }) => {
  const [inputValue, setInputValue] = useState('');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) onSend(inputValue);
    }
  };

  const models = [
    { id: 'gemini-2.5-flash-image', name: 'Nano Banana (Image)', icon: '🍌', desc: 'Fast multimodal generation' },
    { id: 'gemini-2.5-flash', name: 'Gemini Flash', icon: '⚡', desc: 'High speed text tasks' },
    { id: 'gemini-3-pro-preview', name: 'Gemini Pro', icon: '🧠', desc: 'Complex reasoning' },
  ];

  const activeModel = models.find(m => m.id === selectedModel) || models[0];

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4 w-full animate-fade-in pb-12">
      
      {/* Brand Icon: Multimodal Palette */}
      <div className="mb-8 transform hover:scale-105 transition-transform duration-300 cursor-pointer" onClick={() => onMockAction('System: Multimodal Online')}>
        <div className="w-16 h-16 bg-gradient-to-br from-[#DA7756] to-[#E89E86] rounded-xl relative shadow-sm flex items-center justify-center text-white">
            <Palette size={32} />
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-medium text-text-main mb-2">Multimodal Creative Studio</h1>
        <p className="text-text-sub text-sm">Generate assets for E-commerce, Games, and Social Media.</p>
      </div>

      {/* Context Selectors */}
      <div className="flex items-center gap-3 mb-4 w-full max-w-[600px] text-sm relative z-20">
        <div className="relative">
          <button 
            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-transparent hover:bg-gray-50 text-text-main font-medium transition-colors shadow-sm"
          >
            <span className="text-base">{activeModel.icon}</span>
            <span>{activeModel.name}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {isModelMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden py-1 animate-fade-in">
              {models.map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    onSelectModel(model.id);
                    setIsModelMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <span className="text-xl">{model.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-text-main">{model.name}</div>
                    <div className="text-[11px] text-text-sub">{model.desc}</div>
                  </div>
                  {selectedModel === model.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#DA7756]"></div>}
                </button>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={() => onMockAction('Context Selector')}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#E6E4DD] rounded-lg text-text-main font-medium hover:bg-[#Dddbcf] transition-colors"
        >
          <Monitor size={14} />
          <span>Canvas Context</span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
      </div>

      {/* Main Input */}
      <div className="w-full max-w-[600px] bg-white rounded-2xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-accent-orange/10 focus-within:border-accent-orange/40 transition-all overflow-hidden relative group mb-6">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe an image to generate (e.g., 'A futuristic sneaker poster')..."
          className="w-full p-4 min-h-[100px] resize-none outline-none text-[15px] text-text-main placeholder:text-gray-400 font-sans bg-transparent leading-relaxed"
        />
        
        {/* Footer */}
        <div className="px-3 pb-3 flex items-center justify-between mt-2">
           <div className="flex-1"></div>
           <div className="flex items-center gap-3">
             <button 
               onClick={() => onMockAction('Image Upload')}
               className="flex items-center gap-1.5 text-xs font-medium text-text-sub hover:text-text-main px-2 py-1 rounded transition-colors"
             >
                <ImageIcon size={16} />
                <span>Reference</span>
             </button>

             <button 
               onClick={() => inputValue.trim() && onSend(inputValue)}
               disabled={!inputValue.trim()}
               className={`p-1.5 rounded-lg transition-all duration-200 ${
                 inputValue.trim() 
                   ? 'bg-[#DA7756] text-white shadow-md hover:bg-[#C66545]' 
                   : 'bg-gray-100 text-gray-300'
               }`}
             >
               <ArrowUp size={18} strokeWidth={2.5} />
             </button>
          </div>
        </div>
      </div>

      {/* Suggestion Cards */}
      <div className="flex flex-row gap-3 w-full max-w-[600px] overflow-x-auto pb-2 scrollbar-hide">
        {/* Card 1 */}
        <button 
          onClick={() => onSend('Generate a minimalist poster for a high-end coffee brand')}
          className="flex-1 min-w-[140px] p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all text-left shadow-sm h-full flex flex-col justify-between group"
        >
            <div className="mb-2 w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
            <div className="text-[13px] text-text-main leading-snug font-medium">
               Design an <span className="font-semibold text-[#DA7756]">E-commerce Poster</span> for a coffee brand
            </div>
        </button>

        {/* Card 2 */}
        <button 
          onClick={() => onSend('Create a pixel art sprite sheet for a fantasy knight character')}
          className="flex-1 min-w-[140px] p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all text-left shadow-sm h-full flex flex-col justify-between group"
        >
            <div className="mb-2 w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <Gamepad2 size={16} />
            </div>
            <div className="text-[13px] text-text-main leading-snug font-medium">
               Create <span className="font-semibold text-purple-600">Game Assets</span> for a fantasy character
            </div>
        </button>

        {/* Card 3 */}
        <button 
          onClick={() => onSend('Generate an educational infographic about the solar system')}
          className="flex-1 min-w-[140px] p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all text-left shadow-sm h-full flex flex-col justify-between group"
        >
             <div className="mb-2 w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Monitor size={16} />
            </div>
            <div className="text-[13px] text-text-main leading-snug font-medium">
               Make an <span className="font-semibold text-blue-600">Educational</span> graphic about space
            </div>
        </button>
      </div>
    </div>
  );
};
