# 代码清理说明

## 已删除的文件

### 1. 旧的API路由目录
- `app/api/routes/__init__.py`
- `app/api/routes/tasks.py`
- `app/api/routes/chat.py`
- `app/api/routes/response.py`

**原因**: 已被 `app/api/v1/endpoints/` 目录替代

### 2. 旧的模型文件
- `app/models.py`

**原因**: 已被 `app/models/` 目录结构替代（`app/models/task.py` 和 `app/models/conversation.py`）

### 3. 旧的适配器文件
- `core/adapters_old.py`

**原因**: 已被 `core/adapters.py` 替代，且没有被任何代码引用

## 当前代码结构

所有代码现在统一使用新的目录结构：

```
backend/
├── app/
│   ├── models/          # ✅ 使用新的模型目录
│   ├── schemas/         # ✅ 使用新的schemas目录
│   ├── services/        # ✅ 使用新的services目录
│   └── api/v1/          # ✅ 使用新的API版本化结构
└── core/
    └── adapters.py      # ✅ 使用新的适配器
```

## 导入路径规范

### ✅ 正确的导入方式

```python
# 模型导入
from app.models.task import Task
from app.models.conversation import Conversation

# Schema导入
from app.schemas.task import TaskCreate, TaskResponse
from app.schemas.chat import ResponseRequest

# Service导入
from app.services.task_service import TaskService
from app.services.conversation_service import ConversationService

# API端点导入
from app.api.v1.endpoints import tasks, chat, response

# 依赖注入
from app.dependencies import get_db
```

### ❌ 已废弃的导入方式（不再使用）

```python
# 这些导入路径已删除，不再可用
from app.models import Task, Conversation  # ❌
from app.api.routes import tasks  # ❌
from app.database import get_db  # ❌ (已移动到app.dependencies)
```

## 迁移检查清单

- [x] 删除 `app/api/routes/` 目录
- [x] 删除 `app/models.py`
- [x] 删除 `core/adapters_old.py`
- [x] 更新所有导入路径到新结构
- [x] 确保所有代码使用新的目录结构
- [x] 更新文档说明新的导入路径

## 注意事项

1. **向后兼容**: API端点仍然同时提供 `/api/v1/*` 和 `/api/*` 路由，确保前端代码无需修改
2. **数据库兼容**: 数据库模型保持不变，只是文件组织方式改变
3. **功能完整**: 所有功能都已迁移到新结构，没有功能缺失
