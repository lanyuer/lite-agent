import React, { useState } from 'react';

function TestEvents() {
    const [events, setEvents] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleTest = async () => {
        setIsLoading(true);
        setEvents([]);

        try {
            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: input }),
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No reader');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (!dataStr) continue;

                        try {
                            const event = JSON.parse(dataStr);
                            console.log('Received event:', event);
                            setEvents(prev => [...prev, event]);
                        } catch (e) {
                            console.error('Parse error:', e, dataStr);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
            <h1>Event System Test</h1>

            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter message"
                    style={{ padding: '10px', width: '300px', marginRight: '10px' }}
                />
                <button
                    onClick={handleTest}
                    disabled={isLoading || !input}
                    style={{ padding: '10px 20px' }}
                >
                    {isLoading ? 'Loading...' : 'Send'}
                </button>
            </div>

            <div>
                <h2>Events Received: {events.length}</h2>
                <div style={{
                    maxHeight: '600px',
                    overflow: 'auto',
                    border: '1px solid #ccc',
                    padding: '10px',
                    backgroundColor: '#f5f5f5'
                }}>
                    {events.map((event, idx) => (
                        <div key={idx} style={{
                            marginBottom: '10px',
                            padding: '10px',
                            backgroundColor: 'white',
                            borderLeft: '3px solid #007bff'
                        }}>
                            <strong>{idx + 1}. {event.type}</strong>
                            <pre style={{ margin: '5px 0', fontSize: '12px' }}>
                                {JSON.stringify(event, null, 2)}
                            </pre>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default TestEvents;
