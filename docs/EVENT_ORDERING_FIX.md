# 事件顺序显示修复

## 问题
前端接收到所有事件，但显示不完整。消息、思考和工具调用分别渲染，没有按照时间顺序混合显示。

## 根本原因
`AppWithEvents.tsx` 中分别渲染三种类型的事件：
```tsx
{state.messages.map(...)}
{state.thinking.map(...)}
{state.toolCalls.map(...)}
```

这导致所有消息先显示，然后所有思考，最后所有工具调用，而不是按照实际发生的顺序。

## 解决方案

### 1. 添加序号跟踪 (EventProcessor.ts)

在每个状态接口中添加 `sequence` 字段：
```typescript
export interface MessageState {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    isComplete: boolean;
    sequence: number; // 用于排序
}

export interface RunState {
    // ...
    sequenceCounter: number; // 全局序号计数器
}
```

### 2. 在创建状态时分配序号

```typescript
case 'TextMessageStart':
    this.state.messages.set((event as any).messageId, {
        id: (event as any).messageId,
        role: (event as any).role,
        content: '',
        isComplete: false,
        sequence: this.state.sequenceCounter++, // 分配并递增
    });
    break;
```

### 3. 创建统一时间线 (AppWithEvents.tsx)

```typescript
{(() => {
    const timeline: Array<{
        id: string;
        type: 'message' | 'thinking' | 'toolCall';
        data: any;
        sequence: number;
    }> = [];

    // 添加所有消息
    state.messages.forEach(msg => {
        timeline.push({ 
            id: msg.id, 
            type: 'message', 
            data: msg,
            sequence: msg.sequence 
        });
    });

    // 添加所有思考
    state.thinking.forEach(think => {
        timeline.push({ 
            id: think.id, 
            type: 'thinking', 
            data: think,
            sequence: think.sequence 
        });
    });

    // 添加所有工具调用
    state.toolCalls.forEach(tool => {
        timeline.push({ 
            id: tool.id, 
            type: 'toolCall', 
            data: tool,
            sequence: tool.sequence 
        });
    });

    // 按序号排序
    timeline.sort((a, b) => a.sequence - b.sequence);
    
    // 渲染
    return timeline.map(item => {
        switch (item.type) {
            case 'message':
                return <EventMessage key={item.id} message={item.data} />;
            case 'thinking':
                return <EventMessage key={item.id} thinking={item.data} />;
            case 'toolCall':
                return <EventMessage key={item.id} toolCall={item.data} />;
        }
    });
})()}
```

## 效果

现在事件按照实际发生的顺序显示：
1. 用户消息
2. Thinking 开始
3. Thinking 内容（流式）
4. Thinking 结束
5. 助手消息开始
6. 助手消息内容（流式）
7. 助手消息结束
8. 工具调用（如果有）

## 测试

刷新页面，发送消息"hello"，应该看到：
- 用户消息 "hello"
- THINKING 块显示思考过程
- 助手回复 "Hello! How can I help you today?"

所有内容按照正确的时间顺序显示。
