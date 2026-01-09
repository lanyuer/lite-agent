/**
 * FileBrowser Component - VS Code Style
 * 
 * A modal panel that displays file tree and file viewer side by side.
 * Allows browsing project files and viewing their content.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
    X, 
    Folder, 
    FolderOpen,
    FileText, 
    FileCode,
    FileJson,
    Image as ImageIcon,
    File,
    ChevronRight,
    ChevronDown,
    RefreshCw,
    Loader2,
    AlertTriangle,
    MoreHorizontal
} from 'lucide-react';
import { FileViewer } from './FileViewer';
import './FileBrowser.css';

interface FileTreeNode {
    name: string;
    path: string;
    relative_path: string;
    type: 'file' | 'directory';
    size?: number;
    mime_type?: string;
    is_image?: boolean;
    extension?: string;
    children?: FileTreeNode[];
}

interface FileBrowserProps {
    isOpen: boolean;
    onClose: () => void;
}

const API_BASE = 'http://localhost:8000';

// Get file type class for styling
const getFileTypeClass = (node: FileTreeNode): string => {
    if (node.type === 'directory') return '';
    const ext = node.extension?.toLowerCase() || node.name.split('.').pop()?.toLowerCase() || '';
    
    if (['ts', 'tsx'].includes(ext)) return 'file-ts';
    if (['js', 'jsx'].includes(ext)) return 'file-js';
    if (['css', 'scss', 'less'].includes(ext)) return 'file-css';
    if (['json'].includes(ext)) return 'file-json';
    if (['md', 'mdx'].includes(ext)) return 'file-md';
    if (['py'].includes(ext)) return 'file-py';
    if (node.is_image || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return 'file-image';
    return '';
};

// Get file icon based on type
const getFileIcon = (node: FileTreeNode, isExpanded: boolean = false) => {
    if (node.type === 'directory') {
        return isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />;
    }
    
    const ext = node.extension?.toLowerCase() || node.name.split('.').pop()?.toLowerCase() || '';
    
    if (node.is_image || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
        return <ImageIcon size={16} />;
    }
    if (['json'].includes(ext)) {
        return <FileJson size={16} />;
    }
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'java', 'c', 'cpp', 'h', 'rs', 'rb'].includes(ext)) {
        return <FileCode size={16} />;
    }
    
    return <FileText size={16} />;
};

// File Tree Item Component
const FileTreeItem: React.FC<{
    node: FileTreeNode;
    level: number;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    expandedDirs: Set<string>;
    toggleDir: (path: string) => void;
}> = ({ node, level, selectedPath, onSelect, expandedDirs, toggleDir }) => {
    const isExpanded = expandedDirs.has(node.relative_path);
    const isSelected = selectedPath === node.relative_path;
    const isDirectory = node.type === 'directory';
    const fileTypeClass = getFileTypeClass(node);

    const handleClick = () => {
        if (isDirectory) {
            toggleDir(node.relative_path);
        } else {
            onSelect(node.relative_path);
        }
    };

    return (
        <div className="tree-item-wrapper">
            <div 
                className={`tree-item ${isSelected ? 'selected' : ''} ${isDirectory ? 'directory' : 'file'} ${fileTypeClass}`}
                style={{ paddingLeft: `${8 + level * 12}px` }}
                onClick={handleClick}
            >
                {isDirectory ? (
                    <span className="tree-chevron">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                ) : (
                    <span className="tree-chevron" style={{ visibility: 'hidden' }}>
                        <ChevronRight size={16} />
                    </span>
                )}
                <span className="tree-icon">{getFileIcon(node, isExpanded)}</span>
                <span className="tree-name" title={node.name}>{node.name}</span>
            </div>
            
            {isDirectory && isExpanded && node.children && (
                <div className="tree-children">
                    {node.children.map((child) => (
                        <FileTreeItem
                            key={child.relative_path || child.name}
                            node={child}
                            level={level + 1}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
                            expandedDirs={expandedDirs}
                            toggleDir={toggleDir}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FileBrowser: React.FC<FileBrowserProps> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tree, setTree] = useState<FileTreeNode | null>(null);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']));

    const loadFileTree = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${API_BASE}/api/v1/files/tree`);
            const data = await response.json();
            
            if (!data.success) {
                setError(data.error || 'Failed to load file tree');
            } else {
                setTree(data.tree);
                // Auto-expand root
                setExpandedDirs(new Set(['']));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load file tree');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadFileTree();
        }
    }, [isOpen, loadFileTree]);

    const toggleDir = useCallback((path: string) => {
        setExpandedDirs(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const handleFileSelect = useCallback((path: string) => {
        setSelectedPath(path);
    }, []);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="file-browser-overlay" onClick={onClose}>
            <div className="file-browser-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="file-browser-header">
                    <h2>File Explorer</h2>
                    <div className="file-browser-header-actions">
                        <button 
                            className="header-btn" 
                            onClick={loadFileTree}
                            title="Refresh"
                        >
                            <RefreshCw size={14} />
                        </button>
                        <button 
                            className="header-btn close" 
                            onClick={onClose}
                            title="Close (Esc)"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="file-browser-content">
                    {/* File Tree Panel */}
                    <div className="file-browser-tree">
                        {/* Explorer section header */}
                        <div className="tree-header">
                            <span className="tree-header-title">Explorer</span>
                            <div className="tree-header-actions">
                                <button className="tree-action-btn" title="More actions">
                                    <MoreHorizontal size={14} />
                                </button>
                            </div>
                        </div>
                        
                        {loading && (
                            <div className="tree-loading">
                                <Loader2 className="spin" size={20} />
                                <span>Loading files...</span>
                            </div>
                        )}
                        
                        {error && (
                            <div className="tree-error">
                                <AlertTriangle size={20} />
                                <span>{error}</span>
                                <button onClick={loadFileTree}>Retry</button>
                            </div>
                        )}
                        
                        {!loading && !error && tree && (
                            <div className="tree-container">
                                {tree.children && tree.children.length > 0 ? (
                                    tree.children.map((node) => (
                                        <FileTreeItem
                                            key={node.relative_path || node.name}
                                            node={node}
                                            level={0}
                                            selectedPath={selectedPath}
                                            onSelect={handleFileSelect}
                                            expandedDirs={expandedDirs}
                                            toggleDir={toggleDir}
                                        />
                                    ))
                                ) : (
                                    <div className="tree-empty">
                                        <Folder size={24} />
                                        <span>No files found</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* File Viewer Panel */}
                    <div className="file-browser-viewer">
                        {selectedPath ? (
                            <FileViewer 
                                filePath={selectedPath} 
                                onClose={() => setSelectedPath(null)}
                            />
                        ) : (
                            <div className="viewer-placeholder">
                                <File size={48} />
                                <span>Select a file to view its content</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FileBrowser;
