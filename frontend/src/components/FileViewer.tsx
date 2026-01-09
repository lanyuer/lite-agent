/**
 * FileViewer Component - VS Code Style
 * 
 * Displays file content with syntax highlighting for code,
 * image preview for images, and download/copy functionality.
 */
import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { saveAs } from 'file-saver';
import { 
    Download, 
    Copy, 
    Check, 
    FileText, 
    FileCode,
    FileJson,
    Image as ImageIcon,
    File,
    AlertTriangle,
    Loader2,
    X
} from 'lucide-react';
import './FileViewer.css';

interface FileContentResponse {
    success: boolean;
    path: string;
    type: 'text' | 'image' | 'binary';
    content?: string;
    url?: string;
    mime_type: string;
    size: number;
    name: string;
    truncated?: boolean;
    total_lines?: number;
    lines_shown?: number;
    language?: string;
    extension?: string;
    error?: string;
    message?: string;
}

interface FileViewerProps {
    filePath: string;
    onClose?: () => void;
}

const API_BASE = 'http://localhost:8000';

// Get file type class for styling
const getFileTypeClass = (filename: string, extension?: string): string => {
    const ext = extension?.toLowerCase() || filename.split('.').pop()?.toLowerCase() || '';
    
    if (['ts', 'tsx'].includes(ext)) return 'file-ts';
    if (['js', 'jsx'].includes(ext)) return 'file-js';
    if (['css', 'scss', 'less'].includes(ext)) return 'file-css';
    if (['json'].includes(ext)) return 'file-json';
    if (['py'].includes(ext)) return 'file-py';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return 'file-image';
    return '';
};

// Get file icon
const getFileIcon = (filename: string, extension?: string, type?: string) => {
    const ext = extension?.toLowerCase() || filename.split('.').pop()?.toLowerCase() || '';
    
    if (type === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
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

export const FileViewer: React.FC<FileViewerProps> = ({ filePath, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileData, setFileData] = useState<FileContentResponse | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadFileContent();
    }, [filePath]);

    const loadFileContent = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(
                `${API_BASE}/api/v1/files/content/${encodeURIComponent(filePath)}`
            );
            const data = await response.json();
            
            if (!data.success) {
                setError(data.error || 'Failed to load file');
            } else {
                setFileData(data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load file');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/v1/files/${encodeURIComponent(filePath)}`);
            const blob = await response.blob();
            saveAs(blob, fileData?.name || filePath.split('/').pop() || 'file');
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    const handleCopy = async () => {
        if (fileData?.content) {
            try {
                await navigator.clipboard.writeText(fileData.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error('Copy failed:', err);
            }
        }
    };

    const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (loading) {
        return (
            <div className="file-viewer">
                <div className="file-viewer-loading">
                    <Loader2 className="spin" size={24} />
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="file-viewer">
                <div className="file-viewer-error">
                    <AlertTriangle size={24} />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (!fileData) {
        return (
            <div className="file-viewer">
                <div className="file-viewer-empty">
                    <FileText size={48} />
                    <span>Select a file to view</span>
                </div>
            </div>
        );
    }

    const fileTypeClass = getFileTypeClass(fileData.name, fileData.extension);

    return (
        <div className="file-viewer">
            {/* Tab Bar Header */}
            <div className="file-viewer-header">
                <div className="file-viewer-tab">
                    <div className={`file-viewer-title ${fileTypeClass}`}>
                        {getFileIcon(fileData.name, fileData.extension, fileData.type)}
                        <span className="file-name">{fileData.name}</span>
                    </div>
                </div>
                <div className="file-viewer-actions">
                    <div className="file-meta">
                        <span className="file-meta-item">{formatSize(fileData.size)}</span>
                        {fileData.language && (
                            <span className="file-language">{fileData.language}</span>
                        )}
                    </div>
                    {fileData.type === 'text' && (
                        <button 
                            className="action-btn" 
                            onClick={handleCopy}
                            title="Copy to clipboard"
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            <span>{copied ? 'Copied!' : 'Copy'}</span>
                        </button>
                    )}
                    <button 
                        className="action-btn" 
                        onClick={handleDownload}
                        title="Download file"
                    >
                        <Download size={14} />
                        <span>Download</span>
                    </button>
                    {onClose && (
                        <button 
                            className="action-btn close-btn" 
                            onClick={onClose}
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Breadcrumb */}
            <div className="file-viewer-breadcrumb">
                {filePath.split('/').map((part, idx, arr) => (
                    <React.Fragment key={idx}>
                        {idx > 0 && <span className="separator">/</span>}
                        <span className={idx === arr.length - 1 ? 'current' : ''}>{part}</span>
                    </React.Fragment>
                ))}
            </div>

            {/* Content */}
            <div className="file-viewer-content">
                {fileData.type === 'text' && fileData.content && (
                    <>
                        {fileData.truncated && (
                            <div className="file-viewer-warning">
                                <AlertTriangle size={14} />
                                <span>
                                    Showing {fileData.lines_shown} of {fileData.total_lines} lines. 
                                    Download to view full content.
                                </span>
                            </div>
                        )}
                        <SyntaxHighlighter
                            language={fileData.language || 'text'}
                            style={vscDarkPlus}
                            showLineNumbers
                            wrapLines
                            customStyle={{
                                margin: 0,
                                padding: '12px 0',
                                borderRadius: 0,
                                fontSize: '13px',
                                lineHeight: '1.5',
                                background: '#1e1e1e'
                            }}
                            lineNumberStyle={{
                                minWidth: '3em',
                                paddingRight: '1em',
                                textAlign: 'right',
                                color: '#858585',
                                userSelect: 'none'
                            }}
                        >
                            {fileData.content}
                        </SyntaxHighlighter>
                    </>
                )}

                {fileData.type === 'image' && fileData.url && (
                    <div className="file-viewer-image">
                        <img 
                            src={`${API_BASE}${fileData.url}`} 
                            alt={fileData.name}
                            onClick={() => window.open(`${API_BASE}${fileData.url}`, '_blank')}
                        />
                    </div>
                )}

                {fileData.type === 'binary' && (
                    <div className="file-viewer-binary">
                        <File size={48} />
                        <span className="binary-message">{fileData.message || 'Binary file cannot be displayed'}</span>
                        <button className="download-btn" onClick={handleDownload}>
                            <Download size={16} />
                            <span>Download File</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileViewer;
