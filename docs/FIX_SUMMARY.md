# 问题修复总结

## 问题诊断

前端无法显示后端发送的事件，原因是：**字段命名不匹配**

- **后端 (Python/Pydantic)**: 默认使用蛇形命名 (`thinking_id`, `message_id`, `tool_call_id`)
- **前端 (TypeScript)**: 使用驼峰命名 (`thinkingId`, `messageId`, `toolCallId`)

## 解决方案

### 1. 配置 Pydantic 使用驼峰命名别名

**文件**: `backend/events.py`

```python
from pydantic import BaseModel, Field, ConfigDict

class BaseEvent(BaseModel):
    """Base class for all events."""
    model_config = ConfigDict(
        populate_by_name=True, 
        alias_generator=lambda x: ''.join(
            word.capitalize() if i > 0 else word 
            for i, word in enumerate(x.split('_'))
        )
    )
    
    type: str
    timestamp: datetime = Field(default_factory=datetime.now)
    raw_event: Optional[Dict[str, Any]] = Field(default=None, alias='rawEvent')
```

### 2. 序列化时使用别名

**文件**: `backend/main.py`

```python
# 使用 by_alias=True 来输出驼峰命名的 JSON
event_json = event.model_dump_json(by_alias=True)
```

### 3. 修复前端依赖问题

**文件**: `frontend/src/hooks/useAgentEvents.ts`

- 将 `updateState` 移到 `useEffect` 之前，避免闭包问题
- 正确设置依赖数组

### 4. 修复 TypeScript 类型问题

**文件**: `frontend/src/lib/EventProcessor.ts`

- 使用 `as any` 类型断言解决 switch 语句中的类型缩小问题
- 重命名 `CustomEvent` 为 `AgentCustomEvent` 避免与 DOM 的 `CustomEvent` 冲突

## 测试验证

创建了 `TestEvents.tsx` 用于调试，可以直接查看原始事件流。

## 当前状态

✅ 后端正确发送驼峰命名的事件
✅ 前端正确接收和处理事件
✅ EventProcessor 正确更新状态
✅ UI 正确显示消息、思考和工具调用

## 使用方法

1. 确保后端运行: `python backend/main.py`
2. 确保前端运行: `npm run dev` (in frontend/)
3. 打开 http://localhost:5173
4. 输入消息并发送
5. 查看流式输出效果

## 事件流示例

```json
{"type":"RunStarted","timestamp":"...","runId":"..."}
{"type":"ThinkingStart","timestamp":"...","thinkingId":"..."}
{"type":"ThinkingContent","timestamp":"...","thinkingId":"...","delta":"..."}
{"type":"ThinkingEnd","timestamp":"...","thinkingId":"..."}
{"type":"TextMessageStart","timestamp":"...","messageId":"...","role":"assistant"}
{"type":"TextMessageContent","timestamp":"...","messageId":"...","delta":"..."}
{"type":"TextMessageEnd","timestamp":"...","messageId":"..."}
{"type":"RunFinished","timestamp":"...","runId":"..."}
```

## 注意事项

- API Key 需要配置才能正常使用 Claude Agent SDK
- 可以通过 `/login` 命令配置 API Key
- 或者在 `.env.local` 中设置环境变量
