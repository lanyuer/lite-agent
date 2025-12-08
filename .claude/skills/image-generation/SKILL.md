---
name: image-generation
description: Generate images using Gemini's image generation capabilities
triggers:
  - image
  - generate
  - create
  - picture
  - illustration
  - visual
  - draw
  - design
  - pixel art
  - artwork
version: 1.0.0
---

# Image Generation Skill

## Purpose
This skill enables Claude to generate images using Google's Gemini image generation model. Use this skill when users request visual content creation.

## When to Use
- User explicitly requests image generation
- Visual content would enhance the response
- After conceptualizing a creative idea that needs visualization
- User asks for artwork, illustrations, or designs

## Workflow Instructions

### Phase 1: Conceptualization
1. **Analyze the request** - Understand what the user wants to create
2. **Create a detailed concept** including:
   - **Visual Style** (e.g., Pixel Art, Minimalist, Photorealistic, Cyberpunk)
   - **Color Palette** (specific hex codes or descriptive names)
   - **Composition** (layout, perspective, framing)
   - **Mood & Atmosphere** (emotional tone, lighting)
   - **Key Details** (specific elements, textures, effects)
3. **Present the concept** to the user using clear formatting with bold headers
4. **Ask for approval**: "Does this concept look good to you?"

### Phase 2: Execution
1. **Wait for user confirmation** (e.g., "Yes", "Looks good", "Proceed", "Generate it")
2. **Use the generate_image tool** with your detailed concept as the prompt
3. **Include all details** from your concept in the prompt
4. **Present the result** to the user

### Phase 3: Iteration (if needed)
1. If user requests changes, adjust the concept
2. Get approval for the revised concept
3. Regenerate with the updated prompt

## Important Rules
- **ALWAYS** create and present a concept BEFORE generating
- **NEVER** generate images without user approval
- **DO NOT** hallucinate image URLs - only use the tool
- Be specific and detailed in your prompts for better results
- Use the user's language and terminology in concepts

## Tool Definition
```json
{
  "name": "generate_image",
  "description": "Generate an image based on a detailed text prompt using Gemini's image generation model. The prompt should be comprehensive and descriptive, including visual style, colors, composition, mood, and specific details.",
  "input_schema": {
    "type": "object",
    "properties": {
      "prompt": {
        "type": "string",
        "description": "A detailed, descriptive prompt for image generation. Should include: visual style, color palette, composition, mood, and specific elements to include."
      }
    },
    "required": ["prompt"]
  }
}
```

## Examples

### Example 1: Pixel Art Request
**User**: "Create a pixel art banana"

**Your Response**:
```
I'll create a pixel art banana concept for you.

**Creative Concept**

**Visual Style**: 8-bit Pixel Art
**Color Palette**: 
- Bright yellow (#FFD700) for the banana body
- Darker yellow (#FFA500) for shading
- Brown (#8B4513) for spots and stem
- Black (#000000) for outlines

**Composition**: Centered, slightly curved banana with chunky pixels, simple iconic shape

**Mood**: Playful, retro gaming aesthetic

Does this concept look good to you?
```

### Example 2: Complex Scene
**User**: "Generate a cyberpunk street scene"

**Your Response**:
```
I'll conceptualize a cyberpunk street scene for you.

**Creative Concept**

**Visual Style**: Cyberpunk, neon-noir aesthetic
**Color Palette**:
- Neon pink (#FF006E) and cyan (#00F5FF) for signs
- Deep purple (#1A0033) for night sky
- Orange (#FF6B35) for street lights
- Dark grays (#2D2D2D) for buildings

**Composition**: Street-level perspective, rain-slicked pavement reflecting neon lights, towering buildings on both sides

**Mood**: Dystopian, atmospheric, moody with dramatic lighting

**Key Details**: Holographic advertisements, steam vents, distant figures with umbrellas

Does this concept look good to you?
```
