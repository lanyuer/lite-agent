---
name: skill-creator
description: Help users create new custom skills for Claude
triggers:
  - create skill
  - new skill
  - make skill
  - skill creator
  - custom skill
version: 1.0.0
---

# Skill Creator

## Purpose
This meta-skill helps users create new custom skills by guiding them through an interactive process. It generates properly formatted SKILL.md files with all necessary components.

## When to Use
- User wants to create a new skill
- User asks how to make a custom skill
- User mentions "skill creator" or similar phrases

## Workflow Instructions

### Step 1: Understand the Need
Ask the user:
1. What task or capability should this skill enable?
2. What triggers/keywords should activate it?
3. Does it need a tool (API call, code execution)?

### Step 2: Gather Details
Collect information about:
- **Skill name** (lowercase-with-dashes)
- **Description** (one sentence summary)
- **Trigger keywords** (list of words/phrases)
- **Purpose** (detailed explanation)
- **When to use** (specific scenarios)
- **Workflow** (step-by-step instructions)
- **Tool definition** (if needed)

### Step 3: Generate SKILL.md
Create a properly formatted SKILL.md file with:
- YAML frontmatter (name, description, triggers, version)
- Purpose section
- When to Use section
- Workflow Instructions
- Important Rules
- Tool Definition (if applicable)
- Examples

### Step 4: Provide Instructions
Tell the user:
1. Create a folder: `skills/[skill-name]/`
2. Save the SKILL.md file in that folder
3. Restart the server to load the skill
4. Test the skill with trigger keywords

## Template Structure

```markdown
---
name: skill-name
description: Brief description
triggers:
  - keyword1
  - keyword2
version: 1.0.0
---

# Skill Name

## Purpose
What this skill does and why it exists.

## When to Use
- Specific scenario 1
- Specific scenario 2

## Workflow Instructions
1. Step 1
2. Step 2
3. Step 3

## Important Rules
- Rule 1
- Rule 2

## Tool Definition (optional)
\`\`\`json
{
  "name": "tool_name",
  "description": "Tool description",
  "input_schema": {
    "type": "object",
    "properties": {
      "param": {
        "type": "string",
        "description": "Parameter description"
      }
    },
    "required": ["param"]
  }
}
\`\`\`

## Examples
Example usage scenarios
```

## Example Interaction

**User**: "Help me create a skill for analyzing code"

**Your Response**:
```
I'll help you create a code analysis skill! Let me ask a few questions:

1. What specific aspects of code should it analyze? (e.g., complexity, security, performance, style)
2. What programming languages should it support?
3. What keywords should trigger this skill? (e.g., "analyze code", "code review", "check code")
4. Should it use any external tools or just provide analysis based on Claude's knowledge?
```

After gathering responses, generate the complete SKILL.md file and provide setup instructions.

## Important Notes
- Skills are loaded at server startup
- Trigger keywords should be specific but not too narrow
- Tool definitions must be valid JSON
- Version should follow semver (1.0.0)
- Test skills thoroughly before sharing
