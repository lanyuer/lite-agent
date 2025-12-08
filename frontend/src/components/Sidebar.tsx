import React from 'react';
import {
    Plus,
    Search,
    Library,
    FolderPlus,
    Settings,
    PanelLeftClose,
    PanelLeft,
    MessageSquare
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
    isOpen: boolean;
    toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
    return (
        <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
            <div className="sidebar-header">
                <div className="brand">
                    <span className="brand-icon">L</span>
                    <span className="brand-name">Lite Agent</span>
                </div>
                <button className="toggle-btn" onClick={toggleSidebar}>
                    {isOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
                </button>
            </div>

            <div className="sidebar-content">
                <button className="new-task-btn">
                    <Plus size={18} />
                    <span>New Task</span>
                </button>

                <div className="nav-group">
                    <div className="nav-item">
                        <Search size={18} />
                        <span>Search</span>
                    </div>
                    <div className="nav-item">
                        <Library size={18} />
                        <span>Library</span>
                    </div>
                </div>

                <div className="section-header">
                    <span>Projects</span>
                    <Plus size={14} className="section-add-btn" />
                </div>

                <div className="nav-group">
                    <div className="nav-item active">
                        <FolderPlus size={18} />
                        <span>New Project</span>
                    </div>
                </div>

                <div className="spacer" />

                <div className="history-section">
                    <div className="section-header">
                        <span>Recent Tasks</span>
                    </div>
                    <div className="nav-item">
                        <MessageSquare size={18} />
                        <span className="text-truncate">Refactoring Codebase...</span>
                    </div>
                    <div className="nav-item">
                        <MessageSquare size={18} />
                        <span className="text-truncate">Implementing Context...</span>
                    </div>
                </div>
            </div>

            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="avatar-circle">C</div>
                    <div className="user-info">
                        <span className="user-name">Chen Jinsheng</span>
                        <span className="user-plan">Free Plan</span>
                    </div>
                </div>
                <button className="settings-btn">
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
};
