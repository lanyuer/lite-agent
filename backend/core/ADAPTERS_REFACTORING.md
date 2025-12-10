# EventAdapter 重构方案

## 当前问题分析

### 1. **代码复杂度高**
- 288 行代码，包含大量条件分支
- `_convert_message` 方法有 6+ 个 if-elif 分支
- `_convert_content_block` 方法有 5+ 个条件分支

### 2. **重复代码**
- `chunk_size = 10` 和 `asyncio.sleep(0.01)` 在多处重复
- 类似的流式处理逻辑重复出现

### 3. **类型不安全**
- 大量使用 `getattr()` 和 `hasattr()`
- 缺乏类型注解和类型检查
- 难以在 IDE 中获得类型提示

### 4. **职责不清**
- 单个方法处理多种消息类型
- 转换逻辑和流式处理逻辑混合

### 5. **难以扩展**
- 添加新消息类型需要修改核心方法
- 难以单独测试某个转换器

## 重构方案

### 核心改进

1. **策略模式 (Strategy Pattern)**
   - 每种消息类型有独立的转换器类
   - 使用 `can_handle()` 方法判断是否处理
   - 易于添加新的转换器

2. **提取常量**
   ```python
   STREAMING_CHUNK_SIZE = 10
   STREAMING_DELAY = 0.01
   ```

3. **分离关注点**
   - `MessageConverter`: 处理消息级别转换
   - `ContentBlockConverter`: 处理内容块转换
   - `ToolCallConverter`: 处理工具调用转换

4. **更好的代码组织**
   - 每个转换器职责单一
   - 易于单独测试
   - 易于理解和维护

### 对比

| 方面 | 当前版本 | 重构版本 |
|------|---------|---------|
| 代码行数 | 288 行 | ~350 行（但结构更清晰） |
| 条件分支 | 集中在一个方法 | 分散到多个转换器 |
| 可测试性 | 难以单独测试 | 每个转换器可独立测试 |
| 可扩展性 | 需要修改核心方法 | 只需添加新转换器 |
| 类型安全 | 弱（大量 getattr） | 更强（明确的接口） |
| 代码复用 | 低（重复代码多） | 高（提取了公共逻辑） |

### 使用示例

```python
# 当前版本
adapter = EventAdapter()
async for event in adapter.adapt_message_stream(messages):
    yield event

# 重构版本（API 保持不变）
adapter = EventAdapter()
async for event in adapter.adapt_message_stream(messages):
    yield event
```

### 迁移建议

1. **渐进式迁移**
   - 保留原 `adapters.py` 作为备份
   - 创建 `adapters_refactored.py` 进行测试
   - 逐步替换使用点

2. **测试覆盖**
   - 为每个转换器编写单元测试
   - 确保行为一致性

3. **性能考虑**
   - 重构版本可能有轻微性能开销（多一层抽象）
   - 但可维护性提升显著

## 建议

**推荐采用重构方案**，因为：
- ✅ 代码更易维护和扩展
- ✅ 更容易添加新功能
- ✅ 更容易测试和调试
- ✅ 代码结构更清晰

如果担心迁移风险，可以先：
1. 并行运行两个版本
2. 逐步迁移
3. 充分测试后再完全替换

