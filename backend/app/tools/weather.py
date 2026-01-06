from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeSDKClient, ClaudeAgentOptions
from typing import Any
import httpx

# Define a custom tool using the @tool decorator
@tool("get_weather", "Get current temperature for a location using coordinates", {"latitude": float, "longitude": float})
async def get_weather(args: dict[str, Any]) -> dict[str, Any]:
    # Call weather API
    async with httpx.AsyncClient() as session:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={args['latitude']}&longitude={args['longitude']}&current=temperature_2m&temperature_unit=fahrenheit"
        response = await session.get(url)
        data = response.json()

    return {
        "content": [{
            "type": "text",
            "text": f"Temperature: {data['current']['temperature_2m']}°F"
        }]
    }

# Create an SDK MCP server with the custom tool
custom_server = create_sdk_mcp_server(
    name="my-custom-tools",
    version="1.0.0",
    tools=[get_weather]  # Pass the decorated function
)
