# 自动UI组件生成机制

## 概述

在 `response.py` 中实现了智能策略，当工具调用返回图片、视频或音频等可展示内容时，系统会自动生成对应的 UIComponent 事件，实现生成式UI的动态展示。

## 核心策略

**位置**: `backend/app/api/v1/endpoints/response.py`

当接收到 `ToolCallResult` 事件时：
1. 检查 `metadata.content_type`
2. 如果是图片/视频/音频，自动生成对应的 UIComponent
3. 将 UIComponent 与消息关联
4. 同时发送 ToolCallResult 和 UIComponent 事件到前端

## 工作流程

```
工具调用返回结果
    ↓
ToolCallResult 事件（包含 metadata）
    ↓
检测 content_type
    ↓
生成 UIComponent（如果是图片/视频/音频）
    ↓
发送到前端
    ↓
前端同时渲染：
  - ToolResultRenderer（工具结果详情）
  - GenerativeUI（交互式UI组件）
```

## 实现细节

### 1. UI组件生成函数

**位置**: `backend/app/utils/event_helpers.py`

`generate_ui_component_for_tool_result()` 函数：

```python
def generate_ui_component_for_tool_result(
    tool_result: ToolCallResult,
    assistant_message_id: Optional[str] = None
) -> Optional[UIComponent]:
    """
    根据工具结果自动生成UI组件
    
    支持的场景：
    - 图片：生成包含图片的卡片组件
    - 视频：生成包含视频播放器的卡片组件
    - 音频：生成包含音频播放器的卡片组件
    """
```

### 2. 图片组件生成

当检测到图片时，生成嵌套组件：

```python
UIComponent(
    component_id="ui_img_{tool_call_id}",
    component_type="card",
    props={"title": "生成的图片"},
    children=[{
        "component_type": "image",
        "props": {
            "src": image_url,  # 文件URL或HTTP URL
            "alt": "Tool result image"
        }
    }],
    message_id=assistant_message_id
)
```

### 3. 视频/音频组件生成

类似地，为视频和音频生成对应的组件：

```python
# 视频
UIComponent(
    component_type="card",
    children=[{
        "component_type": "video",
        "props": {"src": video_url, "controls": True}
    }]
)

# 音频
UIComponent(
    component_type="card",
    children=[{
        "component_type": "audio",
        "props": {"src": audio_url, "controls": True}
    }]
)
```

## 集成点

### response.py 中的集成

```python
# Process event stream
async for event in AgentService.stream_events(adapter, client):
    # ... 其他处理 ...
    
    # Generate UI components for tool results (e.g., images)
    if event.type == 'ToolCallResult':
        tool_result = event
        ui_component = EventHelpers.generate_ui_component_for_tool_result(
            tool_result, assistant_message_id
        )
        
        if ui_component:
            # Save to database
            EventService.save_event(db, task.id, 'UIComponent', ...)
            
            # Send to frontend
            yield f"data: {ui_component.model_dump_json()}\n\n"
    
    # Yield original tool result event
    yield f"data: {event.model_dump_json()}\n\n"
```

## 使用场景

### 场景1: 工具生成图片

```python
# 工具调用返回图片文件路径
tool_result = ToolCallResult(
    tool_call_id="call_123",
    content="/api/v1/files/tool_results/image.png",
    metadata={
        "content_type": "image",
        "file_path": "tool_results/image.png",
        "url": "/api/v1/files/tool_results/image.png"
    }
)

# 自动生成UI组件
ui_component = generate_ui_component_for_tool_result(tool_result)
# 结果：包含图片的卡片组件
```

### 场景2: 工具返回图片URL

```python
# 工具调用返回外部图片URL
tool_result = ToolCallResult(
    tool_call_id="call_456",
    content="https://example.com/image.jpg",
    metadata={
        "content_type": "image",
        "url": "https://example.com/image.jpg",
        "media_type": "image/jpeg"
    }
)

# 自动生成UI组件
ui_component = generate_ui_component_for_tool_result(tool_result)
# 结果：包含外部图片的卡片组件
```

## 前端渲染

前端会同时收到两个事件：

1. **ToolCallResult**: 显示在工具调用结果区域
2. **UIComponent**: 显示在消息内容区域（Generative UI）

用户可以看到：
- 工具调用的详细信息（参数、结果）
- 交互式的图片/视频/音频展示组件

## 优势

1. **自动化**: 无需手动编写UI生成代码
2. **一致性**: 统一的UI组件风格
3. **交互性**: 支持用户与生成的内容交互
4. **可扩展**: 易于添加新的内容类型支持

## 配置

可以通过修改 `generate_ui_component_for_tool_result()` 函数来自定义：
- 组件样式
- 组件标题
- 嵌套结构
- 交互行为

## 示例输出

### 后端事件流

```json
// 1. 工具调用结果
{
  "type": "ToolCallResult",
  "tool_call_id": "call_123",
  "content": "/api/v1/files/tool_results/image.png",
  "metadata": {
    "content_type": "image",
    "url": "/api/v1/files/tool_results/image.png"
  }
}

// 2. 自动生成的UI组件
{
  "type": "UIComponent",
  "component_id": "ui_img_call_123",
  "component_type": "card",
  "props": {"title": "生成的图片"},
  "children": [{
    "component_type": "image",
    "props": {
      "src": "http://localhost:8000/api/v1/files/tool_results/image.png"
    }
  }],
  "message_id": "msg_456"
}
```

### 前端渲染效果

用户会看到：
1. **工具调用区域**: 显示工具名称和结果详情
2. **消息内容区域**: 显示交互式图片卡片，可以：
   - 查看大图
   - 在新标签页打开
   - 下载图片

## 总结

通过在 `response.py` 中实现的智能策略，系统能够：
- ✅ 自动检测工具结果中的可展示内容
- ✅ 自动生成对应的UI组件
- ✅ 提供丰富的交互体验
- ✅ 保持代码简洁和可维护性

这使得代理可以专注于业务逻辑，而UI展示完全自动化处理。


