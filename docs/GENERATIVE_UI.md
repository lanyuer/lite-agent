# Generative UI 实现文档

## 概述

基于 [AG-UI 协议](https://ag-ui.com/) 的 Generative UI 实现，允许代理动态生成UI组件并影响对话交互方式。

## 核心概念

根据 AG-UI 协议，Generative UI 包含两种模式：

1. **Generative UI, static**: 渲染模型输出为稳定的、类型化的组件
2. **Generative UI, declarative**: 小型声明式语言，代理提出组件树和约束，应用验证并挂载

## 实现架构

### 1. 事件类型

**后端** (`backend/core/events.py`):
- `UIComponent`: 创建UI组件
- `UIUpdate`: 更新现有组件
- `UIRemove`: 删除组件
- `UIInteraction`: 用户交互事件（前端→后端）

**前端** (`frontend/src/types/events.ts`):
- 对应的TypeScript类型定义

### 2. 组件注册系统

**位置**: `frontend/src/components/GenerativeUI.tsx`

内置组件类型：
- `button`: 按钮组件
- `image`: 图片组件
- `card`: 卡片组件
- `form`: 表单组件
- `text`: 文本组件
- `container`: 容器组件

### 3. 动态渲染器

`GenerativeUI` 组件根据 `component_type` 动态渲染相应的React组件：

```tsx
<GenerativeUI
    component={{
        component_id: 'btn1',
        component_type: 'button',
        props: {
            label: 'Click Me',
            variant: 'primary',
            onClick: () => console.log('clicked')
        }
    }}
    onInteraction={(componentId, type, data) => {
        // 发送交互事件到后端
    }}
/>
```

### 4. 状态管理

`EventProcessor` 维护UI组件状态：
- `uiComponents`: Map<component_id, UIComponentState>
- 支持添加、更新、删除操作

## 使用示例

### 后端：生成UI组件

```python
from core.events import UIComponent

# 生成一个按钮组件
yield UIComponent(
    component_id="btn_confirm",
    component_type="button",
    props={
        "label": "确认",
        "variant": "primary"
    },
    message_id=message_id  # 关联到消息
)

# 生成一个图片组件
yield UIComponent(
    component_id="img_result",
    component_type="image",
    props={
        "src": "/api/v1/files/tool_results/image.png",
        "alt": "生成的结果图片"
    },
    message_id=message_id
)

# 生成嵌套组件（卡片包含图片和按钮）
yield UIComponent(
    component_id="card_result",
    component_type="card",
    props={
        "title": "处理结果"
    },
    children=[
        {
            "component_id": "img_result",
            "component_type": "image",
            "props": {"src": "...", "alt": "..."}
        },
        {
            "component_id": "btn_download",
            "component_type": "button",
            "props": {"label": "下载", "variant": "secondary"}
        }
    ],
    message_id=message_id
)
```

### 前端：处理用户交互

```tsx
const { sendUIInteraction } = useAgentEvents();

// 用户点击按钮时
<GenerativeUI
    component={component}
    onInteraction={(componentId, interactionType, data) => {
        sendUIInteraction(componentId, interactionType, data);
        // 后端可以响应这个交互，更新UI或执行操作
    }}
/>
```

## 组件类型详解

### Button

```json
{
  "component_type": "button",
  "props": {
    "label": "按钮文本",
    "variant": "primary" | "secondary",
    "disabled": false,
    "onClick": "callback_id"
  }
}
```

### Image

```json
{
  "component_type": "image",
  "props": {
    "src": "图片URL",
    "alt": "替代文本",
    "width": 300,
    "height": 200
  }
}
```

### Card

```json
{
  "component_type": "card",
  "props": {
    "title": "卡片标题",
    "content": "卡片内容",
    "onClick": "callback_id"
  },
  "children": [/* 嵌套组件 */]
}
```

### Form

```json
{
  "component_type": "form",
  "props": {
    "fields": [
      {
        "name": "username",
        "type": "text",
        "label": "用户名",
        "placeholder": "请输入用户名",
        "required": true
      },
      {
        "name": "email",
        "type": "email",
        "label": "邮箱"
      }
    ],
    "submitLabel": "提交",
    "onSubmit": "callback_id"
  }
}
```

## 交互流程

1. **代理生成UI组件**
   ```
   后端 → UIComponent事件 → 前端
   ```

2. **前端渲染组件**
   ```
   EventProcessor处理 → 更新状态 → EventMessage渲染
   ```

3. **用户交互**
   ```
   用户操作 → onInteraction回调 → sendUIInteraction → 后端
   ```

4. **后端响应（可选）**
   ```
   后端接收UIInteraction → 处理逻辑 → 更新UI（UIUpdate）或执行操作
   ```

## 扩展自定义组件

```tsx
// 注册自定义组件
const customComponents = {
    chart: (props, onInteraction) => {
        // 渲染图表组件
        return <Chart {...props} />;
    },
    map: (props, onInteraction) => {
        // 渲染地图组件
        return <Map {...props} />;
    }
};

<GenerativeUI
    component={component}
    customComponents={customComponents}
    onInteraction={onInteraction}
/>
```

## 与工具调用集成

Generative UI 可以与工具调用结果结合：

```python
# 工具返回图片后，生成UI组件展示
yield ToolCallResult(
    tool_call_id=call_id,
    content="/api/v1/files/image.png",
    metadata={"content_type": "image"}
)

# 同时生成交互式UI组件
yield UIComponent(
    component_id="img_viewer",
    component_type="card",
    props={"title": "生成的图片"},
    children=[{
        "component_id": "img",
        "component_type": "image",
        "props": {"src": "/api/v1/files/image.png"}
    }],
    message_id=message_id
)
```

## 优势

1. **动态性**: 代理可以根据上下文动态生成UI
2. **交互性**: 支持双向交互，用户操作可以影响代理行为
3. **可扩展**: 易于添加新的组件类型
4. **类型安全**: 完整的TypeScript类型支持
5. **符合标准**: 基于AG-UI协议，可与其他AG-UI兼容系统互操作

## 参考

- [AG-UI 官方文档](https://ag-ui.com/)
- [AG-UI Generative UI 规范](https://ag-ui.com/concepts/generative-ui)
- [AG-UI 事件协议](https://ag-ui.com/concepts/events)


