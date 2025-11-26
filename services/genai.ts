
import { GoogleGenAI } from "@google/genai";
import { Message } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are "Nano Banana", an expert Multimodal Creative Director.
Your goal is to ensure the highest quality creative output by thinking before doing.

CRITICAL WORKFLOW FOR CREATIVE TASKS (Images, Designs, Assets):
1. **PHASE 1: CONCEPTUALIZATION**
   - When asked to generate a creative asset, do NOT generate the image immediately.
   - First, analyze the request and output a **"Creative Concept"**.
   - Describe the:
     * Visual Style (e.g., Pixel Art, Minimalist, Cyberpunk)
     * Color Palette (Hex codes or descriptive names)
     * Composition & Mood
   - ASK the user for confirmation: "Does this concept look good to you?"

2. **PHASE 2: EXECUTION**
   - ONLY after the user confirms (e.g., "Yes", "Looks good", "Proceed"), generate the image using the 'gemini-2.5-flash-image' model.
   - If the user provides feedback, adjust the concept and generate.

RULES:
- For simple text questions (coding, facts), answer directly without the concept phase.
- If the user provides an attachment to "edit", describe your plan for the edit first.
- Use Markdown bolding for key sections (e.g., **Concept**, **Palette**).
- Do NOT hallucinate image URLs.
`;

// Helper to convert base64 to Markdown image
const formatInlineImage = (mimeType: string, data: string) => {
  // Ensure no newlines in data and add surrounding newlines for markdown parser safety
  return `\n\n![Generated Image](data:${mimeType};base64,${data.replace(/[\r\n]+/g, '')})\n\n`;
};

// Reconstruct history with images from both user attachments and model outputs
const reconstructParts = (history: Message[]) => {
  return history.map(msg => {
    const parts: any[] = [];
    
    // 1. Handle User Attachments
    if (msg.role === 'user') {
      parts.push({ text: msg.content });
      if (msg.attachment) {
        parts.push({ 
          inlineData: { 
            mimeType: msg.attachment.mimeType, 
            data: msg.attachment.data 
          } 
        });
      }
    } 
    // 2. Handle Assistant Generated Images (Markdown parsing)
    else if (msg.role === 'assistant') {
      const imgRegex = /!\[.*?\]\(data:(image\/.*?);base64,(.*?)\)/g;
      let textContent = msg.content;
      
      // Extract images from markdown to pass as inlineData for context
      // We strip the heavy base64 from the text part to save tokens/confusion
      textContent = textContent.replace(imgRegex, (match, mimeType, data) => {
        // NOTE: We DO NOT push inlineData for model messages because Gemini API
        // does not support images in the 'model' role.
        // Instead, we leave a placeholder so the text context remains valid.
        return '\n\n[Generated Image]\n\n'; 
      }).trim();
      
      if (textContent) parts.push({ text: textContent });
      
      if (parts.length === 0) parts.push({ text: "..." });
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: parts
    };
  });
};

export const streamGeminiChat = async function* (
  history: Message[], 
  newMessage: string,
  modelName: string = 'gemini-2.5-flash-image',
  attachment?: { mimeType: string, data: string }
) {
  // 1. Reconstruct Multimodal History (Text Only for Model turns)
  const historyContents = reconstructParts(history);

  // 2. Prepare Current User Content
  const userParts: any[] = [{ text: newMessage }];
  
  // A. New Attachment?
  if (attachment) {
    userParts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.data
      }
    });
  } 
  // B. Context Injection: No new attachment, but maybe we are editing a previous one?
  else {
    // Scan history backwards for the last generated image
    // This allows "Make it blue" to work on the previously generated image
    for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.role === 'assistant') {
            const match = msg.content.match(/!\[.*?\]\(data:(image\/.*?);base64,(.*?)\)/);
            if (match) {
                const [, mimeType, data] = match;
                // Inject the previous image into the CURRENT user message
                // This forces the model to "see" what it previously made
                userParts.push({
                    inlineData: { mimeType, data }
                });
                break; // Only attach the most recent one
            }
        }
    }
  }

  // 3. Initialize Chat
  const chat = ai.chats.create({
    model: modelName,
    history: historyContents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7, 
    },
  });

  // 4. Send Message
  const result = await chat.sendMessageStream({ 
    message: userParts 
  });

  for await (const chunk of result) {
    // 5. Handle Text Parts
    if (chunk.text) {
      yield chunk.text;
    }

    // 6. Handle Image Parts (Inline Data)
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          const { mimeType, data } = part.inlineData;
          yield formatInlineImage(mimeType, data);
        }
      }
    }
  }
};
