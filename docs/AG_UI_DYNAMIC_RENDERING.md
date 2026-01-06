# AG-UI 动态内容渲染机制

## 概述

本机制实现了精巧的AG-UI动态内容展示系统，能够根据工具调用的返回结果类型，自动在前端渲染相应的UI组件。例如，当工具调用返回图片URL或base64图片数据时，前端会自动展示图片而不是显示原始文本。

## 架构设计

### 1. 后端内容类型检测

**位置**: `backend/app/utils/event_helpers.py`

`EventHelpers.detect_content_type()` 函数智能检测内容类型：

- **图片**: HTTP/HTTPS图片URL、base64编码图片（带或不带data URI前缀）
- **视频**: 视频文件URL
- **音频**: 音频文件URL
- **URL**: 通用URL链接
- **文件路径**: 本地文件路径
- **JSON**: JSON格式数据
- **列表**: 数组数据（包括图片列表）
- **文本**: 纯文本内容

检测逻辑会检查：
- URL扩展名（.jpg, .png, .mp4等）
- Base64编码的图片magic bytes
- JSON结构中的图片相关字段
- 数据URI格式

### 2. 事件扩展

**位置**: `backend/core/events.py`

`ToolCallResult` 事件新增 `metadata` 字段：

```python
class ToolCallResult(BaseEvent):
    ...
    metadata: Optional[Dict[str, Any]] = None  # Content type metadata
```

metadata包含：
- `content_type`: 内容类型（'image', 'video', 'audio', 'url', 'json', 'text', 'file', 'list', 'unknown'）
- `media_type`: MIME类型（如 'image/jpeg', 'image/png'）
- `url`: 资源URL
- `data`: 数据（base64、JSON等）
- `encoding`: 编码方式（'base64'）
- `file_path`: 文件路径
- `source_key`: JSON中包含内容的键名
- `items`: 列表项数据

### 3. 适配器集成

**位置**: `backend/core/adapters.py`

`ToolMessageConverter` 和 `ContentBlockConverter._convert_tool_result()` 在生成 `ToolCallResult` 事件时，自动调用内容类型检测并添加metadata。

### 4. 前端类型扩展

**位置**: 
- `frontend/src/types/events.ts`
- `frontend/src/lib/EventProcessor.ts`

扩展了 `ToolCallResult` 和 `ToolCallState` 类型，支持metadata字段。

### 5. 动态渲染组件

**位置**: `frontend/src/components/ToolResultRenderer.tsx`

`ToolResultRenderer` 组件根据metadata动态渲染：

- **图片**: 
  - 显示图片预览
  - 支持点击全屏查看
  - 支持在新标签页打开
  - 处理base64和URL两种格式

- **视频**: 
  - 使用HTML5 video标签播放
  - 提供在新标签页打开的链接

- **音频**: 
  - 使用HTML5 audio标签播放
  - 提供在新标签页打开的链接

- **URL**: 
  - 显示可点击的链接

- **文件路径**: 
  - 显示文件图标和路径

- **JSON**: 
  - 格式化显示JSON数据

- **列表**: 
  - 递归渲染列表项

- **文本**: 
  - 格式化显示文本内容

### 6. UI集成

**位置**: `frontend/src/components/EventMessage.tsx`

`EventMessage` 组件使用 `ToolResultRenderer` 替换原有的简单JSON显示。

## 使用示例

### 场景1: 工具返回图片URL

```python
# 后端工具调用返回
content = "https://example.com/image.jpg"

# 自动检测为图片类型
metadata = {
    "content_type": "image",
    "media_type": "image/jpeg",
    "url": "https://example.com/image.jpg"
}

# 前端自动渲染为图片组件
```

### 场景2: 工具返回base64图片

```python
# 后端工具调用返回
content = "data:image/png;base64,iVBORw0KGgoAAAANS..."

# 自动检测为base64图片
metadata = {
    "content_type": "image",
    "media_type": "image/png",
    "encoding": "base64",
    "data": "iVBORw0KGgoAAAANS..."
}

# 前端自动渲染为图片组件
```

### 场景3: 工具返回JSON包含图片

```python
# 后端工具调用返回
content = {"image_url": "https://example.com/image.jpg", "caption": "A beautiful image"}

# 自动检测JSON中的图片字段
metadata = {
    "content_type": "image",
    "url": "https://example.com/image.jpg",
    "source_key": "image_url"
}

# 前端自动渲染为图片组件
```

## 扩展性

该机制设计为可扩展的：

1. **添加新的内容类型**: 在 `detect_content_type()` 中添加检测逻辑
2. **添加新的渲染组件**: 在 `ToolResultRenderer` 中添加新的渲染分支
3. **自定义metadata**: 根据需要在metadata中添加自定义字段

## 优势

1. **自动化**: 无需手动指定内容类型，自动检测
2. **智能**: 支持多种格式和检测方式
3. **可扩展**: 易于添加新的内容类型和渲染方式
4. **用户友好**: 提供丰富的交互功能（全屏、新标签页等）
5. **向后兼容**: 对于无法检测的内容，回退到文本显示

## 技术细节

- **后端**: Python, Pydantic, 正则表达式, base64解码
- **前端**: TypeScript, React, CSS3
- **协议**: AG-UI (Agent User Interaction Protocol)
- **存储**: metadata随事件一起保存到数据库


