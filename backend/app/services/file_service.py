"""
File service for handling tool result files (images, etc.).
"""
import os
import base64
import uuid
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any
from loguru import logger
from app.config import settings


class FileService:
    """Service for file operations."""
    
    # Directory for storing tool result files
    FILES_DIR = Path(settings.agent_cwd) / "tool_results"
    
    @classmethod
    def ensure_files_dir(cls) -> Path:
        """Ensure files directory exists."""
        cls.FILES_DIR.mkdir(parents=True, exist_ok=True)
        return cls.FILES_DIR
    
    @classmethod
    def save_base64_image(
        cls,
        base64_data: str,
        mime_type: str = "image/png",
        prefix: str = "tool_result"
    ) -> Tuple[str, str]:
        """
        Save base64 image data to file and return file path and URL.
        
        Args:
            base64_data: Base64 encoded image data (without data URI prefix)
            mime_type: MIME type (e.g., 'image/png', 'image/jpeg')
            prefix: File name prefix
            
        Returns:
            Tuple of (relative_path, file_url)
        """
        cls.ensure_files_dir()
        
        # Determine file extension from MIME type
        ext_map = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'image/bmp': '.bmp',
        }
        extension = ext_map.get(mime_type.lower(), '.png')
        
        # Generate unique filename
        filename = f"{prefix}_{uuid.uuid4().hex}{extension}"
        file_path = cls.FILES_DIR / filename
        
        try:
            # Decode and save
            image_data = base64.b64decode(base64_data)
            file_path.write_bytes(image_data)
            
            # Return relative path (from project root) and URL
            relative_path = f"tool_results/{filename}"
            file_url = f"/api/v1/files/{relative_path}"
            
            logger.info(f"💾 Saved base64 image to {file_path} ({len(image_data)} bytes)")
            return relative_path, file_url
            
        except Exception as e:
            logger.error(f"❌ Failed to save base64 image: {e}")
            raise
    
    @classmethod
    def get_file_path(cls, relative_path: str) -> Optional[Path]:
        """
        Get absolute file path from relative path.
        
        Supports files in any subdirectory of agent_cwd, not just tool_results.
        
        Args:
            relative_path: Relative path like 'tool_results/filename.jpg' or 'filename.jpg'
            
        Returns:
            Absolute Path object or None if not found
        """
        # Security: prevent directory traversal
        if '..' in relative_path or relative_path.startswith('/'):
            logger.warning(f"⚠️ Invalid file path: {relative_path}")
            return None
        
        # Remove leading slash if present
        relative_path = relative_path.lstrip('/')
        
        file_path = Path(settings.agent_cwd) / relative_path
        
        # Ensure file is within allowed directory
        try:
            file_path.resolve().relative_to(Path(settings.agent_cwd).resolve())
        except ValueError:
            logger.warning(f"⚠️ File path outside allowed directory: {relative_path}")
            return None
        
        if file_path.exists() and file_path.is_file():
            return file_path
        
        return None
    
    @classmethod
    def delete_file(cls, relative_path: str) -> bool:
        """
        Delete a file by relative path.
        
        Args:
            relative_path: Relative path like 'tool_results/filename.jpg'
            
        Returns:
            True if deleted, False otherwise
        """
        file_path = cls.get_file_path(relative_path)
        if file_path:
            try:
                file_path.unlink()
                logger.info(f"🗑️ Deleted file: {relative_path}")
                return True
            except Exception as e:
                logger.error(f"❌ Failed to delete file {relative_path}: {e}")
        return False
    
    @classmethod
    def list_files(
        cls,
        directory: str = "",
        file_types: Optional[List[str]] = None,
        recursive: bool = False
    ) -> List[Dict[str, Any]]:
        """
        List files in the project directory.
        
        Args:
            directory: Subdirectory to list (relative to agent_cwd), empty string for root
            file_types: Filter by file extensions (e.g., ['.jpg', '.png']), None for all
            recursive: Whether to list files recursively
            
        Returns:
            List of file info dictionaries with keys: name, path, relative_path, url, size, is_image, is_directory
        """
        base_path = Path(settings.agent_cwd)
        
        # Security: prevent directory traversal
        if directory:
            if '..' in directory or directory.startswith('/'):
                logger.warning(f"⚠️ Invalid directory path: {directory}")
                return []
            target_path = base_path / directory
        else:
            target_path = base_path
        
        # Ensure path is within allowed directory
        try:
            target_path.resolve().relative_to(base_path.resolve())
        except ValueError:
            logger.warning(f"⚠️ Directory path outside allowed directory: {directory}")
            return []
        
        if not target_path.exists() or not target_path.is_dir():
            logger.warning(f"⚠️ Directory does not exist: {directory}")
            return []
        
        files = []
        
        def scan_dir(path: Path, rel_path: str = ""):
            """Recursively scan directory."""
            try:
                for item in path.iterdir():
                    # Skip hidden files and directories
                    if item.name.startswith('.'):
                        continue
                    
                    item_rel_path = f"{rel_path}/{item.name}" if rel_path else item.name
                    
                    if item.is_dir():
                        if recursive:
                            files.append({
                                'name': item.name,
                                'path': str(item),
                                'relative_path': item_rel_path,
                                'url': f"/api/v1/files/{item_rel_path}",
                                'size': None,
                                'is_image': False,
                                'is_directory': True,
                                'mime_type': None
                            })
                            scan_dir(item, item_rel_path)
                        else:
                            files.append({
                                'name': item.name,
                                'path': str(item),
                                'relative_path': item_rel_path,
                                'url': f"/api/v1/files/{item_rel_path}",
                                'size': None,
                                'is_image': False,
                                'is_directory': True,
                                'mime_type': None
                            })
                    elif item.is_file():
                        # Check file type filter
                        if file_types and item.suffix.lower() not in file_types:
                            continue
                        
                        is_image = item.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
                        mime_type = cls._get_mime_type(item.suffix)
                        
                        files.append({
                            'name': item.name,
                            'path': str(item),
                            'relative_path': item_rel_path,
                            'url': f"/api/v1/files/{item_rel_path}",
                            'size': item.stat().st_size,
                            'is_image': is_image,
                            'is_directory': False,
                            'mime_type': mime_type
                        })
            except PermissionError:
                logger.warning(f"⚠️ Permission denied accessing: {path}")
        
        scan_dir(target_path, directory)
        
        # Sort: directories first, then files, both alphabetically
        files.sort(key=lambda x: (not x['is_directory'], x['name'].lower()))
        
        logger.info(f"📁 Listed {len(files)} items in {directory or 'root'}")
        return files
    
    @classmethod
    def save_uploaded_file(
        cls,
        file_content: bytes,
        filename: str,
        subdirectory: str = ""
    ) -> Tuple[str, str]:
        """
        Save an uploaded file to the project directory.
        
        Args:
            file_content: File content as bytes
            filename: Original filename
            subdirectory: Subdirectory to save to (relative to agent_cwd), empty for root
        
        Returns:
            Tuple of (relative_path, file_url)
        """
        base_path = Path(settings.agent_cwd)
        
        # Security: prevent directory traversal
        if subdirectory:
            if '..' in subdirectory or subdirectory.startswith('/'):
                logger.warning(f"⚠️ Invalid subdirectory path: {subdirectory}")
                raise ValueError(f"Invalid subdirectory: {subdirectory}")
            target_dir = base_path / subdirectory
        else:
            target_dir = base_path
        
        # Ensure directory is within allowed directory
        try:
            target_dir.resolve().relative_to(base_path.resolve())
        except ValueError:
            logger.warning(f"⚠️ Subdirectory path outside allowed directory: {subdirectory}")
            raise ValueError(f"Subdirectory outside allowed directory: {subdirectory}")
        
        # Create directory if it doesn't exist
        target_dir.mkdir(parents=True, exist_ok=True)
        
        # Sanitize filename
        safe_filename = cls._sanitize_filename(filename)
        file_path = target_dir / safe_filename
        
        # If file exists, add a suffix
        if file_path.exists():
            stem = file_path.stem
            suffix = file_path.suffix
            counter = 1
            while file_path.exists():
                file_path = target_dir / f"{stem}_{counter}{suffix}"
                counter += 1
        
        try:
            file_path.write_bytes(file_content)
            
            relative_path = f"{subdirectory}/{safe_filename}" if subdirectory else safe_filename
            file_url = f"/api/v1/files/{relative_path}"
            
            logger.info(f"💾 Saved uploaded file to {file_path} ({len(file_content)} bytes)")
            return relative_path, file_url
            
        except Exception as e:
            logger.error(f"❌ Failed to save uploaded file: {e}")
            raise
    
    @staticmethod
    def _get_mime_type(extension: str) -> str:
        """Get MIME type from file extension."""
        ext = extension.lower()
        mime_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.bmp': 'image/bmp',
            '.ico': 'image/x-icon',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.json': 'application/json',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
        }
        return mime_map.get(ext, 'application/octet-stream')
    
    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """Sanitize filename to prevent security issues."""
        # Remove path components
        filename = Path(filename).name
        
        # Remove or replace dangerous characters
        dangerous_chars = ['<', '>', ':', '"', '|', '?', '*', '\\', '/']
        for char in dangerous_chars:
            filename = filename.replace(char, '_')
        
        # Limit length
        if len(filename) > 255:
            name, ext = os.path.splitext(filename)
            filename = name[:250] + ext
        
        return filename
    
    @classmethod
    def get_file_tree(cls, directory: str = "") -> Dict[str, Any]:
        """
        Get directory tree structure.
        
        Args:
            directory: Subdirectory to get tree for (relative to agent_cwd), empty string for root
            
        Returns:
            Tree structure with nested children
        """
        base_path = Path(settings.agent_cwd)
        
        # Security: prevent directory traversal
        if directory:
            if '..' in directory or directory.startswith('/'):
                logger.warning(f"⚠️ Invalid directory path: {directory}")
                return {"error": "Invalid directory path"}
            target_path = base_path / directory
        else:
            target_path = base_path
        
        # Ensure path is within allowed directory
        try:
            target_path.resolve().relative_to(base_path.resolve())
        except ValueError:
            logger.warning(f"⚠️ Directory path outside allowed directory: {directory}")
            return {"error": "Directory path outside allowed directory"}
        
        if not target_path.exists():
            return {"error": "Directory does not exist"}
        
        def build_tree(path: Path, rel_path: str = "") -> Dict[str, Any]:
            """Recursively build tree structure."""
            name = path.name or "project"
            
            if path.is_file():
                is_image = path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
                return {
                    'name': name,
                    'path': str(path),
                    'relative_path': rel_path,
                    'type': 'file',
                    'size': path.stat().st_size,
                    'mime_type': cls._get_mime_type(path.suffix),
                    'is_image': is_image,
                    'extension': path.suffix.lower()
                }
            
            # Directory
            children = []
            try:
                items = sorted(path.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
                for item in items:
                    # Skip hidden files and directories
                    if item.name.startswith('.'):
                        continue
                    # Skip node_modules and other large directories
                    if item.name in ['node_modules', '__pycache__', '.git', 'venv', '.venv']:
                        continue
                    
                    item_rel_path = f"{rel_path}/{item.name}" if rel_path else item.name
                    children.append(build_tree(item, item_rel_path))
            except PermissionError:
                logger.warning(f"⚠️ Permission denied accessing: {path}")
            
            return {
                'name': name,
                'path': str(path),
                'relative_path': rel_path,
                'type': 'directory',
                'children': children
            }
        
        tree = build_tree(target_path, directory)
        logger.info(f"📁 Built file tree for {directory or 'root'}")
        return tree
    
    @classmethod
    def get_file_content(
        cls,
        relative_path: str,
        max_lines: int = 1000,
        max_size: int = 1024 * 1024  # 1MB
    ) -> Dict[str, Any]:
        """
        Get file content for viewing.
        
        Args:
            relative_path: Relative path to file
            max_lines: Maximum number of lines to read for text files
            max_size: Maximum file size to read
            
        Returns:
            Dictionary with file content and metadata
        """
        file_path = cls.get_file_path(relative_path)
        
        if not file_path:
            return {
                'success': False,
                'error': 'File not found',
                'path': relative_path
            }
        
        file_size = file_path.stat().st_size
        mime_type = cls._get_mime_type(file_path.suffix)
        is_image = file_path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
        
        # Image files - return URL
        if is_image:
            return {
                'success': True,
                'path': relative_path,
                'type': 'image',
                'url': f"/api/v1/files/{relative_path}",
                'mime_type': mime_type,
                'size': file_size,
                'name': file_path.name
            }
        
        # Check if file is likely text
        text_extensions = [
            '.txt', '.md', '.json', '.yml', '.yaml', '.xml', '.html', '.htm',
            '.css', '.scss', '.less', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
            '.py', '.pyw', '.pyx', '.pxd', '.pxi',
            '.java', '.kt', '.kts', '.scala', '.groovy',
            '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hxx',
            '.cs', '.fs', '.vb',
            '.go', '.rs', '.rb', '.php', '.pl', '.pm',
            '.swift', '.m', '.mm',
            '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
            '.sql', '.graphql', '.gql',
            '.r', '.R', '.rmd', '.Rmd',
            '.lua', '.vim', '.el', '.lisp', '.clj', '.cljs',
            '.toml', '.ini', '.cfg', '.conf', '.env', '.properties',
            '.dockerfile', '.gitignore', '.gitattributes', '.editorconfig',
            '.makefile', '.cmake', '.gradle',
            '.vue', '.svelte', '.astro',
            '.log', '.csv', '.tsv'
        ]
        
        is_text = (
            file_path.suffix.lower() in text_extensions or
            mime_type.startswith('text/') or
            mime_type in ['application/json', 'application/javascript', 'application/xml']
        )
        
        # Binary file - only provide download
        if not is_text:
            return {
                'success': True,
                'path': relative_path,
                'type': 'binary',
                'url': f"/api/v1/files/{relative_path}",
                'mime_type': mime_type,
                'size': file_size,
                'name': file_path.name,
                'message': 'Binary file - download to view'
            }
        
        # Text file - read content
        try:
            truncated = False
            total_lines = 0
            
            # Check file size first
            if file_size > max_size:
                truncated = True
            
            # Read file
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                if truncated:
                    # Read limited lines
                    lines = []
                    for i, line in enumerate(f):
                        if i >= max_lines:
                            break
                        lines.append(line)
                    content = ''.join(lines)
                    total_lines = sum(1 for _ in open(file_path, 'r', encoding='utf-8', errors='replace'))
                else:
                    content = f.read()
                    total_lines = content.count('\n') + 1
                    if total_lines > max_lines:
                        # Truncate by lines
                        lines = content.split('\n')[:max_lines]
                        content = '\n'.join(lines)
                        truncated = True
            
            # Determine language for syntax highlighting
            language = cls._get_language_from_extension(file_path.suffix)
            
            return {
                'success': True,
                'path': relative_path,
                'type': 'text',
                'content': content,
                'mime_type': mime_type,
                'size': file_size,
                'name': file_path.name,
                'truncated': truncated,
                'total_lines': total_lines,
                'lines_shown': min(max_lines, total_lines),
                'language': language,
                'extension': file_path.suffix.lower()
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to read file {relative_path}: {e}")
            return {
                'success': False,
                'error': str(e),
                'path': relative_path
            }
    
    @staticmethod
    def _get_language_from_extension(extension: str) -> str:
        """Get programming language from file extension for syntax highlighting."""
        ext = extension.lower()
        language_map = {
            '.js': 'javascript',
            '.jsx': 'jsx',
            '.ts': 'typescript',
            '.tsx': 'tsx',
            '.mjs': 'javascript',
            '.cjs': 'javascript',
            '.py': 'python',
            '.pyw': 'python',
            '.go': 'go',
            '.java': 'java',
            '.kt': 'kotlin',
            '.kts': 'kotlin',
            '.scala': 'scala',
            '.c': 'c',
            '.h': 'c',
            '.cpp': 'cpp',
            '.hpp': 'cpp',
            '.cc': 'cpp',
            '.cs': 'csharp',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.m': 'objectivec',
            '.mm': 'objectivec',
            '.sh': 'bash',
            '.bash': 'bash',
            '.zsh': 'bash',
            '.ps1': 'powershell',
            '.sql': 'sql',
            '.graphql': 'graphql',
            '.gql': 'graphql',
            '.r': 'r',
            '.R': 'r',
            '.lua': 'lua',
            '.vim': 'vim',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.xml': 'xml',
            '.html': 'html',
            '.htm': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.md': 'markdown',
            '.markdown': 'markdown',
            '.toml': 'toml',
            '.ini': 'ini',
            '.dockerfile': 'dockerfile',
            '.makefile': 'makefile',
            '.cmake': 'cmake',
            '.vue': 'vue',
            '.svelte': 'svelte',
            '.txt': 'text',
            '.log': 'text',
            '.csv': 'text',
        }
        return language_map.get(ext, 'text')


