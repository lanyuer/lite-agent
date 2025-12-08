# 项目重构方案

## 当前问题

1. **代码冗余**：存在 `App.tsx` 和 `AppWithEvents.tsx` 两个版本
2. **调试文件未清理**：`debug_msg.py`, `debug_msg_v2.py`, `TestEvents.tsx`
3. **目录结构不够清晰**：缺少明确的分层
4. **文档分散**：多个 markdown 文件没有统一组织

## 新的目录结构

```
lite-agent/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 应用入口
│   │   ├── config.py            # 配置管理
│   │   └── api/
│   │       ├── __init__.py
│   │       └── routes/
│   │           ├── __init__.py
│   │           └── chat.py      # 聊天路由
│   ├── core/
│   │   ├── __init__.py
│   │   ├── events.py            # 事件定义
│   │   └── adapters.py          # 事件适配器
│   ├── requirements.txt
│   └── pyproject.toml           # 现代 Python 项目配置
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx          # 主应用（合并后的版本）
│   │   │   └── App.css
│   │   ├── features/
│   │   │   └── chat/
│   │   │       ├── components/
│   │   │       │   ├── ChatMessage.tsx
│   │   │       │   ├── ChatInput.tsx
│   │   │       │   └── Sidebar.tsx
│   │   │       ├── hooks/
│   │   │       │   └── useAgentEvents.ts
│   │   │       └── types/
│   │   │           └── events.ts
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── StreamingText.tsx
│   │   │   │   └── StreamingMarkdown.tsx
│   │   │   └── lib/
│   │   │       └── EventProcessor.ts
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
│
├── docs/
│   ├── README.md                # 主文档
│   ├── architecture/
│   │   ├── event-system.md
│   │   └── streaming.md
│   └── guides/
│       ├── quick-start.md
│       └── development.md
│
├── .gitignore
├── README.md
└── docker-compose.yml           # 可选：容器化部署
```

## 重构步骤

### 1. 后端重构
- ✅ 创建 `app/` 和 `core/` 目录分离关注点
- ✅ 移动 `events.py` 到 `core/`
- ✅ 移动 `event_adapter.py` 到 `core/adapters.py`
- ✅ 重构 `main.py` 为 `app/main.py` 和 `app/api/routes/chat.py`
- ✅ 添加 `config.py` 统一配置管理
- ✅ 删除调试文件

### 2. 前端重构
- ✅ 删除 `App.tsx`（保留 `AppWithEvents.tsx` 并重命名为 `App.tsx`）
- ✅ 删除 `TestEvents.tsx`
- ✅ 删除 `MessageItem.tsx`（已被 `EventMessage.tsx` 替代）
- ✅ 按功能组织代码（features/chat）
- ✅ 提取共享组件到 `shared/`
- ✅ 清理未使用的 CSS 文件

### 3. 文档整理
- ✅ 合并所有文档到 `docs/` 目录
- ✅ 创建清晰的 README
- ✅ 添加架构图

### 4. 配置优化
- ✅ 添加 `.env.example`
- ✅ 优化 `.gitignore`
- ✅ 添加 `pyproject.toml`
- ✅ 添加 ESLint 和 Prettier 配置

## 预期效果

1. **清晰的分层**：业务逻辑、核心功能、API 路由分离
2. **易于扩展**：新功能可以作为新的 feature 添加
3. **代码精简**：删除 30% 的冗余代码
4. **现代化**：符合 2024 年的最佳实践
5. **快速迭代**：模块化设计支持独立开发和测试
