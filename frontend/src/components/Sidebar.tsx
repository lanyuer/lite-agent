import React from 'react';
import {
    Plus,
    Search,
    Library,
    Settings,
    PanelLeftClose,
    PanelLeft,
    MessageSquare
} from 'lucide-react';
import './Sidebar.css';

export interface Task {
    id: number;
    title: string;
    session_id: string | null;
    created_at: string;
    updated_at: string;
    total_cost_usd?: number;
    total_input_tokens?: number;
    total_output_tokens?: number;
}

interface SidebarProps {
    isOpen: boolean;
    toggleSidebar: () => void;
    tasks: Task[];
    currentTaskId: number | null;
    onNewTask: () => void;
    onTaskSelect: (taskId: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    isOpen, 
    toggleSidebar, 
    tasks, 
    currentTaskId,
    onNewTask,
    onTaskSelect 
}) => {
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
                <button className="new-task-btn" onClick={onNewTask}>
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

                <div className="spacer" />

                <div className="history-section">
                    <div className="section-header">
                        <span>Recent Tasks</span>
                    </div>
                    {tasks.length === 0 ? (
                        <div className="nav-item" style={{ color: '#999', fontStyle: 'italic' }}>
                            <MessageSquare size={18} />
                            <span className="text-truncate">No tasks yet</span>
                        </div>
                    ) : (
                        tasks.map((task) => (
                            <div
                                key={task.id}
                                className={`nav-item ${currentTaskId === task.id ? 'active' : ''}`}
                                onClick={() => onTaskSelect(task.id)}
                            >
                                <MessageSquare size={18} />
                                <span className="text-truncate" title={task.title}>
                                    {task.title}
                                </span>
                            </div>
                        ))
                    )}
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
