import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface StreamingMarkdownProps {
    text: string;
    speed?: number;
    interval?: number;
}

export const StreamingMarkdown: React.FC<StreamingMarkdownProps> = ({
    text,
    speed = 5,
    interval = 20
}) => {
    const [displayedText, setDisplayedText] = useState('');
    const currentIndexRef = useRef(0);
    const animationFrameRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        // If text length decreased, it's a new message - reset
        if (text.length < displayedText.length) {
            setDisplayedText('');
            currentIndexRef.current = 0;
        }

        // If we've already displayed all the text, do nothing
        if (currentIndexRef.current >= text.length) {
            return;
        }

        const animate = () => {
            if (currentIndexRef.current < text.length) {
                const nextIndex = Math.min(currentIndexRef.current + speed, text.length);
                setDisplayedText(text.slice(0, nextIndex));
                currentIndexRef.current = nextIndex;

                if (nextIndex < text.length) {
                    animationFrameRef.current = window.setTimeout(animate, interval);
                }
            }
        };

        animationFrameRef.current = window.setTimeout(animate, interval);

        return () => {
            if (animationFrameRef.current) {
                clearTimeout(animationFrameRef.current);
            }
        };
    }, [text, speed, interval, displayedText.length]);

    return <ReactMarkdown>{displayedText}</ReactMarkdown>;
};
