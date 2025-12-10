# Lite Agent Backend

FastAPI-based backend for Lite Agent application.

## 目录结构

```
backend/
├── app/                      # 应用主目录
│   ├── main.py              # FastAPI应用入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接和初始化
│   ├── dependencies.py      # FastAPI依赖注入
│   │
│   ├── models/              # 数据库模型（按实体拆分）
│   │   ├── __init__.py
│   │   ├── task.py         # Task模型
│   │   └── conversation.py # Conversation模型
│   │
│   ├── schemas/             # Pydantic schemas（请求/响应模型）
│   │   ├── __init__.py
│   │   ├── task.py         # Task相关schemas
│   │   ├── conversation.py # Conversation相关schemas
│   │   └── chat.py         # Chat相关schemas
│   │
│   ├── services/            # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── task_service.py         # Task业务逻辑
│   │   └── conversation_service.py # Conversation业务逻辑
│   │
│   └── api/                 # API层
│       ├── __init__.py
│       └── v1/              # API版本1
│           ├── __init__.py
│           ├── router.py    # 聚合所有端点
│           └── endpoints/   # 端点实现
│               ├── __init__.py
│               ├── tasks.py      # Task管理端点
│               ├── chat.py       # Chat端点（legacy）
│               └── response.py   # Response端点（主要）
│
├── core/                    # 核心功能
│   ├── __init__.py
│   ├── events.py           # 事件定义
│   └── adapters.py         # 事件适配器
│
├── requirements.txt         # Python依赖
├── pyproject.toml          # 项目配置
└── REFACTORING.md          # 重构说明文档
```

## 架构设计

### 分层架构

1. **API层** (`app/api/v1/endpoints/`)
   - 处理HTTP请求/响应
   - 参数验证（通过Pydantic schemas）
   - 调用Service层处理业务逻辑

2. **Service层** (`app/services/`)
   - 包含所有业务逻辑
   - 数据库操作
   - 数据验证和处理

3. **Model层** (`app/models/`)
   - SQLAlchemy数据库模型
   - 数据库表定义

4. **Schema层** (`app/schemas/`)
   - Pydantic模型
   - 请求/响应数据验证
   - API文档自动生成

### 依赖注入

使用FastAPI的`Depends`进行依赖注入：

```python
from app.dependencies import get_db

@router.get("/tasks")
async def list_tasks(db: Session = Depends(get_db)):
    return TaskService.list_tasks(db)
```

## API端点

### 新API（推荐）
- `POST /api/v1/tasks` - 创建任务
- `GET /api/v1/tasks` - 获取任务列表
- `GET /api/v1/tasks/{id}` - 获取任务详情
- `PUT /api/v1/tasks/{id}` - 更新任务
- `DELETE /api/v1/tasks/{id}` - 删除任务
- `POST /api/v1/response` - 发送消息并获取响应

### 旧API（向后兼容）
所有`/api/v1/*`端点也同时提供`/api/*`版本，确保向后兼容。

## 开发指南

### 添加新端点

1. **定义Schema** (`app/schemas/`)
```python
# app/schemas/example.py
from pydantic import BaseModel

class ExampleCreate(BaseModel):
    name: str

class ExampleResponse(BaseModel):
    id: int
    name: str
```

2. **实现Service** (`app/services/`)
```python
# app/services/example_service.py
class ExampleService:
    @staticmethod
    def create_example(db: Session, data: ExampleCreate):
        # 业务逻辑
        pass
```

3. **创建端点** (`app/api/v1/endpoints/`)
```python
# app/api/v1/endpoints/example.py
@router.post("", response_model=ExampleResponse)
async def create_example(
    data: ExampleCreate,
    db: Session = Depends(get_db)
):
    return ExampleService.create_example(db, data)
```

4. **注册路由** (`app/api/v1/router.py`)
```python
from app.api.v1.endpoints import example
api_router.include_router(example.router, prefix="/examples", tags=["examples"])
```

### 添加新模型

1. **创建模型文件** (`app/models/`)
```python
# app/models/example.py
from app.database import Base

class Example(Base):
    __tablename__ = "examples"
    id = Column(Integer, primary_key=True)
    name = Column(String(255))
```

2. **导出模型** (`app/models/__init__.py`)
```python
from app.models.example import Example
__all__ = ["Example"]
```

3. **创建Schema** (`app/schemas/`)
4. **实现Service** (`app/services/`)

## 运行

```bash
# 安装依赖
pip install -r requirements.txt

# 运行开发服务器
uvicorn app.main:app --reload

# 或使用Python直接运行
python -m app.main
```

## 测试

```bash
# 运行测试（如果配置了）
pytest

# 查看API文档
# 访问 http://localhost:8000/docs
```

## 最佳实践

1. **保持关注点分离**: API层只处理HTTP，业务逻辑在Service层
2. **使用类型提示**: 所有函数都应该有类型提示
3. **文档字符串**: 所有公共函数都应该有文档字符串
4. **错误处理**: 使用FastAPI的HTTPException处理错误
5. **数据库事务**: 在Service层管理数据库事务

## 迁移说明

详细的迁移指南请参考 [REFACTORING.md](./REFACTORING.md)
