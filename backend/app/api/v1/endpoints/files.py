"""
File serving endpoints for tool result files and project files.
"""
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, JSONResponse
from loguru import logger

from app.services.file_service import FileService

router = APIRouter()


# Note: More specific routes must come before the catch-all route


@router.get("/files/tree")
async def get_file_tree(
    directory: str = Query("", description="Subdirectory to get tree for (relative to project root)")
):
    """
    Get file tree structure for the project directory.
    
    Args:
        directory: Subdirectory to get tree for (empty for root)
        
    Returns:
        JSON response with tree structure
    """
    try:
        tree = FileService.get_file_tree(directory=directory)
        
        if "error" in tree:
            raise HTTPException(status_code=400, detail=tree["error"])
        
        return JSONResponse(content={
            "success": True,
            "directory": directory,
            "tree": tree
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get file tree: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/content/{file_path:path}")
async def get_file_content(
    file_path: str,
    max_lines: int = Query(1000, description="Maximum number of lines to read")
):
    """
    Get file content for viewing (text/code files).
    
    Args:
        file_path: Relative file path
        max_lines: Maximum number of lines to read (default 1000)
        
    Returns:
        JSON response with file content and metadata
    """
    try:
        result = FileService.get_file_content(
            relative_path=file_path,
            max_lines=max_lines
        )
        
        if not result.get('success'):
            raise HTTPException(status_code=404, detail=result.get('error', 'File not found'))
        
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get file content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    subdirectory: str = Query("", description="Subdirectory to save to (relative to project root)")
):
    """
    Upload a file to the project directory.
    
    Args:
        file: Uploaded file
        subdirectory: Subdirectory to save to (empty for root)
        
    Returns:
        JSON response with file info
    """
    try:
        file_content = await file.read()
        
        relative_path, file_url = FileService.save_uploaded_file(
            file_content=file_content,
            filename=file.filename or "uploaded_file",
            subdirectory=subdirectory
        )
        
        # Get file info
        file_info = FileService.get_file_path(relative_path)
        is_image = file_info.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'] if file_info else False
        
        return JSONResponse(content={
            "success": True,
            "filename": file_info.name if file_info else file.filename,
            "relative_path": relative_path,
            "url": file_url,
            "size": len(file_content),
            "is_image": is_image,
            "mime_type": FileService._get_mime_type(file_info.suffix) if file_info else None
        })
    except Exception as e:
        logger.error(f"❌ Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Catch-all route for serving files - must be last
@router.get("/files/{file_path:path}")
async def get_file(file_path: str):
    """
    Serve files from project directory (images, etc.).
    
    Args:
        file_path: Relative file path like 'tool_results/filename.jpg' or 'filename.jpg'
        
    Returns:
        File response
    """
    file_path_obj = FileService.get_file_path(file_path)
    
    if not file_path_obj:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine media type from extension
    ext = file_path_obj.suffix.lower()
    media_types = {
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
    media_type = media_types.get(ext, 'application/octet-stream')
    
    return FileResponse(
        path=str(file_path_obj),
        media_type=media_type,
        filename=file_path_obj.name
    )


@router.get("/files/list")
async def list_files(
    directory: str = Query("", description="Subdirectory to list (relative to project root)"),
    file_types: Optional[str] = Query(None, description="Comma-separated file extensions to filter (e.g., '.jpg,.png')"),
    recursive: bool = Query(False, description="List files recursively")
):
    """
    List files in the project directory.
    
    Args:
        directory: Subdirectory to list (empty for root)
        file_types: Comma-separated file extensions to filter
        recursive: Whether to list files recursively
        
    Returns:
        JSON response with list of file info
    """
    try:
        file_types_list = None
        if file_types:
            file_types_list = [ext.strip() for ext in file_types.split(',')]
        
        files = FileService.list_files(
            directory=directory,
            file_types=file_types_list,
            recursive=recursive
        )
        
        return JSONResponse(content={
            "success": True,
            "directory": directory,
            "files": files,
            "count": len(files)
        })
    except Exception as e:
        logger.error(f"❌ Failed to list files: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/list/images")
async def list_images(
    directory: str = Query("", description="Subdirectory to list (relative to project root)"),
    recursive: bool = Query(True, description="List images recursively")
):
    """
    List image files in the project directory.
    
    Args:
        directory: Subdirectory to list (empty for root)
        recursive: Whether to list images recursively
        
    Returns:
        JSON response with list of image file info
    """
    try:
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
        files = FileService.list_files(
            directory=directory,
            file_types=image_extensions,
            recursive=recursive
        )
        
        # Filter to only images (in case directories were included)
        images = [f for f in files if f['is_image']]
        
        return JSONResponse(content={
            "success": True,
            "directory": directory,
            "images": images,
            "count": len(images)
        })
    except Exception as e:
        logger.error(f"❌ Failed to list images: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    subdirectory: str = Query("", description="Subdirectory to save to (relative to project root)")
):
    """
    Upload a file to the project directory.
    
    Args:
        file: Uploaded file
        subdirectory: Subdirectory to save to (empty for root)
        
    Returns:
        JSON response with file info
    """
    try:
        file_content = await file.read()
        
        relative_path, file_url = FileService.save_uploaded_file(
            file_content=file_content,
            filename=file.filename or "uploaded_file",
            subdirectory=subdirectory
        )
        
        # Get file info
        file_info = FileService.get_file_path(relative_path)
        is_image = file_info.suffix.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'] if file_info else False
        
        return JSONResponse(content={
            "success": True,
            "filename": file_info.name if file_info else file.filename,
            "relative_path": relative_path,
            "url": file_url,
            "size": len(file_content),
            "is_image": is_image,
            "mime_type": FileService._get_mime_type(file_info.suffix) if file_info else None
        })
    except Exception as e:
        logger.error(f"❌ Failed to upload file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


