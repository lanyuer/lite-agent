# 会话管理实现文档

## 概述

实现了会话管理功能，使得对话可以保持上下文。现在每个会话会维护一个持久的 `ClaudeSDKClient` 实例，支持多轮对话。

## 问题背景

之前的实现存在以下问题：
- 每次请求都创建新的 `ClaudeSDKClient` 实例
- 使用 `async with` 导致每次请求后客户端被关闭
- **无法保持对话上下文**，每次都是新的会话

## 解决方案

### 1. 创建会话管理器 (`backend/core/session_manager.py`)

**功能特性：**
- 维护活跃会话的字典 (session_id -> SessionInfo)
- 支持获取或创建会话
- 自动清理过期会话（默认30分钟超时）
- 优雅的启动和关闭

**主要类：**

```python
class SessionManager:
    - get_or_create_session(): 获取或创建会话
    - close_session(): 关闭特定会话
    - _cleanup_expired_sessions(): 自动清理过期会话
```

**使用示例：**
```python
from core.session_manager import get_session_manager

session_manager = get_session_manager()
session_id, client = await session_manager.get_or_create_session(
    session_id="optional-id",
    options=ClaudeAgentOptions(...)
)
```

### 2. 更新 API 端点 (`backend/app/api/routes/response.py`)

**改动：**
- ✅ 添加 `session_id` 到请求模型（可选参数）
- ✅ 使用会话管理器获取或创建会话
- ✅ 移除 `async with` 以保持客户端连接
- ✅ 返回 `SessionInfo` 事件给前端

**请求格式：**
```json
{
  "message": "用户消息",
  "session_id": "可选的会话ID"
}
```

**响应流程：**
1. 首先发送 `SessionInfo` 事件（包含 session_id）
2. 然后发送常规的 AG-UI 事件流

### 3. 应用生命周期管理 (`backend/app/main.py`)

**改动：**
- 添加 `lifespan` 上下文管理器
- 启动时初始化会话管理器
- 关闭时清理所有会话

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_session_manager()  # 启动
    yield
    await cleanup_session_manager()  # 关闭
```

### 4. 前端会话保持 (`frontend/src/hooks/useAgentEvents.ts`)

**改动：**
- ✅ 添加 `sessionIdRef` 来存储会话 ID
- ✅ 发送消息时包含 `session_id`
- ✅ 监听 `SessionInfo` 事件并保存 session_id
- ✅ **移除 `reset()` 调用**，保留消息历史
- ✅ 添加 `resetSession()` 方法用于手动重置

**新增功能：**
```typescript
const { 
    state, 
    sendMessage, 
    stopGeneration,
    resetSession,      // 新增：重置会话
    sessionId          // 新增：当前会话 ID
} = useAgentEvents();
```

## 工作流程

### 第一次对话
```
前端 -> 后端: { message: "Hello", session_id: null }
后端: 创建新 session (uuid)
后端 -> 前端: SessionInfo 事件 { session_id: "abc-123" }
前端: 保存 session_id 到 sessionIdRef
后端 -> 前端: 其他 AG-UI 事件...
```

### 后续对话
```
前端 -> 后端: { message: "继续对话", session_id: "abc-123" }
后端: 复用已有 session "abc-123"
后端: 在同一个 ClaudeSDKClient 上调用 query()
后端 -> 前端: SessionInfo 事件（相同 session_id）
后端 -> 前端: 其他 AG-UI 事件...
```

### 开始新对话
```typescript
// 用户点击"新对话"按钮
resetSession();  // 清空 sessionId 和消息历史
// 下次发送消息时会创建新 session
```

## 会话管理特性

### 自动过期清理
- 默认超时：30 分钟
- 后台任务每 60 秒检查一次
- 自动关闭过期的 ClaudeSDKClient

### 优雅关闭
- 应用关闭时自动断开所有会话
- 防止资源泄漏

### 错误处理
- 会话断开错误被捕获和记录
- 不影响其他会话的正常运行

## 使用建议

### 前端开发者
1. 正常发送消息即可，会话 ID 会自动管理
2. 如果需要开始新对话，调用 `resetSession()`
3. 可以通过 `sessionId` 属性查看当前会话 ID

### 后端开发者
1. 会话管理器会自动初始化和清理
2. 可以通过环境变量配置超时时间（未来可扩展）
3. 会话管理器是全局单例，线程安全

## 测试验证

### 测试会话保持
```bash
# 第一条消息
curl -X POST http://localhost:8000/api/response \
  -H "Content-Type: application/json" \
  -d '{"message": "我叫张三"}'

# 注意返回的 session_id，然后在第二条消息中使用
curl -X POST http://localhost:8000/api/response \
  -H "Content-Type: application/json" \
  -d '{"message": "我叫什么名字？", "session_id": "从第一个响应中获取的ID"}'

# 如果会话管理工作正常，Claude 应该能记住你叫张三
```

## 技术细节

### 关键实现细节

#### 1. 为什么不使用 `async with`？
```python
# ❌ 旧实现 - 会话在每次请求后关闭
async with ClaudeSDKClient(options) as client:
    await client.query(message)
    # ... client 在 with 块结束时自动断开

# ✅ 新实现 - 会话保持活跃
session_id, client = await session_manager.get_or_create_session(...)
await client.query(message)
# client 继续保持连接，直到超时或手动关闭
```

#### 2. 为什么不调用 `connect()` 而没有参数？
根据 [Claude Agent SDK 文档](https://platform.claude.com/docs/en/agent-sdk/python)：

```python
# ❌ 错误 - 不要在没有参数时调用 connect()
client = ClaudeSDKClient(options)
await client.connect()  # 这可能会干扰会话连续性！
await client.query(message)

# ✅ 正确 - 让 SDK 在第一次 query() 时自动连接
client = ClaudeSDKClient(options)
await client.query(message)  # SDK 会自动处理连接
await client.query(next_message)  # 继续同一会话，保留上下文
```

**重要提示**: `connect()` 方法用于发送**可选的初始提示**。如果不传入参数调用它，可能会创建一个空的初始状态，干扰后续的会话连续性。SDK 会在第一次调用 `query()` 时自动建立连接。

### 会话存储结构
```python
sessions = {
    "uuid-1": SessionInfo(
        session_id="uuid-1",
        client=ClaudeSDKClient(...),
        created_at=datetime(...),
        last_accessed=datetime(...)
    ),
    "uuid-2": SessionInfo(...),
    ...
}
```

## 未来扩展

可能的改进方向：
- [ ] 支持会话持久化（保存到数据库）
- [ ] 支持会话共享（多用户访问同一会话）
- [ ] 添加会话统计和监控
- [ ] 可配置的超时时间
- [ ] 会话导出和导入功能

## 相关文件

**后端：**
- `backend/core/session_manager.py` - 会话管理器
- `backend/app/api/routes/response.py` - API 端点
- `backend/app/main.py` - 应用初始化

**前端：**
- `frontend/src/hooks/useAgentEvents.ts` - React Hook

## 参考文档

- [Claude Agent SDK - Python](https://platform.claude.com/docs/en/agent-sdk/python)
- [ClaudeSDKClient 文档](https://platform.claude.com/docs/en/agent-sdk/python#claudesdkclient)

