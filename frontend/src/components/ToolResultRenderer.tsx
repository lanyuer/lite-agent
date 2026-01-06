import React, { useState } from 'react';
import { FileText, ExternalLink, Maximize2, X } from 'lucide-react';
import './ToolResultRenderer.css';

interface ToolResultRendererProps {
    result: any;
    metadata?: {
        content_type?: string;
        media_type?: string;
        url?: string;
        data?: any;
        encoding?: string;
        file_path?: string;
        source_key?: string;
        items?: any[];
    };
    isError?: boolean;
}

export const ToolResultRenderer: React.FC<ToolResultRendererProps> = ({
    result,
    metadata,
    isError
}) => {
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    if (isError) {
        return (
            <div className="tool-result-error">
                <pre>{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
            </div>
        );
    }

    const contentType = metadata?.content_type;

    // Render image
    if (contentType === 'image') {
        let imageSrc: string | undefined;

        // Priority 1: File URL (from file service)
        if (metadata?.url) {
            // If URL is relative, make it absolute
            imageSrc = metadata.url.startsWith('http') 
                ? metadata.url 
                : `http://localhost:8000${metadata.url}`;
        } 
        // Priority 2: File path (convert to URL)
        else if (metadata?.file_path) {
            imageSrc = `http://localhost:8000/api/v1/files/${metadata.file_path}`;
        }
        // Priority 3: Base64 data
        else if (metadata?.encoding === 'base64' && metadata?.data) {
            const base64Data = metadata.data.startsWith('data:') 
                ? metadata.data 
                : `data:${metadata.media_type || 'image/png'};base64,${metadata.data}`;
            imageSrc = base64Data;
        } 
        // Priority 4: Result as URL or base64
        else if (typeof result === 'string') {
            if (result.startsWith('http://') || result.startsWith('https://')) {
                imageSrc = result;
            } else if (result.startsWith('/api/v1/files/')) {
                // Relative file URL
                imageSrc = `http://localhost:8000${result}`;
            } else if (result.startsWith('data:image/')) {
                imageSrc = result;
            }
        }

        if (imageSrc) {
            return (
                <>
                    <div className="tool-result-image-container">
                        <div className="tool-result-image-wrapper">
                            <img
                                src={imageSrc}
                                alt="Tool result"
                                className="tool-result-image"
                                onClick={() => {
                                    setImagePreview(imageSrc!);
                                    setIsFullscreen(true);
                                }}
                                onError={() => {
                                    // Fallback to text display if image fails to load
                                    console.error('Failed to load image:', imageSrc);
                                }}
                            />
                            <div className="tool-result-image-overlay">
                                <button
                                    className="tool-result-image-button"
                                    onClick={() => {
                                        setImagePreview(imageSrc!);
                                        setIsFullscreen(true);
                                    }}
                                    title="View fullscreen"
                                >
                                    <Maximize2 size={16} />
                                </button>
                                {metadata?.url && (
                                    <a
                                        href={metadata.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tool-result-image-button"
                                        title="Open in new tab"
                                    >
                                        <ExternalLink size={16} />
                                    </a>
                                )}
                            </div>
                        </div>
                        {metadata?.media_type && (
                            <div className="tool-result-image-info">
                                {metadata.media_type}
                            </div>
                        )}
                    </div>
                    {isFullscreen && imagePreview && (
                        <div className="tool-result-fullscreen" onClick={() => setIsFullscreen(false)}>
                            <div className="tool-result-fullscreen-content" onClick={(e) => e.stopPropagation()}>
                                <button
                                    className="tool-result-fullscreen-close"
                                    onClick={() => setIsFullscreen(false)}
                                >
                                    <X size={24} />
                                </button>
                                <img
                                    src={imagePreview}
                                    alt="Fullscreen preview"
                                    className="tool-result-fullscreen-image"
                                />
                            </div>
                        </div>
                    )}
                </>
            );
        }
    }

    // Render video
    if (contentType === 'video') {
        const videoSrc = metadata?.url || (typeof result === 'string' && result.startsWith('http') ? result : undefined);
        if (videoSrc) {
            return (
                <div className="tool-result-video-container">
                    <video
                        src={videoSrc}
                        controls
                        className="tool-result-video"
                    >
                        Your browser does not support the video tag.
                    </video>
                    {metadata?.url && (
                        <a
                            href={metadata.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tool-result-video-link"
                        >
                            <ExternalLink size={14} />
                            Open in new tab
                        </a>
                    )}
                </div>
            );
        }
    }

    // Render audio
    if (contentType === 'audio') {
        const audioSrc = metadata?.url || (typeof result === 'string' && result.startsWith('http') ? result : undefined);
        if (audioSrc) {
            return (
                <div className="tool-result-audio-container">
                    <audio
                        src={audioSrc}
                        controls
                        className="tool-result-audio"
                    >
                        Your browser does not support the audio tag.
                    </audio>
                    {metadata?.url && (
                        <a
                            href={metadata.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tool-result-audio-link"
                        >
                            <ExternalLink size={14} />
                            Open in new tab
                        </a>
                    )}
                </div>
            );
        }
    }

    // Render URL
    if (contentType === 'url') {
        const url = metadata?.url || (typeof result === 'string' ? result : undefined);
        if (url) {
            return (
                <div className="tool-result-url-container">
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tool-result-url-link"
                    >
                        <ExternalLink size={14} />
                        {url}
                    </a>
                </div>
            );
        }
    }

    // Render file path
    if (contentType === 'file') {
        const filePath = metadata?.file_path || (typeof result === 'string' ? result : undefined);
        if (filePath) {
            return (
                <div className="tool-result-file-container">
                    <FileText size={16} />
                    <span className="tool-result-file-path">{filePath}</span>
                </div>
            );
        }
    }

    // Render JSON with syntax highlighting
    if (contentType === 'json' || (typeof result === 'object' && result !== null)) {
        const jsonData = metadata?.data || result;
        return (
            <div className="tool-result-json-container">
                <pre className="tool-result-json">
                    {JSON.stringify(jsonData, null, 2)}
                </pre>
            </div>
        );
    }

    // Render list
    if (contentType === 'list' || contentType === 'image_list') {
        const items = metadata?.items || (Array.isArray(result) ? result : []);
        if (items.length > 0) {
            return (
                <div className="tool-result-list-container">
                    {items.map((item: any, index: number) => (
                        <div key={index} className="tool-result-list-item">
                            <ToolResultRenderer
                                result={item}
                                metadata={typeof item === 'object' ? item : undefined}
                            />
                        </div>
                    ))}
                </div>
            );
        }
    }

    // Default: render as text
    return (
        <div className="tool-result-text-container">
            <pre className="tool-result-text">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
            </pre>
        </div>
    );
};

