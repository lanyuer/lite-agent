"""
Event handling utilities for processing and saving agent events.
"""
import base64
import json
import re
from typing import Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from loguru import logger

from app.services.event_service import EventService
from app.services.conversation_service import ConversationService
from app.services.file_service import FileService
from core.events import AgentEvent, ToolCallResult, UIComponent


class EventHelpers:
    """Helper functions for event processing."""
    
    @staticmethod
    def save_user_message_events(
        db: Session,
        task_id: str,
        user_message_id: str,
        message: str,
        start_sequence: int
    ) -> int:
        """
        Save user message events (Start, Content, End) to database.
        
        Args:
            db: Database session
            task_id: Task ID
            user_message_id: User message ID
            message: Message content
            start_sequence: Starting sequence number
            
        Returns:
            Next sequence number after saving all events
        """
        # Save user message to conversations table
        ConversationService.create_user_message(db, task_id, message)
        
        # Save user message events
        sequence = start_sequence
        EventService.save_event(
            db, task_id, 'TextMessageStart',
            {'message_id': user_message_id, 'role': 'user'},
            sequence
        )
        sequence += 1
        
        EventService.save_event(
            db, task_id, 'TextMessageContent',
            {'message_id': user_message_id, 'delta': message},
            sequence
        )
        sequence += 1
        
        EventService.save_event(
            db, task_id, 'TextMessageEnd',
            {'message_id': user_message_id},
            sequence
        )
        sequence += 1
        
        logger.info(
            f"✅ User message saved to task {task_id} "
            f"(sequence {start_sequence} to {sequence - 1})"
        )
        return sequence
    
    @staticmethod
    def prepare_event_data(event: AgentEvent) -> Dict[str, Any]:
        """
        Prepare event data for database storage.
        
        For CustomEvent types (SystemMessage, ResultMessage), only save the data field.
        For other events, save the full model_dump().
        
        Args:
            event: Agent event
            
        Returns:
            Dictionary ready for database storage
        """
        if event.type in ('SystemMessage', 'ResultMessage'):
            # CustomEvent has a 'data' field that contains the actual event data
            if hasattr(event, 'data'):
                return event.data if isinstance(event.data, dict) else {}
            else:
                return event.model_dump()
        else:
            return event.model_dump()
    
    @staticmethod
    def extract_session_id(event: AgentEvent) -> Optional[str]:
        """
        Extract session_id from SystemMessage or ResultMessage event.
        
        Args:
            event: Agent event
            
        Returns:
            Session ID if found, None otherwise
        """
        if not hasattr(event, 'data'):
            return None
        
        event_data = event.data
        if not isinstance(event_data, dict):
            return None
        
        # Check SystemMessage (subtype='init')
        if event.type == 'SystemMessage':
            if event_data.get('subtype') == 'init':
                # First check top-level session_id
                session_id = event_data.get('session_id')
                if session_id:
                    return session_id
                
                # Check nested data
                system_data = event_data.get('data', {})
                if isinstance(system_data, dict):
                    return system_data.get('session_id')
        
        # Check ResultMessage
        elif event.type == 'ResultMessage':
            return event_data.get('session_id')
        
        return None
    
    @staticmethod
    def collect_assistant_content(
        event: AgentEvent,
        assistant_message_id: Optional[str],
        content_parts: list[str]
    ) -> tuple[Optional[str], list[str]]:
        """
        Collect assistant message content from TextMessageContent events.
        
        Args:
            event: Current event
            assistant_message_id: Currently tracked assistant message ID
            content_parts: List of content parts collected so far
            
        Returns:
            Tuple of (assistant_message_id, content_parts)
        """
        # Track new assistant message
        if event.type == 'TextMessageStart' and hasattr(event, 'role'):
            if getattr(event, 'role') == 'assistant':
                assistant_message_id = getattr(event, 'message_id', None)
                content_parts = []  # Reset for new message
        
        # Collect content
        if event.type == 'TextMessageContent' and hasattr(event, 'message_id'):
            if assistant_message_id and getattr(event, 'message_id') == assistant_message_id:
                delta = getattr(event, 'delta', '')
                if delta:
                    content_parts.append(delta)
        
        return assistant_message_id, content_parts
    
    @staticmethod
    def extract_usage_info(event: AgentEvent) -> Dict[str, Any]:
        """
        Extract usage information from RunFinished event.
        
        Args:
            event: RunFinished event
            
        Returns:
            Dictionary with usage information
        """
        usage_info: Dict[str, Any] = {}
        
        if event.type == 'RunFinished':
            if hasattr(event, 'total_cost_usd'):
                usage_info['cost_usd'] = getattr(event, 'total_cost_usd')
            
            if hasattr(event, 'usage'):
                usage_data = getattr(event, 'usage', {})
                if isinstance(usage_data, dict):
                    usage_info['usage'] = usage_data
                    usage_info['input_tokens'] = (
                        usage_data.get('input_tokens') or 
                        usage_data.get('inputTokens')
                    )
                    usage_info['output_tokens'] = (
                        usage_data.get('output_tokens') or 
                        usage_data.get('outputTokens')
                    )
                    if 'cost_usd' not in usage_info:
                        usage_info['cost_usd'] = usage_data.get('total_cost_usd')
        
        return usage_info
    
    @staticmethod
    def detect_content_type(content: Any) -> Dict[str, Any]:
        """
        Detect content type and extract metadata from tool result content.
        
        Args:
            content: Tool result content (string, dict, list, etc.)
            
        Returns:
            Dictionary with content_type and metadata
        """
        metadata: Dict[str, Any] = {}
        
        if content is None:
            return {'content_type': 'unknown', **metadata}
        
        # Handle string content
        if isinstance(content, str):
            content_str = content.strip()
            
            # Check for data URI (base64 images)
            if content_str.startswith('data:image/'):
                # Extract MIME type and base64 data
                match = re.match(r'data:image/([^;]+);base64,(.+)', content_str)
                if match:
                    mime_type = f"image/{match.group(1)}"
                    base64_data = match.group(2)
                    metadata.update({
                        'content_type': 'image',
                        'media_type': mime_type,
                        'encoding': 'base64',
                        'data': base64_data
                    })
                    return metadata
            
            # Check for base64 image (without data URI prefix)
            # Try to detect by magic bytes
            try:
                # Remove whitespace
                clean_content = content_str.replace('\n', '').replace(' ', '')
                if len(clean_content) > 100:  # Reasonable base64 image size
                    decoded = base64.b64decode(clean_content, validate=True)
                    # Check magic bytes for common image formats
                    if decoded.startswith(b'\x89PNG\r\n\x1a\n'):
                        metadata.update({
                            'content_type': 'image',
                            'media_type': 'image/png',
                            'encoding': 'base64',
                            'data': clean_content
                        })
                        return metadata
                    elif decoded.startswith(b'\xff\xd8\xff'):
                        metadata.update({
                            'content_type': 'image',
                            'media_type': 'image/jpeg',
                            'encoding': 'base64',
                            'data': clean_content
                        })
                        return metadata
                    elif decoded.startswith(b'GIF87a') or decoded.startswith(b'GIF89a'):
                        metadata.update({
                            'content_type': 'image',
                            'media_type': 'image/gif',
                            'encoding': 'base64',
                            'data': clean_content
                        })
                        return metadata
            except Exception:
                pass  # Not base64 or not an image
            
            # Check for HTTP/HTTPS URLs
            if content_str.startswith('http://') or content_str.startswith('https://'):
                url_lower = content_str.lower()
                # Check for image extensions
                if any(url_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']):
                    metadata.update({
                        'content_type': 'image',
                        'url': content_str,
                        'media_type': _get_mime_type_from_url(content_str)
                    })
                    return metadata
                # Check for video extensions
                elif any(url_lower.endswith(ext) for ext in ['.mp4', '.webm', '.ogg', '.mov', '.avi']):
                    metadata.update({
                        'content_type': 'video',
                        'url': content_str,
                        'media_type': _get_mime_type_from_url(content_str)
                    })
                    return metadata
                # Check for audio extensions
                elif any(url_lower.endswith(ext) for ext in ['.mp3', '.wav', '.ogg', '.m4a', '.aac']):
                    metadata.update({
                        'content_type': 'audio',
                        'url': content_str,
                        'media_type': _get_mime_type_from_url(content_str)
                    })
                    return metadata
                else:
                    metadata.update({
                        'content_type': 'url',
                        'url': content_str
                    })
                    return metadata
            
            # Check for file path
            if content_str.startswith('/api/v1/files/') or content_str.startswith('tool_results/'):
                file_path = content_str.replace('/api/v1/files/', '')
                url_lower = file_path.lower()
                if any(url_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']):
                    metadata.update({
                        'content_type': 'image',
                        'file_path': file_path,
                        'url': f"/api/v1/files/{file_path}",
                        'media_type': _get_mime_type_from_url(file_path)
                    })
                    return metadata
                elif any(url_lower.endswith(ext) for ext in ['.mp4', '.webm', '.ogg', '.mov', '.avi']):
                    metadata.update({
                        'content_type': 'video',
                        'file_path': file_path,
                        'url': f"/api/v1/files/{file_path}",
                        'media_type': _get_mime_type_from_url(file_path)
                    })
                    return metadata
                elif any(url_lower.endswith(ext) for ext in ['.mp3', '.wav', '.ogg', '.m4a', '.aac']):
                    metadata.update({
                        'content_type': 'audio',
                        'file_path': file_path,
                        'url': f"/api/v1/files/{file_path}",
                        'media_type': _get_mime_type_from_url(file_path)
                    })
                    return metadata
                else:
                    metadata.update({
                        'content_type': 'file',
                        'file_path': file_path,
                        'url': f"/api/v1/files/{file_path}"
                    })
                    return metadata
            
            # Check for JSON
            try:
                json_data = json.loads(content_str)
                if isinstance(json_data, dict):
                    # Check if JSON contains image-related fields
                    for key in ['image', 'image_url', 'imageUrl', 'url', 'src', 'data']:
                        if key in json_data:
                            value = json_data[key]
                            if isinstance(value, str):
                                if value.startswith('http') or value.startswith('data:image/') or value.startswith('/api/v1/files/'):
                                    metadata.update({
                                        'content_type': 'image',
                                        'source_key': key,
                                        'url': value,
                                        'data': json_data
                                    })
                                    return metadata
                    metadata.update({
                        'content_type': 'json',
                        'data': json_data
                    })
                    return metadata
                elif isinstance(json_data, list):
                    # Check if list contains images
                    items_metadata = []
                    for item in json_data:
                        if isinstance(item, str):
                            item_meta = EventHelpers.detect_content_type(item)
                            items_metadata.append(item_meta)
                    metadata.update({
                        'content_type': 'list',
                        'items': items_metadata,
                        'data': json_data
                    })
                    return metadata
            except (json.JSONDecodeError, ValueError):
                pass
            
            # Default to text
            metadata.update({
                'content_type': 'text'
            })
            return metadata
        
        # Handle dict content
        elif isinstance(content, dict):
            # Check for image-related fields
            for key in ['image', 'image_url', 'imageUrl', 'url', 'src', 'data']:
                if key in content:
                    value = content[key]
                    if isinstance(value, str):
                        nested_meta = EventHelpers.detect_content_type(value)
                        if nested_meta.get('content_type') == 'image':
                            metadata.update({
                                'content_type': 'image',
                                'source_key': key,
                                **nested_meta
                            })
                            return metadata
            metadata.update({
                'content_type': 'json',
                'data': content
            })
            return metadata
        
        # Handle list content
        elif isinstance(content, list):
            items_metadata = []
            for item in content:
                item_meta = EventHelpers.detect_content_type(item)
                items_metadata.append(item_meta)
            metadata.update({
                'content_type': 'list',
                'items': items_metadata,
                'data': content
            })
            return metadata
        
        # Default
        metadata.update({
            'content_type': 'unknown'
        })
        return metadata
    
    @staticmethod
    def optimize_large_content(
        content: Any,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[Any, Dict[str, Any]]:
        """
        Optimize large content by saving base64 images to files.
        
        Args:
            content: Original content
            metadata: Content type metadata from detect_content_type
            
        Returns:
            Tuple of (optimized_content, updated_metadata)
        """
        if metadata is None:
            metadata = EventHelpers.detect_content_type(content)
        
        # Only optimize base64 images
        if metadata.get('content_type') == 'image' and metadata.get('encoding') == 'base64':
            base64_data = metadata.get('data')
            media_type = metadata.get('media_type', 'image/png')
            
            if base64_data and len(base64_data) > 1000:  # Only optimize if reasonably large
                try:
                    # Save to file
                    relative_path, file_url = FileService.save_base64_image(
                        base64_data, media_type, prefix="tool_result"
                    )
                    
                    # Update metadata and return file URL as content
                    metadata.update({
                        'file_path': relative_path,
                        'url': file_url,
                        'encoding': None,  # No longer base64
                        'data': None  # Removed from metadata
                    })
                    
                    logger.info(f"💾 Optimized base64 image: saved to {file_url}")
                    return file_url, metadata
                except Exception as e:
                    logger.warning(f"⚠️ Failed to optimize base64 image: {e}")
                    # Return original content if optimization fails
                    return content, metadata
        
        return content, metadata
    
    @staticmethod
    def generate_ui_component_for_tool_result(
        tool_result: ToolCallResult,
        assistant_message_id: Optional[str] = None
    ) -> Optional[UIComponent]:
        """
        Generate UI component for tool result based on content type.
        
        Args:
            tool_result: ToolCallResult event
            assistant_message_id: Associated assistant message ID
            
        Returns:
            UIComponent if content type is renderable, None otherwise
        """
        if tool_result.is_error:
            return None
        
        metadata = tool_result.metadata or {}
        content_type = metadata.get('content_type')
        
        if not content_type:
            return None
        
        tool_call_id = tool_result.tool_call_id
        component_id = f"ui_{content_type}_{tool_call_id}"
        
        # Generate image component
        if content_type == 'image':
            image_url = metadata.get('url') or tool_result.content
            if not image_url:
                return None
            
            # Ensure absolute URL if relative
            if isinstance(image_url, str) and image_url.startswith('/api/v1/files/'):
                # Keep as relative URL, frontend will handle it
                pass
            elif isinstance(image_url, str) and not (image_url.startswith('http://') or image_url.startswith('https://')):
                # Assume it's a file path
                image_url = f"/api/v1/files/{image_url}"
            
            return UIComponent(
                component_id=component_id,
                component_type="card",
                props={
                    "title": "生成的图片",
                    "padding": "medium"
                },
                children=[{
                    "component_type": "image",
                    "props": {
                        "src": image_url,
                        "alt": "Tool result image",
                        "style": {
                            "maxWidth": "100%",
                            "height": "auto"
                        }
                    }
                }],
                message_id=assistant_message_id
            )
        
        # Generate video component
        elif content_type == 'video':
            video_url = metadata.get('url') or tool_result.content
            if not video_url:
                return None
            
            if isinstance(video_url, str) and not (video_url.startswith('http://') or video_url.startswith('https://')):
                video_url = f"/api/v1/files/{video_url}"
            
            return UIComponent(
                component_id=component_id,
                component_type="card",
                props={
                    "title": "生成的视频",
                    "padding": "medium"
                },
                children=[{
                    "component_type": "video",
                    "props": {
                        "src": video_url,
                        "controls": True,
                        "style": {
                            "maxWidth": "100%"
                        }
                    }
                }],
                message_id=assistant_message_id
            )
        
        # Generate audio component
        elif content_type == 'audio':
            audio_url = metadata.get('url') or tool_result.content
            if not audio_url:
                return None
            
            if isinstance(audio_url, str) and not (audio_url.startswith('http://') or audio_url.startswith('https://')):
                audio_url = f"/api/v1/files/{audio_url}"
            
            return UIComponent(
                component_id=component_id,
                component_type="card",
                props={
                    "title": "生成的音频",
                    "padding": "medium"
                },
                children=[{
                    "component_type": "audio",
                    "props": {
                        "src": audio_url,
                        "controls": True
                    }
                }],
                message_id=assistant_message_id
            )
        
        return None


def _get_mime_type_from_url(url: str) -> str:
    """Get MIME type from URL extension."""
    url_lower = url.lower()
    mime_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
    }
    for ext, mime_type in mime_map.items():
        if url_lower.endswith(ext):
            return mime_type
    return 'application/octet-stream'
