# 文件路径引用机制

## 概述

为了解决JSON缓冲区溢出问题，我们实现了基于文件路径引用的机制。对于大文件（特别是base64编码的图片），系统会自动保存到文件服务器，并返回文件URL引用，而不是将完整数据嵌入JSON中。

## 优势

1. **避免JSON缓冲区溢出**: 大文件不再直接序列化到JSON中
2. **更高效**: 文件通过HTTP请求按需加载，减少内存占用
3. **更灵活**: 支持文件缓存、CDN等扩展
4. **更安全**: 文件访问可控，防止路径遍历攻击

## 架构设计

### 1. 文件服务 (`FileService`)

**位置**: `backend/app/services/file_service.py`

功能：
- 保存base64图片到文件系统
- 生成唯一文件名
- 返回相对路径和URL
- 提供文件访问路径解析

文件存储位置：`{agent_cwd}/tool_results/`

### 2. 文件访问端点

**位置**: `backend/app/api/v1/endpoints/files.py`

端点：`GET /api/v1/files/{file_path}`

功能：
- 提供文件访问服务
- 自动检测MIME类型
- 防止路径遍历攻击
- 返回正确的Content-Type头

### 3. 内容优化逻辑

**位置**: `backend/app/utils/event_helpers.py`

`optimize_large_content()` 函数：
- 检测base64图片
- 自动保存到文件
- 更新metadata为文件引用
- 返回文件URL作为content

### 4. 前端渲染

**位置**: `frontend/src/components/ToolResultRenderer.tsx`

优先级顺序：
1. `metadata.url` - 文件服务URL
2. `metadata.file_path` - 转换为URL
3. `metadata.data` (base64) - 直接使用（小文件）
4. `result` - 作为URL或base64

## 工作流程

### 场景：工具返回base64图片

1. **工具调用返回base64数据**
   ```
   content = "data:image/png;base64,iVBORw0KGgoAAAANS..."
   ```

2. **检测内容类型**
   ```python
   metadata = detect_content_type(content)
   # metadata = {
   #     'content_type': 'image',
   #     'media_type': 'image/png',
   #     'encoding': 'base64',
   #     'data': 'iVBORw0KGgoAAAANS...'
   # }
   ```

3. **优化大内容**
   ```python
   optimized_content, metadata = optimize_large_content(content, metadata)
   # 保存文件到: tool_results/tool_result_abc123.png
   # optimized_content = "/api/v1/files/tool_results/tool_result_abc123.png"
   # metadata = {
   #     'content_type': 'image',
   #     'media_type': 'image/png',
   #     'file_path': 'tool_results/tool_result_abc123.png',
   #     'url': '/api/v1/files/tool_results/tool_result_abc123.png',
   #     'saved_to_file': True
   # }
   ```

4. **生成ToolCallResult事件**
   ```json
   {
     "type": "ToolCallResult",
     "content": "/api/v1/files/tool_results/tool_result_abc123.png",
     "metadata": {
       "content_type": "image",
       "media_type": "image/png",
       "file_path": "tool_results/tool_result_abc123.png",
       "url": "/api/v1/files/tool_results/tool_result_abc123.png"
     }
   }
   ```

5. **前端渲染**
   - 检测到 `metadata.url` 或 `metadata.file_path`
   - 构建完整URL: `http://localhost:8000/api/v1/files/tool_results/tool_result_abc123.png`
   - 通过 `<img>` 标签加载图片

## 配置

### 文件存储目录

默认：`{agent_cwd}/tool_results/`

可通过 `settings.agent_cwd` 配置，例如：
```python
agent_cwd = "/path/to/project"
# 文件将保存在: /path/to/project/tool_results/
```

### 内容大小限制

`MAX_CONTENT_SIZE = 100 * 1024` (100KB)

- base64图片：**总是**保存到文件（无论大小）
- 其他内容：超过100KB时截断

## 安全考虑

1. **路径遍历防护**
   - 检查 `..` 和绝对路径
   - 确保文件在允许目录内

2. **文件访问控制**
   - 只允许访问 `tool_results/` 目录下的文件
   - 验证文件存在性

3. **文件名唯一性**
   - 使用UUID生成唯一文件名
   - 防止文件名冲突

## 扩展性

### 支持CDN

可以修改 `FileService.save_base64_image()` 返回CDN URL：

```python
# 保存到本地
file_path = save_to_local(base64_data)

# 上传到CDN
cdn_url = upload_to_cdn(file_path)

# 返回CDN URL
return cdn_url, metadata
```

### 支持文件清理

可以添加定期清理机制：

```python
@staticmethod
def cleanup_old_files(days: int = 7):
    """删除7天前的文件"""
    # 实现清理逻辑
```

## 对比：base64 vs 文件路径

| 特性 | base64嵌入 | 文件路径引用 |
|------|-----------|-------------|
| JSON大小 | 大（+33%） | 小（仅URL） |
| 内存占用 | 高 | 低 |
| 加载方式 | 立即加载 | 按需加载 |
| 缓存支持 | 无 | 有（HTTP缓存） |
| 扩展性 | 低 | 高（CDN等） |
| 适用场景 | 小文件（<10KB） | 大文件（>10KB） |

## 使用示例

### 后端自动处理

无需手动调用，系统自动处理：

```python
# 工具返回base64图片
content = "data:image/png;base64,iVBORw0KGgoAAAANS..."

# 适配器自动检测和优化
# 1. 检测为图片
# 2. 保存到文件
# 3. 返回文件URL
# 前端自动渲染
```

### 前端自动渲染

前端自动识别文件URL并渲染：

```tsx
<ToolResultRenderer
    result="/api/v1/files/tool_results/image.png"
    metadata={{
        content_type: 'image',
        url: '/api/v1/files/tool_results/image.png'
    }}
/>
// 自动渲染为 <img> 标签
```

## 总结

文件路径引用机制提供了：
- ✅ 解决JSON缓冲区溢出问题
- ✅ 更高效的内存使用
- ✅ 更好的扩展性
- ✅ 自动化的处理流程
- ✅ 安全的文件访问

对于大文件（特别是图片），使用文件路径引用是更好的选择。


