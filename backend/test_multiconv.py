from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, TextBlock, ResultMessage, SystemMessage
import asyncio

class ConversationSession:
    """Maintains a single conversation session with Claude - reconnecting each turn."""

    def __init__(self, options: ClaudeAgentOptions = None):
        self.options = options
        self.session_id = None
        self.turn_count = 0

    async def start(self):
        print("Starting conversation session (reconnecting each turn, keeping session_id).")
        print("Commands: 'exit' to quit, 'new' for new session")

        while True:
            user_input = input(f"\n[Turn {self.turn_count + 1}] You: ")

            if user_input.lower() == 'exit':
                break
            elif user_input.lower() == 'new':
                self.session_id = None
                self.turn_count = 0
                print("Started new conversation session (previous context cleared)")
                continue

            # Create new client for each turn with resume option if we have session_id
            if self.session_id:
                # Create new options with resume parameter
                options = ClaudeAgentOptions(
                    resume=self.session_id,
                    allowed_tools=self.options.allowed_tools if hasattr(self.options, 'allowed_tools') else None,
                    permission_mode=self.options.permission_mode if hasattr(self.options, 'permission_mode') else None
                )
                print(f"📤 Resuming session: {self.session_id}")
            else:
                options = self.options
                print(f"📤 Starting new session")
            
            client = ClaudeSDKClient(options)
            try:
                await client.connect()
                print(f"✅ Connected")
                
                # Send message
                await client.query(user_input)
                
                self.turn_count += 1

                # Process response and extract session_id
                print(f"[Turn {self.turn_count}] Claude: ", end="")
                async for message in client.receive_response():
                    # Extract session_id from SystemMessage (init) or ResultMessage
                    if isinstance(message, SystemMessage) and hasattr(message, 'subtype') and message.subtype == 'init':
                        if hasattr(message, 'data') and isinstance(message.data, dict):
                            new_id = message.data.get('session_id')
                            if new_id and new_id != self.session_id:
                                print(f"\n🔍 Got session_id from SystemMessage: {new_id}")
                                self.session_id = new_id
                    elif isinstance(message, ResultMessage) and message.session_id:
                        if self.session_id != message.session_id:
                            print(f"\n🔍 Got session_id from ResultMessage: {message.session_id}")
                            self.session_id = message.session_id
                    
                    # Print text content
                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, TextBlock):
                                print(block.text, end="")
                print()  # New line after response
                
            finally:
                await client.disconnect()
                print(f"🔌 Disconnected")

        print(f"Conversation ended after {self.turn_count} turns.")

async def main():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Write", "Bash"],
        permission_mode="acceptEdits"
    )
    session = ConversationSession(options)
    await session.start()

# Example conversation:
# Turn 1 - You: "Create a file called hello.py"
# Turn 1 - Claude: "I'll create a hello.py file for you..."
# Turn 2 - You: "What's in that file?"
# Turn 2 - Claude: "The hello.py file I just created contains..." (remembers!)
# Turn 3 - You: "Add a main function to it"
# Turn 3 - Claude: "I'll add a main function to hello.py..." (knows which file!)

asyncio.run(main())