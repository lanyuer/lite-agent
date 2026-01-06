# 本地文件浏览和展示功能

## 概述

实现了完整的本地文件浏览和展示功能，允许项目查看、上传和展示项目目录中的文件（特别是图像），并使用生成式UI组件进行美观的展示。

## 功能特性

### 1. 文件浏览
- 列出项目目录中的文件
- 支持递归浏览子目录
- 支持按文件类型过滤
- 显示文件信息（名称、大小、类型等）

### 2. 文件上传
- 上传文件到项目目录
- 支持指定子目录
- 自动处理文件名冲突

### 3. 文件访问
- 通过HTTP端点访问项目目录中的任何文件
- 自动检测MIME类型
- 支持图像、视频、音频等多种文件类型

### 4. 生成式UI展示
- `file_list` 组件：展示文件列表，支持图像缩略图
- `image_gallery` 组件：图像网格展示，点击在新标签页打开
- `image` 组件：增强的图像组件，自动处理相对URL

## API端点

### 1. 获取文件列表

```
GET /api/v1/files/list?directory=&file_types=&recursive=false
```

**参数：**
- `directory` (可选): 子目录路径，相对于项目根目录
- `file_types` (可选): 逗号分隔的文件扩展名，例如 `.jpg,.png`
- `recursive` (可选): 是否递归列出，默认 `false`

**响应示例：**
```json
{
  "success": true,
  "directory": "",
  "files": [
    {
      "name": "image.jpg",
      "path": "/path/to/project/image.jpg",
      "relative_path": "image.jpg",
      "url": "/api/v1/files/image.jpg",
      "size": 123456,
      "is_image": true,
      "is_directory": false,
      "mime_type": "image/jpeg"
    }
  ],
  "count": 1
}
```

### 2. 获取图像列表

```
GET /api/v1/files/list/images?directory=&recursive=true
```

**参数：**
- `directory` (可选): 子目录路径
- `recursive` (可选): 是否递归列出，默认 `true`

**响应示例：**
```json
{
  "success": true,
  "directory": "",
  "images": [
    {
      "name": "image.jpg",
      "url": "/api/v1/files/image.jpg",
      "is_image": true,
      "mime_type": "image/jpeg"
    }
  ],
  "count": 1
}
```

### 3. 上传文件

```
POST /api/v1/files/upload?subdirectory=
```

**参数：**
- `file` (multipart/form-data): 要上传的文件
- `subdirectory` (可选): 保存到的子目录

**响应示例：**
```json
{
  "success": true,
  "filename": "uploaded_image.jpg",
  "relative_path": "uploaded_image.jpg",
  "url": "/api/v1/files/uploaded_image.jpg",
  "size": 123456,
  "is_image": true,
  "mime_type": "image/jpeg"
}
```

### 4. 访问文件

```
GET /api/v1/files/{file_path}
```

**参数：**
- `file_path`: 相对文件路径，例如 `image.jpg` 或 `subdir/image.jpg`

**响应：**
- 返回文件内容，自动设置正确的 Content-Type

## 生成式UI组件

### file_list 组件

展示文件列表，支持图像缩略图预览。

**示例：**
```json
{
  "type": "UIComponent",
  "component_id": "file_list_1",
  "component_type": "file_list",
  "props": {
    "files": [
      {
        "name": "image.jpg",
        "url": "/api/v1/files/image.jpg",
        "size": 123456,
        "is_image": true,
        "is_directory": false
      }
    ],
    "onFileClick": null
  }
}
```

### image_gallery 组件

图像网格展示，支持自定义列数。

**示例：**
```json
{
  "type": "UIComponent",
  "component_id": "gallery_1",
  "component_type": "image_gallery",
  "props": {
    "images": [
      "/api/v1/files/image1.jpg",
      "/api/v1/files/image2.jpg"
    ],
    "columns": 3,
    "onImageClick": null
  }
}
```

### image 组件（增强）

自动处理相对URL，支持项目目录中的图像。

**示例：**
```json
{
  "type": "UIComponent",
  "component_id": "img_1",
  "component_type": "image",
  "props": {
    "src": "/api/v1/files/image.jpg",
    "alt": "Project image"
  }
}
```

## 使用场景

### 场景1: 展示项目中的所有图像

```python
from core.events import UIComponent

# 获取图像列表
images = FileService.list_files(file_types=['.jpg', '.png', '.gif'], recursive=True)
image_urls = [img['url'] for img in images if img['is_image']]

# 生成图像画廊组件
yield UIComponent(
    component_id="project_images",
    component_type="image_gallery",
    props={
        "images": image_urls,
        "columns": 4
    }
)
```

### 场景2: 展示特定目录的文件列表

```python
# 列出特定目录的文件
files = FileService.list_files(directory="notion-clone", recursive=False)

# 生成文件列表组件
yield UIComponent(
    component_id="project_files",
    component_type="file_list",
    props={
        "files": files
    }
)
```

### 场景3: 展示单个图像

```python
# 直接使用图像URL
yield UIComponent(
    component_id="single_image",
    component_type="card",
    props={"title": "项目图像"},
    children=[{
        "component_type": "image",
        "props": {
            "src": "/api/v1/files/143e3bc53f4a28b033c02ce6481bb65f.JPG",
            "alt": "Project image"
        }
    }]
)
```

## 前端使用

### 在React组件中使用

```tsx
import { GenerativeUI } from './components/GenerativeUI';

// 文件列表组件
<GenerativeUI
  component={{
    component_id: "file_list_1",
    component_type: "file_list",
    props: {
      files: fileListData
    }
  }}
/>

// 图像画廊组件
<GenerativeUI
  component={{
    component_id: "gallery_1",
    component_type: "image_gallery",
    props: {
      images: imageUrls,
      columns: 3
    }
  }}
/>
```

### 从API获取文件列表

```typescript
// 获取所有图像
const response = await fetch('http://localhost:8000/api/v1/files/list/images?recursive=true');
const data = await response.json();
const images = data.images;

// 获取特定目录的文件
const response = await fetch('http://localhost:8000/api/v1/files/list?directory=notion-clone');
const data = await response.json();
const files = data.files;
```

## 安全考虑

1. **路径遍历防护**: 所有文件路径都经过验证，防止 `..` 和绝对路径
2. **目录限制**: 文件访问限制在 `agent_cwd` 目录内
3. **文件名清理**: 上传的文件名经过清理，移除危险字符
4. **MIME类型检测**: 自动检测文件类型，防止恶意文件

## 配置

文件服务使用 `settings.agent_cwd` 作为项目根目录：

```python
# backend/app/config.py
agent_cwd: str = os.getenv("AGENT_CWD", "/path/to/project")
```

## 文件存储位置

- **工具结果文件**: `{agent_cwd}/tool_results/`
- **项目文件**: `{agent_cwd}/` 及其子目录
- **上传文件**: 默认保存到 `{agent_cwd}/`，可通过 `subdirectory` 参数指定子目录

## 总结

通过实现本地文件浏览和展示功能，项目现在可以：
- ✅ 浏览项目目录中的文件
- ✅ 上传新文件
- ✅ 通过HTTP访问文件
- ✅ 使用生成式UI组件美观地展示文件和图像
- ✅ 支持图像画廊和文件列表等多种展示方式

这使得代理可以更好地与项目文件交互，特别是图像等可视化内容。

