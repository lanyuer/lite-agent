
import React from 'react';
import { Session } from '../types';
import { Plus, Menu, LayoutGrid, Filter, Settings, HelpCircle, User } from 'lucide-react';

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  isMobile: boolean;
  onMockAction: (msg: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewSession,
  isOpen,
  toggleSidebar,
  isMobile,
  onMockAction
}) => {
  if (isMobile && !isOpen) return null;

  const sidebarClasses = isMobile 
    ? `fixed inset-y-0 left-0 z-40 w-[280px] shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
    : `relative w-[280px] flex-shrink-0 h-screen transition-all duration-300 ${isOpen ? 'ml-0' : '-ml-[280px]'}`;

  return (
    <>
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}
      
      <div className={`${sidebarClasses} bg-[#F9F9F7] flex flex-col h-full`}>
        {/* Header */}
        <div className="p-3 flex items-center justify-between shrink-0 mb-2">
          <div className="flex gap-2">
             {/* Sidebar toggle is mainly for mobile or collapsing, kept minimal here */}
             <button 
               onClick={toggleSidebar}
               className="p-2 rounded-md hover:bg-[#EAEAE7] text-text-sub transition-colors md:hidden"
             >
               <Menu size={20} />
             </button>
             {/* Code / Chat toggle (Visual only) */}
             <div className="flex bg-[#E6E6E3] p-0.5 rounded-lg">
                <button className="p-1.5 bg-white shadow-sm rounded-md text-text-main">
                    <div className="w-4 h-4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div>
                </button>
                <button className="p-1.5 text-text-sub hover:text-text-main transition-colors">
                     <div className="w-4 h-4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></div>
                </button>
             </div>
          </div>
          
          <button 
            onClick={onNewSession}
            className="p-2 rounded-full hover:bg-[#EAEAE7] text-[#DA7756] transition-colors active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Sessions Header */}
        <div className="px-4 py-2 flex items-center justify-between shrink-0 group cursor-pointer">
           <span className="text-sm font-medium text-text-main">Sessions</span>
           <Filter size={14} className="text-text-sub opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 scrollbar-hide">
          
          {sessions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center -mt-20">
              <span className="text-[13px] text-text-sub/50 font-medium">No sessions found</span>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`
                  group flex items-center px-3 py-2 rounded-lg cursor-pointer text-[13px] truncate select-none active:scale-[0.98] transition-all
                  ${currentSessionId === session.id 
                    ? 'bg-[#EAEAE7] text-text-main font-medium' 
                    : 'text-text-sub hover:bg-[#F0F0EB] hover:text-text-main'}
                `}
              >
                <span className="truncate flex-1">{session.title}</span>
                <span className="text-[10px] text-text-sub/40 ml-2 hidden group-hover:block">{new Date(session.lastActive).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer: User Profile */}
        <div className="p-4 mt-auto">
          <div 
             onClick={() => onMockAction('Profile Settings')}
             className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-black/10">
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover bg-white" />
            </div>
            <div className="text-[13px] font-medium text-text-main group-hover:text-[#DA7756] transition-colors">
              Maxgate
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
