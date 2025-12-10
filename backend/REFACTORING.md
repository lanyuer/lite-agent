# 后端代码重构说明

## 新的目录结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接和初始化
│   ├── dependencies.py      # FastAPI依赖注入
│   │
│   ├── models/              # 数据库模型（按实体拆分）
│   │   ├── __init__.py
│   │   ├── task.py
│   │   └── conversation.py
│   │
│   ├── schemas/             # Pydantic schemas（请求/响应模型）
│   │   ├── __init__.py
│   │   ├── task.py
│   │   ├── conversation.py
│   │   └── chat.py
│   │
│   ├── services/            # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── task_service.py
│   │   └── conversation_service.py
│   │
│   └── api/                 # API层
│       ├── __init__.py
│       └── v1/              # API版本
│           ├── __init__.py
│           ├── router.py    # 聚合所有端点
│           └── endpoints/   # 端点实现
│               ├── __init__.py
│               ├── tasks.py
│               ├── chat.py
│               └── response.py
│
├── core/                    # 核心功能（事件系统、适配器）
│   ├── __init__.py
│   ├── events.py
│   └── adapters.py
│
├── requirements.txt
└── pyproject.toml
```

## 架构设计原则

### 1. 分层架构
- **API层** (`app/api/v1/endpoints/`): 处理HTTP请求/响应，参数验证
- **Service层** (`app/services/`): 业务逻辑，数据操作
- **Model层** (`app/models/`): 数据库模型定义
- **Schema层** (`app/schemas/`): 请求/响应数据验证

### 2. 关注点分离
- 每个模块职责单一，易于测试和维护
- 业务逻辑与API路由分离
- 数据库模型与API模型分离

### 3. 依赖注入
- 使用FastAPI的`Depends`进行依赖注入
- 数据库会话通过`dependencies.py`统一管理

### 4. API版本控制
- 使用`/api/v1`前缀支持未来API版本升级
- 保留`/api`路由用于向后兼容

## 迁移指南

### 导入路径变更

**旧路径（已删除）:**
```python
from app.models import Task, Conversation
from app.database import get_db
from app.api.routes import tasks
```

**新路径（当前使用）:**
```python
from app.models.task import Task
from app.models.conversation import Conversation
from app.dependencies import get_db
from app.api.v1.endpoints import tasks
```

**注意**: 所有旧代码路径已被删除，请使用新路径。

### API端点变更

**旧端点:**
- `POST /api/tasks`
- `GET /api/tasks`
- `POST /api/response`

**新端点（向后兼容）:**
- `POST /api/v1/tasks` 或 `POST /api/tasks`
- `GET /api/v1/tasks` 或 `GET /api/tasks`
- `POST /api/v1/response` 或 `POST /api/response`

## 最佳实践

### 1. 添加新端点
1. 在`app/schemas/`中定义请求/响应模型
2. 在`app/services/`中实现业务逻辑
3. 在`app/api/v1/endpoints/`中创建端点
4. 在`app/api/v1/router.py`中注册路由

### 2. 添加新模型
1. 在`app/models/`中创建模型文件
2. 在`app/models/__init__.py`中导出
3. 在`app/schemas/`中创建对应的schema

### 3. 测试
- Service层应该易于单元测试
- API端点应该易于集成测试
- 使用依赖注入便于mock

## 优势

1. **可扩展性**: 清晰的模块划分，易于添加新功能
2. **可维护性**: 代码组织清晰，易于理解和修改
3. **可测试性**: 业务逻辑与API分离，便于单元测试
4. **团队协作**: 不同开发者可以并行开发不同模块
5. **向后兼容**: 保留旧路由，不影响现有前端代码
