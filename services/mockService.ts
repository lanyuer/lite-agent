import { Message } from '../types.ts';

// Standard conversational responses
const GENERAL_RESPONSES = [
  "I've analyzed the codebase. It seems like we can optimize the rendering loop in `App.tsx`. Would you like me to draft a refactor?",
  "I found a TODO in `services/auth.ts` regarding token refresh logic. Should I implement that now?",
  "I'm checking the local worktree status... \n\nIt looks clean. We are ready to merge the feature branch.",
  "I can help with that. What specific part of the application are you looking to improve today?",
];

// Code-heavy responses to trigger the artifact panel
const CODE_RESPONSES = [
  `I'll create a simple React counter component for you.

Here is the implementation:

\`\`\`tsx
import React, { useState } from 'react';

export const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md flex items-center space-x-4">
      <div className="flex-1">
        <div className="text-xl font-medium text-black">Counter</div>
        <p className="text-gray-500">Current count: {count}</p>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={() => setCount(c => c - 1)}
          className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200"
        >
          -
        </button>
        <button 
          onClick={() => setCount(c => c + 1)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          +
        </button>
      </div>
    </div>
  );
};
\`\`\`

You can use this component directly in your page layout.`,
  
  `I've drafted a utility function to handle the data transformation you asked for.

\`\`\`typescript
interface UserData {
  id: string;
  name: string;
  role: 'admin' | 'user';
}

export const processUsers = (users: UserData[]) => {
  // Filter for active admins
  return users
    .filter(u => u.role === 'admin')
    .map(u => ({
      ...u,
      displayName: u.name.toUpperCase()
    }));
};
\`\`\`

Let me know if you need test cases for this.`,
];

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const mockStreamResponse = (
  input: string, 
  onChunk: (chunk: string) => void,
  onComplete: () => void
) => {
  // Determine response type based on keywords
  const lowerInput = input.toLowerCase();
  const isCodingRequest = lowerInput.includes('code') || lowerInput.includes('react') || lowerInput.includes('component') || lowerInput.includes('function') || lowerInput.includes('app');
  
  const targetResponse = isCodingRequest 
    ? CODE_RESPONSES[Math.floor(Math.random() * CODE_RESPONSES.length)]
    : GENERAL_RESPONSES[Math.floor(Math.random() * GENERAL_RESPONSES.length)];

  // Simulate network latency
  setTimeout(() => {
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < targetResponse.length) {
        // Vary chunk size for realistic typing flow
        const isCodeBlock = targetResponse.slice(currentIndex).startsWith('```');
        const chunkSize = isCodeBlock ? 15 : Math.floor(Math.random() * 4) + 1; // Type code faster
        
        const chunk = targetResponse.slice(currentIndex, currentIndex + chunkSize);
        onChunk(chunk);
        currentIndex += chunkSize;
      } else {
        clearInterval(interval);
        onComplete();
      }
    }, 20); // Typing speed
  }, 600);
};