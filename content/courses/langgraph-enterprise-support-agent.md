---
title: LangGraph 企业客服 Agent 渐进式教程
description: 使用 TypeScript、Hono、PostgreSQL 与 Drizzle 构建可持久化、可审批的企业客服 Agent
---

# LangGraph 渐进式实战教程

> 技术栈：TypeScript + Hono + PostgreSQL + Drizzle
> 最终项目：企业内部管理客服 Agent
> 学习原则：先确定性工作流，再 LLM 工作流，最后才是自主 Agent

---

## 0. 这套教程能让你学会什么

完成全部课程后，你应该能够独立完成下面这条链路：

```text
员工提问
  ↓
Hono 接收请求并完成身份校验
  ↓
LangGraph 保存会话状态、理解问题并选择流程
  ├─ 查询企业知识库
  ├─ 通过 Drizzle 查询业务数据
  ├─ 创建工单或提出操作建议
  └─ 高风险操作暂停，等待人工审批
  ↓
Hono 通过 SSE 流式返回结果
  ↓
PostgreSQL 保存业务数据、会话检查点、长期记忆与审计记录
```

你将掌握的 LangGraph 高频能力：

- `StateSchema`、`StateGraph`、`GraphNode`、`START`、`END`
- 普通状态字段、`MessagesValue`、`ReducedValue` 与 reducer
- `addNode()`、`addEdge()`、`addConditionalEdges()`
- `Command` 动态更新状态和跳转
- `invoke()`、`stream()`、`streamEvents()`
- LLM 结构化输出、工具调用、`ToolNode`
- checkpointer、`thread_id`、短期记忆
- store、跨线程长期记忆
- `interrupt()` 与 `Command({ resume })` 人工审批
- 重试、幂等、错误分类、测试、可观测性和子图

### 先建立正确的技术边界

| 组件 | 负责什么 | 不负责什么 |
|---|---|---|
| LangGraph | Agent 的状态、步骤、路由、暂停、恢复和持久执行 | HTTP 服务和业务表 ORM |
| Hono | HTTP 路由、鉴权、参数校验、SSE 响应 | 决定 Agent 的业务步骤 |
| Drizzle | 员工、知识条目、工单、审批、审计等业务数据 | LangGraph 运行时的状态机 |
| PostgreSQL | 统一的持久化基础设施 | 自己决定数据如何流转 |
| LangGraph PostgresSaver | LangGraph thread 的 checkpoints | 代替 Drizzle 管理业务表 |
| LangGraph PostgresStore | 跨 thread 的用户偏好和长期记忆 | 代替正式企业知识库 |

最重要的一句话：**LangGraph 是流程编排器，不是模型，不是 Web 框架，也不是 ORM。**

---

## 1. 推荐学习节奏

不要一次把 14 课全部看完。每课都采用相同循环：

1. 先阅读“为什么学”。
2. 自己输入示例，不要只复制。
3. 运行并观察状态变化。
4. 关闭教程，凭记忆重新写关键部分。
5. 完成练习，达到“完成标准”后再进入下一课。

建议安排：

| 周次 | 课程 | 阶段目标 |
|---|---|---|
| 第 1 周 | 第 1～3 课 | 不使用 LLM，理解图、状态、节点和路由 |
| 第 2 周 | 第 4～5 课 | 加入 LLM 和工具循环 |
| 第 3 周 | 第 6～7 课 | 接入 Drizzle 和 PostgreSQL 持久化 |
| 第 4 周 | 第 8～10 课 | 接入 Hono、流式输出、人工审批 |
| 第 5 周 | 第 11～12 课 | 记忆、知识库与检索 |
| 第 6 周 | 第 13～14 课 | 测试、可靠性与最终项目 |

### 课程学习规则

从第 1 课到第 14 课只维护**同一个企业客服项目**。除非课程明确写出“这是一处有原因的重构”，否则：

- 下一课以前一课的最终代码为起点，继续扩展同一个 State 和 graph。
- `question → category/urgency → answer` 这条主线会一直保留，后面再逐步升级为 messages、LLM、tools 和持久化。
- 每课只增加一个主要概念，并保持相同的企业客服业务场景。
- 每课练习分为“必做”和“进阶”；只完成必做即可进入下一课。
- 正式 Vitest 测试统一放到第 13 课；前面课程只使用 3～4 组输入手动验证。
- 第 3 课学习条件边；第 10 课在人工审批场景中学习 `Command`。

建议保留学习快照：

```text
src/agent/lesson-01.ts
src/agent/lesson-02.ts
src/agent/lesson-03.ts
...
```

开始新课时复制上一课文件，再在副本上修改。这样既保持连续，又能随时对照变化。

### 14 课的累计主线

| 课程 | 以前一课为基础只增加什么 |
|---|---|
| 第 1 课 | 固定图：state、node、edge |
| 第 2 课 | 在同一个 state 中加入 logs、计数和去重 warnings |
| 第 3 课 | 把一条固定边替换成条件边 |
| 第 4 课 | 用 LLM 结构化输出替换关键词分类，保留原路由 |
| 第 5 课 | 给回答分支增加 messages 和工具循环 |
| 第 6 课 | 把假工具的数据源替换成 Drizzle/PostgreSQL |
| 第 7 课 | 给现有 graph 加 checkpointer 和 thread_id |
| 第 8 课 | 用最小 Hono route 调用同一个 graph |
| 第 9 课 | 把普通 JSON 响应升级为 SSE 流式响应 |
| 第 10 课 | 给写操作增加 Command、interrupt 和恢复 |
| 第 11 课 | 在 checkpointer 之外增加跨 thread 的长期记忆 |
| 第 12 课 | 在第 6 课检索结果上增加引用和无依据降级 |
| 第 13 课 | 为现有路由、节点和图补正式测试与可靠性策略 |
| 第 14 课 | 整理为可运行的企业内部客服第一版 |

---

## 2. 开发环境与项目骨架

本教程使用 `pnpm`。如果你使用 npm，把 `pnpm add` 换成 `npm install` 即可。

```bash
mkdir internal-support-agent
cd internal-support-agent
pnpm init

pnpm add \
  hono @hono/node-server \
  @langchain/langgraph @langchain/core @langchain/openai \
  @langchain/langgraph-checkpoint-postgres \
  drizzle-orm pg zod dotenv

pnpm add -D \
  typescript tsx drizzle-kit vitest \
  @types/node @types/pg
```

> 版本提醒：本教程采用 2026-07 官方 TypeScript 文档中的 `StateSchema` / `MessagesValue` / `ReducedValue` 写法。网上较旧教程常用 `Annotation.Root`；两套示例不要在同一个学习阶段混着抄。安装时不固定死版本，但请提交 lockfile，团队和 CI 使用同一组依赖版本。

建议目录：

```text
internal-support-agent/
├─ src/
│  ├─ agent/
│  │  ├─ state.ts
│  │  ├─ graph.ts
│  │  ├─ nodes/
│  │  └─ tools/
│  ├─ api/
│  │  └─ agent.route.ts
│  ├─ db/
│  │  ├─ client.ts
│  │  └─ schema.ts
│  ├─ services/
│  └─ index.ts
├─ test/
├─ drizzle.config.ts
├─ tsconfig.json
└─ .env
```

`.env`：

```dotenv
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-5.4-mini
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internal_agent
```

`tsconfig.json` 可从这个最小版本开始：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "test", "drizzle.config.ts"]
}
```

> 不要急着创建所有文件。每一课只增加当前需要的最小内容。

---

# 第一阶段：先学工作流，不使用 LLM

## 第 1 课：写出第一个确定性 StateGraph

### 为什么先不接 LLM

如果第一个示例就同时出现模型、提示词、工具、数据库和 HTTP，你很难判断一个问题属于哪一层。第一课只学三个概念：**状态、节点、边**。

### 本课目标

- 理解 graph 不是流程图图片，而是可执行状态机。
- 理解 node 接收旧状态，返回“状态更新”。
- 能用 `START` 和 `END` 串起一个最小流程。

创建 `src/agent/lesson-01.ts`：

```ts
import {
  END,
  START,
  StateGraph,
  StateSchema,
  type GraphNode,
} from "@langchain/langgraph";
import { z } from "zod/v4";

const SupportState = new StateSchema({
  question: z.string(),
  category: z.string().default("unknown"),
  answer: z.string().default(""),
});

const classify: GraphNode<typeof SupportState> = (state) => {
  const category = state.question.includes("密码") ? "account" : "general";
  return { category };
};

const generateAnswer: GraphNode<typeof SupportState> = (state) => {
  const text =
    state.category === "account"
      ? "请进入设置 > 安全中心 > 修改密码。"
      : "该问题需要进一步确认。";

  return { answer: text };
};

const graph = new StateGraph(SupportState)
  .addNode("classify", classify)
  // 节点名不能与 state 字段名 answer 相同。
  .addNode("generateAnswer", generateAnswer)
  .addEdge(START, "classify")
  .addEdge("classify", "generateAnswer")
  .addEdge("generateAnswer", END)
  .compile();

const result = await graph.invoke({
  question: "我忘记密码了",
});

console.log(result);
```

运行：

```bash
pnpm tsx src/agent/lesson-01.ts
```

### 逐步理解

```text
初始输入
{ question: "我忘记密码了" }
       ↓ classify
{ category: "account" }
       ↓ generateAnswer
{ answer: "请进入设置..." }
       ↓
最终状态 = 初始状态 + 两个节点返回的更新
```

节点不要返回完整状态。它只需要返回自己负责更新的字段。

### 知识点总结

- `StateSchema` 定义图中允许存在的数据。
- `GraphNode<typeof SupportState>` 让节点输入输出获得 TypeScript 类型检查。
- `StateGraph` 负责注册节点和连接关系。
- 节点名称不能与 state 字段名称重复，例如 state 已有 `answer` 时，节点应命名为 `generateAnswer`。
- `START` 是图入口，`END` 是图出口。
- `compile()` 把“图的定义”变成可执行对象。
- `invoke()` 执行一次图并返回最终状态。

### 方法总结

遇到一个业务流程时，先写三张清单：

1. 流程要保存哪些数据？这就是 state。
2. 流程有哪些独立步骤？这些是 nodes。
3. 步骤按什么顺序运行？这些是 edges。

### 练习题

1. 增加 `urgency` 字段；问题包含“紧急”时设为 `high`。
2. 增加一个 `formatAnswer` 节点，在答案前加 `[account]`。
3. 把输入改成“打印机无法使用”，观察每个字段最终是什么。

### 完成标准

你能不看示例，独立写出 `START -> A -> B -> END`，并解释 state 为什么不是普通的全局变量。

---

## 第 2 课：理解状态更新、MessagesValue 与 reducer

### 本课目标

- 区分“覆盖字段”和“累积字段”。
- 理解为什么多个节点写同一字段时需要 reducer。
- 理解对话消息为什么适合 `MessagesValue`。

### 本课起点

复制第 1 课最终代码为 `lesson-02.ts`。保留第 1 课的 `question`、`category`、`urgency`、`answer` 和所有节点，向 `SupportState` 增加累计字段，并让现有节点提交更新。

普通的 `z.string()` 字段默认使用后一次更新覆盖前一次更新。需要累积数组时，使用 `ReducedValue`：

```ts
import {
  ReducedValue,
  StateSchema,
} from "@langchain/langgraph";
import { z } from "zod/v4";

const SupportState = new StateSchema({
  // 第 1 课已有字段继续保留
  question: z.string(),
  urgency: z.string().default("normal"),
  category: z.string().default("unknown"),
  answer: z.string().default(""),

  // 第 2 课新增字段
  logs: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.array(z.string()),
      reducer: (oldLogs, newLogs) => oldLogs.concat(newLogs),
    },
  ),
});
```

节点只返回新增日志：

```ts
const classify = () => ({ logs: ["1-问题类型定义完成"] });
const answer = () => ({ logs: ["3-问题回答生成完成"] });
```

最终 `logs` 会同时保留两条内容。

对话场景优先使用官方提供的 `MessagesValue`：

```ts
import { MessagesValue, StateSchema } from "@langchain/langgraph";

const ChatState = new StateSchema({
  messages: MessagesValue,
});
```

它已经包含适用于 LangChain message 的合并逻辑，不要自己用 `z.array(z.any())` 模拟。

### 覆盖还是累积

| 字段 | 推荐行为 | 原因 |
|---|---|---|
| `classification` | 覆盖 | 当前分类只有一个有效结果 |
| `draftAnswer` | 覆盖 | 新草稿应替代旧草稿 |
| `messages` | 消息 reducer | 新消息追加，对消息删除也有专门语义 |
| `auditEvents` | 数组 reducer | 每一步都要保留 |
| `toolAttempts` | 数值 reducer | 每个节点贡献增量 |

### 知识点总结

- 普通 state 字段通常使用“最后写入覆盖”。
- `ReducedValue` 用 reducer 合并旧值和新值。
- reducer 必须可预测，最好是纯函数。
- `MessagesValue` 是对话消息的专用状态值。
- state 应保存原始数据，不应保存已经拼好的整段 prompt。

### 方法总结

设计每个字段时问一句：**下一次更新是替换它，还是追加到它？**

- 替换：普通 Zod schema。
- 追加/求和/集合合并：`ReducedValue`。
- 对话消息：`MessagesValue`。

### 练习题

必做：

1. 新增 `nodeCallCount`，让当前四个普通节点各返回 `1`，reducer 负责求和；最终应为 `4`。这里还没有工具，所以不要叫 `toolCallCount`。
2. 设计一个 `warnings` 数组字段，使用 reducer 合并新旧警告，并用 `Set` 保证相同警告只保留一次。

进阶：

3. 临时把 `logs` 改回普通数组字段，观察多个节点更新时与 reducer 版本有什么差异；观察完成后恢复 reducer。

### 完成标准

看到一个 state 字段时，你能明确说出它的更新语义，而不是只说“它是 string[]”。

---

## 第 3 课：在现有流程上增加条件边

### 本课目标

- 把第 2 课的一条固定边改成条件边。
- 理解分类节点只更新数据，路由函数只选择下一步。
- 观察不同分支最终如何重新汇合。

### 本课起点

复制第 2 课最终代码为 `lesson-03.ts`。原流程是：

```text
START → classify → generateLevel → generateAnswer → formatAnswer → END
```

本课只修改 `generateLevel` 后面的路线：

```text
generateLevel
  ├─ critical → handoff
  ├─ finance  → financeAnswer
  └─ 其他     → generateAnswer
```

本课只学习条件边。`Command` 在第 10 课结合人工审批学习。

### 1. 扩展已有字段，不创建新 State

把第 2 课已有的两个字段收紧为枚举：

```ts
urgency: z
  .enum(["normal", "high", "critical"])
  .default("normal"),
category: z
  .enum(["account", "finance", "general"])
  .default("general"),
```

其他字段，例如 `question`、`answer`、`logs`、`nodeCallCount` 和 `warnings` 全部继续保留。

### 2. 让原分类节点认识 finance

```ts
const classify: GraphNode<typeof SupportState> = (state) => {
  let category: "account" | "finance" | "general" = "general";

  if (state.question.includes("密码")) {
    category = "account";
  } else if (
    state.question.includes("报销") ||
    state.question.includes("发票") ||
    state.question.includes("付款")
  ) {
    category = "finance";
  }

  return {
    category,
    logs: [`问题被分类为 ${category}`],
    nodeCallCount: 1,
  };
};
```

### 3. 让原紧急程度节点认识 critical

```ts
const level: GraphNode<typeof SupportState> = (state) => {
  let urgency: "normal" | "high" | "critical" = "normal";

  // “非常紧急”也包含“紧急”，所以必须先判断更具体的词。
  if (state.question.includes("非常紧急")) {
    urgency = "critical";
  } else if (state.question.includes("紧急")) {
    urgency = "high";
  }

  return {
    urgency,
    logs: [`问题紧急程度为 ${urgency}`],
    nodeCallCount: 1,
  };
};
```

### 4. 增加两个真正不同的业务节点

```ts
const financeAnswer: GraphNode<typeof SupportState> = () => ({
  answer: "请提供报销单号，我来查询财务处理进度。",
  logs: ["生成财务问题回答"],
  nodeCallCount: 1,
});

const handoff: GraphNode<typeof SupportState> = (state) => ({
  answer:
    state.urgency === "critical"
      ? "该问题被标记为 critical，已经转交人工处理。"
      : "暂时无法确定问题类型，已经转交人工处理。",
  logs: ["问题转交人工处理"],
  nodeCallCount: 1,
});
```

### 5. 路由函数只返回下一个节点名

```ts
const routeRequest = (
  state: typeof SupportState.Type,
): "generateAnswer" | "financeAnswer" | "handoff" => {
  // 风险规则优先于业务分类。
  if (state.urgency === "critical") return "handoff";
  if (state.category === "finance") return "financeAnswer";
  return "generateAnswer";
};
```

路由函数不更新 state，也不生成答案。它只回答一个问题：**下一步去哪个节点？**

### 6. 只替换一条固定边

删除第 2 课的：

```ts
.addEdge("generateLevel", "generateAnswer")
```

换成：

```ts
.addConditionalEdges(
  "generateLevel",
  routeRequest,
  ["generateAnswer", "financeAnswer", "handoff"],
)
```

完整连线部分：

```ts
const graph = new StateGraph(SupportState)
  .addNode("classify", classify)
  .addNode("generateLevel", level)
  .addNode("generateAnswer", answer)
  .addNode("financeAnswer", financeAnswer)
  .addNode("handoff", handoff)
  .addNode("formatAnswer", formatAnswer)
  .addEdge(START, "classify")
  .addEdge("classify", "generateLevel")
  .addConditionalEdges(
    "generateLevel",
    routeRequest,
    ["generateAnswer", "financeAnswer", "handoff"],
  )
  .addEdge("generateAnswer", "formatAnswer")
  .addEdge("financeAnswer", "formatAnswer")
  .addEdge("handoff", "formatAnswer")
  .addEdge("formatAnswer", END)
  .compile();
```

三个分支最终都进入 `formatAnswer`，这叫“分支后汇合”。

### 知识点总结

- 普通边永远去同一个节点。
- 条件边调用路由函数，根据当前 state 选择节点。
- 路由前必须先产生路由依赖的数据；因此这里从 `generateLevel` 后开始分支。
- 风险规则通常应先于业务分类规则判断。
- 多个分支可以重新汇合到同一个后续节点。

### 方法总结

先写决策表，再写路由代码：

| 条件 | 下一节点 |
|---|---|
| `urgency === "critical"` | `handoff` |
| 非 critical 且 `category === "finance"` | `financeAnswer` |
| 其他 | `generateAnswer` |

### 练习题

必做：使用下面四组输入运行同一个 graph，观察最终 `category`、`urgency` 和 `answer`：

| 输入 | 预期路线 |
|---|---|
| `我忘记密码了` | `generateAnswer` |
| `我的报销还没到账` | `financeAnswer` |
| `非常紧急，我无法登录` | `handoff` |
| `打印机无法使用` | `generateAnswer` |

进阶：在路由函数中增加 `general → handoff` 规则，并比较“普通未知问题转人工”和“继续给通用回答”两种产品策略。

正式 Vitest 测试和 `Command` 都先不做，分别留到第 13 课和第 10 课。

### 完成标准

你能指出第 2 课的哪一条固定边被替换了，并能在不运行代码时根据 state 判断下一节点。

---

# 第二阶段：加入 LLM，但保持流程可控

## 第 4 课：用结构化输出做意图分类

### 本课目标

- 第一次接入 LLM。
- 让模型返回经过 Zod 约束的对象，而不是自由文本。
- 保持路由规则仍由代码控制。

### 本课起点与唯一重构

复制第 3 课为 `lesson-04.ts`。第 3 课用两个关键词节点分别计算 `category` 和 `urgency`；本课只把这两个关键词节点替换成一个 LLM 结构化分类节点。

```text
第 3 课：classify → generateLevel → routeRequest
第 4 课：classifyWithModel ─────────→ routeRequest
```

`financeAnswer`、`handoff`、`generateAnswer`、`formatAnswer` 和 `routeRequest` 都继续使用。模型不会直接返回节点名。

```ts
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod/v4";
import { type GraphNode } from "@langchain/langgraph";

const ClassificationSchema = z.object({
  category: z.enum(["account", "finance", "general", "unknown"]),
  urgency: z.enum(["normal", "high", "critical"]),
  summary: z.string(),
  reason: z.string(),
});

const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
  temperature: 0,
});

const classifier = model.withStructuredOutput(ClassificationSchema);

const classifyWithModel: GraphNode<typeof SupportState> = async (state) => {
  const classification = await classifier.invoke([
    {
      role: "system",
      content: [
        "你是企业内部客服请求分类器。",
        "只根据用户明确表达的内容分类。",
        "信息不足时使用 unknown，不要猜测。",
      ].join("\n"),
    },
    { role: "user", content: state.question },
  ]);

  return {
    category: classification.category,
    urgency: classification.urgency,
    summary: classification.summary,
    classificationReason: classification.reason,
    logs: ["LLM 结构化分类完成"],
    nodeCallCount: 1,
  };
};
```

在第 3 课的 State 上，把 `category` 扩展为可以表示 `unknown`，并增加两个解释字段：

```ts
category: z
  .enum(["account", "finance", "general", "unknown"])
  .default("unknown"),
summary: z.string().default(""),
classificationReason: z.string().default(""),
```

`routeRequest` 增加一条 unknown 规则，其余逻辑保持一致：

```ts
const routeRequest = (
  state: typeof SupportState.Type,
): "generateAnswer" | "financeAnswer" | "handoff" => {
  if (state.urgency === "critical") return "handoff";
  if (state.category === "unknown") return "handoff";
  if (state.category === "finance") return "financeAnswer";
  return "generateAnswer";
};
```

组图时删除 `generateLevel`，并把条件边移到新的分类节点后：

```ts
.addNode("classify", classifyWithModel)
.addEdge(START, "classify")
.addConditionalEdges(
  "classify",
  routeRequest,
  ["generateAnswer", "financeAnswer", "handoff"],
)
```

这里的设计非常关键：**模型负责识别，代码负责政策和风险边界。**

### 知识点总结

- `withStructuredOutput()` 让模型输出符合 schema 的对象。
- Zod 在运行时校验模型输出，TypeScript 只在编译期提供类型帮助。
- `temperature: 0` 能减少分类任务的随机性，但不能保证绝对正确。
- 模型适合模糊理解；代码适合执行明确业务规则。
- `unknown` 是正常结果，不是失败。

### 方法总结

让 LLM 参与业务流程时，优先采用：

```text
自由文本输入
  → LLM 结构化理解
  → Zod 验证
  → TypeScript 规则路由
```

### 练习题

必做：

1. 运行第 3 课的四组输入，比较关键词分类和 LLM 分类结果。
2. 为结构化 schema 增加 `confidence: z.number().min(0).max(1)`，并把它保存进 state。

进阶：当 `confidence < 0.7` 时让现有路由进入 `handoff`。先手动测试 8 条问题；正式准确率统计留到第 13 课。

### 完成标准

你不会让模型直接返回节点名称或 SQL；模型输出先经过 schema，再由代码决定流程。

---

## 第 5 课：工具调用与 ToolNode Agent 循环

### 本课目标

- 理解 tool 是受控能力，不是任意函数暴露。
- 理解“模型节点 → 工具节点 → 模型节点”的循环。
- 能控制循环结束条件。

### 本课起点与 state 升级

复制第 4 课为 `lesson-05.ts`。前四课用 `question` 表示单轮输入；工具调用必须保存 AI message 和 tool message，所以本课第一次给**同一个 state** 增加 `messages: MessagesValue`。

`AgentState` 继续保留已有的 `category`、`urgency`、`answer`、`logs` 等字段，并增加 `messages`。工具循环替换普通的 `generateAnswer` 分支：

```text
classifyWithModel
  ├─ critical/unknown → handoff
  ├─ finance          → financeAnswer
  └─ 其他             → model ↔ tools → finalizeToolAnswer
```

```ts
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  END,
  START,
  MessagesValue,
  ReducedValue,
  StateGraph,
  StateSchema,
  type GraphNode,
} from "@langchain/langgraph";
import { z } from "zod/v4";

const searchPolicy = tool(
  async ({ query }) => {
    // 第 5 课先返回假数据，第 6 课再接数据库。
    return JSON.stringify({
      title: "年假制度",
      content: `与“${query}”相关：员工应提前提交年假申请。`,
    });
  },
  {
    name: "search_policy",
    description: "查询企业内部制度和操作说明",
    schema: z.object({
      query: z.string().min(2).describe("要查询的制度关键词"),
    }),
  },
);

const tools = [searchPolicy];
const modelWithTools = model.bindTools(tools);

const AgentState = new StateSchema({
  // 第 1～4 课已有字段
  question: z.string(),
  category: z
    .enum(["account", "finance", "general", "unknown"])
    .default("unknown"),
  urgency: z
    .enum(["normal", "high", "critical"])
    .default("normal"),
  summary: z.string().default(""),
  classificationReason: z.string().default(""),
  answer: z.string().default(""),
  logs: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.array(z.string()),
      reducer: (oldLogs, newLogs) => oldLogs.concat(newLogs),
    },
  ),
  nodeCallCount: new ReducedValue(z.number().default(0), {
    inputSchema: z.number(),
    reducer: (oldCount, increment) => oldCount + increment,
  }),
  warnings: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.array(z.string()),
      reducer: (oldWarnings, newWarnings) => [
        ...new Set([...oldWarnings, ...newWarnings]),
      ],
    },
  ),

  // 第 5 课唯一新增的核心字段
  messages: MessagesValue,
});

const callModel: GraphNode<typeof AgentState> = async (state) => {
  const response = await modelWithTools.invoke([
    {
      role: "system",
      content: "你是企业内部客服。需要制度依据时必须先调用工具。",
    },
    ...state.messages,
  ]);

  return { messages: [response] };
};

const shouldContinue = (
  state: typeof AgentState.Type,
): "tools" | "finalizeToolAnswer" => {
  const lastMessage = state.messages.at(-1);
  return lastMessage?.tool_calls?.length
    ? "tools"
    : "finalizeToolAnswer";
};

const finalizeToolAnswer: GraphNode<typeof AgentState> = (state) => {
  const lastMessage = state.messages.at(-1);
  const answer =
    typeof lastMessage?.content === "string"
      ? lastMessage.content
      : "暂时无法生成文本回答。";

  return {
    answer,
    logs: ["工具循环结束，保存最终回答"],
    nodeCallCount: 1,
  };
};

const builder = new StateGraph(AgentState)
  // classifyWithModel、financeAnswer、handoff、formatAnswer
  // 都沿用第 4 课实现，只需把 GraphNode 泛型改为 AgentState。
  .addNode("classify", classifyWithModel)
  .addNode("model", callModel)
  .addNode("tools", new ToolNode(tools))
  .addNode("finalizeToolAnswer", finalizeToolAnswer)
  .addNode("financeAnswer", financeAnswer)
  .addNode("handoff", handoff)
  .addNode("formatAnswer", formatAnswer)
  .addEdge(START, "classify")
  .addConditionalEdges(
    "classify",
    (state) => {
      if (state.urgency === "critical") return "handoff";
      if (state.category === "unknown") return "handoff";
      if (state.category === "finance") return "financeAnswer";
      return "model";
    },
    ["model", "financeAnswer", "handoff"],
  )
  .addConditionalEdges(
    "model",
    shouldContinue,
    ["tools", "finalizeToolAnswer"],
  )
  .addEdge("tools", "model")
  .addEdge("finalizeToolAnswer", "formatAnswer")
  .addEdge("financeAnswer", "formatAnswer")
  .addEdge("handoff", "formatAnswer")
  .addEdge("formatAnswer", END);

const graph = builder.compile();
```

本课调用时同时传入单轮问题和第一条 user message：

```ts
const question = "公司的年假制度是什么？";

await graph.invoke({
  question,
  messages: [{ role: "user", content: question }],
});
```

这是一处明确的过渡。第 8 课的 Hono route 会从一个 HTTP `message` 自动构造这两个输入，调用方不需要手动重复。

运行逻辑：

```text
用户消息
  ↓
model 决定是否调用工具
  ├─ 不调用 → finalizeToolAnswer → formatAnswer → END
  └─ 调用 → ToolNode 执行工具
                ↓
              工具结果加入 messages
                ↓
              回到 model 组织最终答案
```

### 工具设计规则

- 工具名称使用明确动词：`search_policy`、`get_ticket_status`。
- description 说明“什么时候使用”，不是只复述名称。
- 输入使用严格 Zod schema。
- 返回 JSON 可序列化结果。
- 工具内部完成权限检查和组织范围过滤。
- 一个工具只完成一个明确能力。
- 写操作和读操作分开。

### 知识点总结

- `bindTools()` 告诉模型可用工具及其 schema。
- `ToolNode` 执行模型产生的 tool calls，并生成 tool messages。
- 循环由条件边控制，不是无限自动执行。
- 工具结果是证据；模型负责把证据组织成自然语言。
- 工具调用本身仍可能出错，后面要增加重试与错误策略。

### 方法总结

设计工具时使用“最小权限”公式：

```text
一个明确动作 + 最小输入 + 明确返回值 + 内部鉴权 + 可审计
```

### 练习题

必做：

1. 先只保留 `search_policy` 一个假工具，分别输入闲聊和制度问题，观察一次“不调用工具”和一次“调用工具”的 messages。
2. 给工具传入空字符串，观察 Zod schema 如何拒绝无效参数。

进阶：新增 `get_ticket_status` 假工具。最大循环次数、重试和正式工具测试留到第 13 课。

### 完成标准

你能画出完整的 model/tool loop，并知道工具不是“让模型直接执行后端所有函数”。

---

# 第三阶段：接入你的 PostgreSQL + Drizzle 技术栈

## 第 6 课：用 Drizzle 构建企业业务工具

### 本课目标

- 建立企业知识条目和工单表。
- 通过 Drizzle 服务访问业务数据。
- 把窄接口服务包装成 Agent 工具。

### 本课起点

复制第 5 课项目。保留同一个 `AgentState`、同一个 graph 和同一个 `search_policy` 工具定义；本课只把这个假工具内部的静态返回值替换为 Drizzle service 查询。

```text
第 5 课：search_policy → 返回写死的假资料
第 6 课：search_policy → searchKnowledge service → PostgreSQL
```

模型节点、ToolNode 循环和条件边都不需要重写。

### 业务表

`src/db/schema.ts`：

```ts
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const ticketStatus = pgEnum("ticket_status", [
  "open",
  "waiting_human",
  "resolved",
  "closed",
]);

export const knowledgeArticles = pgTable("knowledge_articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  requesterId: uuid("requester_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatus("status").default("open").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

`src/db/client.ts`：

```ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const db = drizzle(process.env.DATABASE_URL);
```

### 先写普通服务，再包装成 tool

```ts
import { and, eq, ilike } from "drizzle-orm";
import { db } from "../db/client.js";
import { knowledgeArticles } from "../db/schema.js";

export async function searchKnowledge(input: {
  organizationId: string;
  query: string;
}) {
  return db
    .select({
      id: knowledgeArticles.id,
      title: knowledgeArticles.title,
      content: knowledgeArticles.content,
      updatedAt: knowledgeArticles.updatedAt,
    })
    .from(knowledgeArticles)
    .where(
      and(
        eq(knowledgeArticles.organizationId, input.organizationId),
        ilike(knowledgeArticles.content, `%${input.query}%`),
      ),
    )
    .limit(5);
}
```

然后包装：

```ts
import { tool, type ToolRuntime } from "@langchain/core/tools";
import { z } from "zod/v4";

const ContextSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

const searchKnowledgeTool = tool(
  async (
    { query },
    runtime: ToolRuntime<
      typeof AgentState.Type,
      typeof ContextSchema
    >,
  ) => {
    const rows = await searchKnowledge({
      organizationId: runtime.context.organizationId,
      query,
    });

    return JSON.stringify(rows);
  },
  {
    name: "search_knowledge",
    description: "查询当前企业范围内的内部制度和操作文档",
    schema: z.object({ query: z.string().min(2) }),
  },
);
```

构图时声明 context schema：

```ts
const builder = new StateGraph(AgentState, ContextSchema);
```

调用时由可信后端提供 context：

```ts
await graph.invoke(
  { messages: [{ role: "user", content: "年假怎么申请？" }] },
  {
    context: {
      organizationId: auth.organizationId,
      userId: auth.userId,
    },
  },
);
```

### 关键安全边界

不要让模型传 `organizationId`。这个值必须来自已验证的登录上下文。也不要创建 `execute_sql(sql: string)` 工具；它相当于把数据库权限直接交给模型。

### 知识点总结

- Drizzle 管理正式业务表和业务查询。
- tool 应调用已有 service，而不是把所有 SQL 塞进工具函数。
- `context` 适合保存每次运行的可信身份信息。
- state 保存流程数据，context 保存本次运行的依赖和身份。
- 多租户查询必须始终带 `organizationId` 条件。

### 方法总结

数据库能力接入 Agent 的顺序：

```text
Drizzle schema
  → 普通 service 函数
  → 手动验证 service 输入输出
  → 包装为窄 tool
  → 在 tool 内再次校验授权范围
```

### 练习题

必做：

1. 插入 2～3 条测试知识，直接调用 `searchKnowledge`，确认最多返回 5 条且只返回当前 `organizationId` 的数据。
2. 用这个 service 替换第 5 课 `search_policy` 中写死的假结果，再运行第 5 课的工具问题。
3. 只在纸面解释：如果遗漏 `organizationId` 条件，会产生什么跨租户风险；不要在共享数据库中实际运行不安全查询。

进阶：实现 `getTicketStatus` 只读 service 和工具。`createTicket` 是写操作，留到第 10 课配合人工审批实现。

### 完成标准

Agent 只能通过经过鉴权的窄工具读取当前组织的数据，模型不能直接生成或执行 SQL。

---

## 第 7 课：Checkpointer、thread_id 与 PostgreSQL 持久化

### 本课目标

- 理解 checkpoint 是每一步的状态快照。
- 使用 `thread_id` 延续同一次对话。
- 从 `MemorySaver` 过渡到 `PostgresSaver`。

### 本课起点

复制第 6 课。工具、Drizzle service、AgentState 和所有节点都保持不变；把：

```ts
builder.compile()
```

升级为：

```ts
builder.compile({ checkpointer })
```

然后在每次 `invoke()` 时增加同一个 `thread_id`。本课不增加 Hono，也不改变业务路由。

### 本地学习：MemorySaver

```ts
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = builder.compile({ checkpointer });

const config = {
  configurable: { thread_id: "support-thread-001" },
};

await graph.invoke(
  { messages: [{ role: "user", content: "我叫 Shaun" }] },
  config,
);

const second = await graph.invoke(
  { messages: [{ role: "user", content: "我叫什么？" }] },
  config,
);
```

相同 `thread_id` 会加载同一条线程的已有 state。

### 生产环境：PostgresSaver

```ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const checkpointer = PostgresSaver.fromConnString(
  process.env.DATABASE_URL,
);

// 只在初始化/迁移阶段执行，不要在每个请求中执行。
await checkpointer.setup();

export const graph = builder.compile({ checkpointer });
```

### Drizzle 和 PostgresSaver 为什么可以共用 PostgreSQL

它们可以使用同一个 PostgreSQL 实例，甚至同一个 database，但职责不同：

```text
Drizzle 管理：
knowledge_articles、support_tickets、employees、audit_logs

PostgresSaver 管理：
LangGraph checkpoint 相关内部表
```

不要用 Drizzle migration 去“接管”你尚未理解的 checkpointer 内部表。先让 saver 自己 `setup()`。

### thread_id 设计

推荐 thread 表：

```ts
export const agentThreads = pgTable("agent_threads", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  userId: uuid("user_id").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

把 `agentThreads.id` 转成字符串作为 LangGraph `thread_id`。Hono 每次收到请求时都要确认该 thread 属于当前用户和组织。

### 检查状态

```ts
const snapshot = await graph.getState(config);
console.log(snapshot.values);
console.log(snapshot.next);

for await (const item of graph.getStateHistory(config)) {
  console.log(item.metadata, item.values);
}
```

### 知识点总结

- checkpointer 按步骤保存 graph state。
- `thread_id` 是找到一条持久对话的指针。
- `MemorySaver` 适合学习和测试，重启后数据消失。
- `PostgresSaver` 适合生产持久化。
- checkpoint 支持记忆、恢复、人工审批、故障恢复和 time travel。

### 方法总结

持久化升级顺序：

```text
无 checkpointer
  → MemorySaver 验证概念
  → PostgresSaver 本地数据库
  → thread 所有权校验
  → 清理与保留策略
```

### 练习题

必做：

1. 先使用 `MemorySaver`：相同 `thread_id` 连续问两次，再使用另一个 `thread_id`，确认消息不会混在一起。
2. 调用 `getState()`，观察当前 values 和 next。
3. 再替换为 `PostgresSaver`，重启进程后确认同一 thread 仍可恢复。

进阶：只写出 thread 所有权需要保存哪些字段；真正的 Hono 权限校验放到第 8 课。

### 完成标准

你能解释“对话记录业务表”和“LangGraph checkpoint”不是同一件事，并能安全恢复指定 thread。

---

# 第四阶段：接入 Hono 与前端

## 第 8 课：用 Hono 暴露 Agent HTTP API

### 本课目标

- 把 graph 作为应用服务调用，而不是在 route 中重新定义图。
- 校验请求输入。
- 把一个 HTTP message 转换为第 7 课 graph 所需的 input 和 config。

### 本课起点

第 7 课已经有一个可以通过 `graph.invoke()` 调用、并支持 `thread_id` 的 graph。本课不修改 graph，只在它外面增加最小 Hono route。

本课先运行最小接口，再理解鉴权和 thread 所有权校验的加入位置。

### 第一步：可直接运行的开发版 route

`src/api/agent.route.ts`：

```ts
import { Hono } from "hono";
import { z } from "zod/v4";
import { graph } from "../agent/graph.js";

const app = new Hono();

// 仅用于本地课程。生产环境必须由鉴权中间件提供。
const DEV_CONTEXT = {
  userId: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
};

const ChatRequest = z.object({
  threadId: z.string().uuid(),
  message: z.string().min(1).max(4_000),
});

app.post("/agent/chat", async (c) => {
  const parsed = ChatRequest.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }

  const { threadId, message } = parsed.data;

  const result = await graph.invoke(
    {
      // 第 5 课的过渡 state 同时保留 question 和 messages。
      question: message,
      messages: [{ role: "user", content: message }],
    },
    {
      configurable: { thread_id: threadId },
      context: DEV_CONTEXT,
    },
  );

  return c.json({
    threadId,
    answer: result.answer,
    category: result.category,
    urgency: result.urgency,
  });
});

export default app;
```

`src/index.ts`：

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import agentRoute from "./api/agent.route.js";

const app = new Hono();
app.route("/api", agentRoute);

serve({ fetch: app.fetch, port: 3000 });
```

先使用 curl 或 API 客户端完成一次请求，确认 Hono 只是把数据转换后交给原 graph。

### 第二步：理解生产鉴权边界（本课不要求完整实现）

最小接口跑通后，再把 `DEV_CONTEXT` 替换为鉴权中间件产生的服务端身份，并在 `graph.invoke()` 前验证 thread 所有权。重要原则是：`organizationId` 和 `userId` 不能直接相信请求体。

### route 不应该做什么

- 不要在每次请求中创建模型、图、数据库 pool。
- 不要让请求体直接提供可信 `organizationId`。
- 不要把 prompt、SQL 和业务规则全部写进 route handler。
- 不要把完整内部 state 原样返回给前端。

### 知识点总结

- Hono 是 transport 层，graph 是 application/workflow 层。
- 输入 schema 是 API contract；graph state schema 是流程 contract。
- thread 所有权必须在执行 graph 前验证。
- graph 应在应用启动时构建一次并复用。
- API 只返回前端真正需要的数据。

### 方法总结

一条清晰的请求链路：

```text
HTTP 请求
  → 请求 Zod 校验
  → 把 message 构造成 graph input
  → graph.invoke()
  → 响应 DTO

生产升级时再插入：鉴权 → thread 权限校验。
```

### 练习题

必做：

1. 使用一个合法请求得到 JSON 回答。
2. 分别提交空 message 和超过 4,000 字符的 message，确认返回 400。
3. 使用两个 threadId 请求，确认第 7 课的线程隔离仍然存在。

进阶：画出鉴权中间件、`assertThreadAccess` service 和 route 的调用顺序；正式实现和接口测试放到第 13～14 课。

### 完成标准

route 文件中只保留 HTTP 职责，graph 和数据库逻辑都有独立模块。

---

## 第 9 课：LangGraph Streaming + Hono SSE

### 本课目标

- 区分 `updates`、`values` 和 `messages` 三种常用 stream mode。
- 通过 Hono `streamSSE()` 向前端逐步推送内容。
- 处理客户端断开连接。

### 本课起点

复制第 8 课 route。保留相同的请求 schema、threadId、DEV_CONTEXT 和 graph；只新增 `/agent/chat/stream`，把第 8 课等待完整 JSON 的调用方式改为消费 `graph.stream()`。

### 三种常用模式

| 模式 | 返回什么 | 适用场景 |
|---|---|---|
| `updates` | 每一步产生的状态更新 | 调试流程、显示步骤进度 |
| `values` | 每一步后的完整 state | 学习和状态观察，数据可能较大 |
| `messages` | LLM token/message chunk + metadata | 聊天打字机效果 |

### Hono SSE 示例

```ts
import { streamSSE } from "hono/streaming";

app.post("/agent/chat/stream", async (c) => {
  const input = ChatRequest.parse(await c.req.json());

  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      console.log("client disconnected", input.threadId);
    });

    const chunks = await graph.stream(
      {
        question: input.message,
        messages: [{ role: "user", content: input.message }],
      },
      {
        configurable: { thread_id: input.threadId },
        context: DEV_CONTEXT,
        streamMode: "messages",
      },
    );

    for await (const [messageChunk, metadata] of chunks) {
      if (stream.aborted) break;

      const text =
        typeof messageChunk.content === "string"
          ? messageChunk.content
          : "";

      if (!text) continue;

      await stream.writeSSE({
        event: "token",
        data: JSON.stringify({
          text,
          node: metadata.langgraph_node,
        }),
      });
    }

    await stream.writeSSE({
      event: "done",
      data: JSON.stringify({ threadId: input.threadId }),
    });
  });
});
```

### 不要把 token 当作最终事实

token stream 只是用户体验层。需要审计的最终回答，应在图完成后从最终 state 或 checkpoint 中获取并保存。客户端中途断开，也不一定代表后端执行已经安全取消。

### 知识点总结

- `graph.stream()` 适合消费图的流式输出。
- `messages` 模式提供 LLM 内容片段和节点 metadata。
- Hono `streamSSE()` 把异步迭代器转换为 SSE 事件。
- SSE 事件应有稳定的 `event` 和 JSON data contract。
- 必须处理断开、错误、完成和 interrupt 等不同事件。

### 方法总结

先定义前端事件协议，再写实现：

```text
status → 当前节点/阶段
token  → 文本片段
interrupt → 等待人工输入
error  → 可展示错误
done   → 本轮结束
```

### 练习题

必做：

1. 先使用 `messages` 模式看到 token，再临时切换为 `updates`，观察两种输出形状的差异。
2. 确认客户端断开后不再继续写 SSE。
3. 增加一个不包含堆栈和密钥的 `error` 事件。

进阶：给消息节点设置 tags，只流式显示最终回答节点的 token。

### 完成标准

前端能实时显示回答，并能区分“正在检索”“正在生成”“等待审批”和“完成”。

---

## 第 10 课：Command、interrupt 与人工审批恢复

### 本课目标

- 对创建工单、发邮件、修改业务数据等操作增加人工审批。
- 在真实路由需求中第一次学习 `Command({ update, goto })`。
- 理解暂停时 state 如何保存。
- 使用相同 `thread_id` 恢复执行。

### 本课起点

本课同时复用三项已有能力：第 6 课的 `createTicket` service、第 7 课的 checkpointer/threadId、第 8～9 课的 Hono route。只新增一条“计划写操作 → 审批 → 执行”的分支。

```text
planAction → reviewAction (interrupt)
                    ├─ approve → executeAction
                    └─ reject  → END
```

审批节点需要在更新 state 后动态选择目标，因此本课使用 `Command`。

### 先扩展第 5 课的同一个 AgentState

```ts
const PendingActionSchema = z.object({
  type: z.literal("create_ticket"),
  title: z.string(),
  description: z.string(),
  idempotencyKey: z.string(),
});

// 加入现有 AgentState，其他字段全部保留。
pendingAction: PendingActionSchema.optional(),
```

审批节点只能在前一个节点已经写入 `pendingAction` 后运行。

### 审批节点

```ts
import {
  Command,
  END,
  interrupt,
  type GraphNode,
} from "@langchain/langgraph";

const reviewAction: GraphNode<typeof AgentState> = (state) => {
  const pendingAction = state.pendingAction;
  if (!pendingAction) {
    return new Command({
      update: { answer: "没有需要审批的操作。" },
      goto: END,
    });
  }

  // interrupt 前的代码会在恢复时重新运行，所以这里不要产生非幂等副作用。
  const decision = interrupt({
    type: "create_ticket",
    title: pendingAction.title,
    description: pendingAction.description,
    instruction: "请审核是否创建该工单",
  });

  if (decision.approved) {
    return new Command({
      update: {
        pendingAction: {
          ...pendingAction,
          title: decision.title ?? pendingAction.title,
          description:
            decision.description ?? pendingAction.description,
        },
      },
      goto: "executeAction",
    });
  }

  return new Command({
    update: { answer: "操作已取消。" },
    goto: END,
  });
};
```

这里第一次正式使用：

```text
update → 本节点要写入哪些 state
goto   → 写完后去哪个节点
```

必须为动态节点声明出口：

```ts
.addNode("reviewAction", reviewAction, {
  ends: ["executeAction", END],
})
```

### 第一次调用：图暂停

```ts
const config = {
  configurable: { thread_id: threadId },
  context: DEV_CONTEXT,
};

const result = await graph.invoke(initialInput, config);
console.log(result.__interrupt__);
```

### Hono 恢复接口

```ts
const ResumeRequest = z.object({
  threadId: z.string().uuid(),
  approved: z.boolean(),
  title: z.string().max(200).optional(),
  description: z.string().max(4_000).optional(),
});

app.post("/agent/resume", async (c) => {
  const input = ResumeRequest.parse(await c.req.json());

  const result = await graph.invoke(
    new Command({
      resume: {
        approved: input.approved,
        title: input.title,
        description: input.description,
      },
    }),
    {
      configurable: { thread_id: input.threadId },
      context: DEV_CONTEXT,
    },
  );

  return c.json({
    message: result.answer,
    interrupted: Boolean(result.__interrupt__?.length),
  });
});
```

上面继续使用第 8 课开发环境的 `DEV_CONTEXT`。生产版本仍然必须在恢复前完成鉴权和 thread 所有权校验。

### 四条硬规则

1. `interrupt()` 需要 checkpointer 和稳定的 `thread_id`。
2. 恢复时必须使用同一个 `thread_id`。
3. 节点恢复时会从节点开头重新执行。
4. `interrupt()` 之前的副作用必须幂等，最好把副作用放进后续独立节点。

### 知识点总结

- `interrupt(payload)` 暂停图并向调用方返回 JSON 可序列化信息。
- `Command({ resume: value })` 把人工输入送回原 interrupt 调用点。
- checkpointer 保存暂停位置和 state。
- 人工可以批准、拒绝或编辑待执行内容。
- 高风险写操作应该采用“计划 → 审批 → 执行”三段式。

### 方法总结

所有外部副作用先分类：

| 操作 | 默认策略 |
|---|---|
| 读取制度、读取工单 | 可自动执行，仍需鉴权 |
| 创建草稿 | 可自动执行 |
| 创建正式工单 | 按企业规则决定是否审批 |
| 发邮件、退款、改权限、删除数据 | 必须审批 |

### 练习题

必做：

1. 使用一条固定 `pendingAction` 跑通暂停，观察 `__interrupt__`。
2. 分别使用 `approved: true` 和 `approved: false` 恢复两个不同 thread，确认只批准的分支进入 `executeAction`。
3. 允许审批人修改标题，再确认执行节点读取的是修改后的 state。

进阶：给 `createTicket` 增加 `idempotencyKey` 唯一约束，验证重复恢复不会创建两张工单；再增加拒绝审计记录。

### 完成标准

你能解释 `Command` 的 update/goto、interrupt 的暂停位置以及恢复必须使用相同 threadId；进阶完成后还能证明重复恢复不会重复执行。

---

# 第五阶段：记忆、知识库与企业上下文

## 第 11 课：短期记忆与长期记忆

### 本课目标

- 区分 checkpointer 和 store。
- 理解 thread 内记忆与跨 thread 记忆。
- 使用 PostgreSQL 保存用户偏好。

### 本课起点

第 7 课已经使用 `PostgresSaver` 保存同一 thread 的 state。本课不改业务图，只在同一次 `compile()` 中再加入一个 `PostgresStore`：

```text
checkpointer → 同一个 thread 的短期状态
store        → 同一用户跨 thread 的明确偏好
```

先只保存一个明确偏好，例如回答语言；不要自动“记住”所有对话。

### 两种记忆

| 类型 | 典型内容 | 范围 | LangGraph 机制 |
|---|---|---|---|
| 短期记忆 | 本次对话消息、当前分类、待审批动作 | 一个 thread | checkpointer |
| 长期记忆 | 用户偏好、常用部门、语言偏好 | 多个 threads | store |

正式企业政策、工单和员工主数据不应被当作“模型记忆”；它们仍然属于 Drizzle 业务表。

### PostgresStore

```ts
import { PostgresStore } from "@langchain/langgraph-checkpoint-postgres/store";

const store = PostgresStore.fromConnString(process.env.DATABASE_URL!);
await store.setup(); // 初始化阶段执行一次

const graph = builder.compile({
  checkpointer,
  store,
});
```

在节点中访问：

```ts
const callModel: GraphNode<typeof AgentState> = async (state, runtime) => {
  const { organizationId, userId } = runtime.context;
  const namespace = [organizationId, "users", userId, "preferences"];

  const memories = await runtime.store?.search(namespace, { limit: 5 });
  const preferences = memories?.map((item) => item.value) ?? [];

  const response = await model.invoke([
    {
      role: "system",
      content: `用户偏好：${JSON.stringify(preferences)}`,
    },
    ...state.messages,
  ]);

  return { messages: [response] };
};
```

写入长期记忆必须有明确规则。不要把每一句对话都自动变成永久记忆：

```ts
await runtime.store?.put(
  namespace,
  "language",
  { value: "zh-CN", source: "explicit_user_preference" },
);
```

### 消息过长时怎么办

先从简单策略开始：

1. 限制每条消息长度。
2. 使用 `trimMessages()` 只把最近相关消息送给模型。
3. 再学习摘要节点，把旧消息压缩成 summary。
4. 原始 checkpoint 的保留策略另行管理。

不要把“模型上下文窗口”“checkpoint 数据”“业务聊天记录表”混为一谈。

### 知识点总结

- checkpointer 保存 thread state，是短期工作记忆的基础。
- store 保存跨 thread 数据，是长期记忆的基础。
- namespace 决定长期记忆的隔离范围。
- 企业正式事实应从权威业务表读取，不依赖模型记忆。
- 永久记忆必须可解释、可删除、可审计。

### 方法总结

决定数据放哪里时问三句话：

1. 只服务当前流程吗？放 state/checkpoint。
2. 是跨对话的用户偏好吗？放 store。
3. 是企业权威业务事实吗？放 Drizzle 业务表。

### 练习题

必做：

1. 保存用户明确选择的回答语言，并在新 thread 中读取。
2. 使用不同 `organizationId`，确认长期记忆不会串租户。
3. 列出 10 种数据，分别判断应放 state、store 还是 Drizzle 业务表。

进阶：实现“忘记我的偏好”，删除对应 store item。

### 完成标准

你能准确解释 thread memory、long-term memory 和企业知识库的差别。

---

## 第 12 课：企业知识库检索与可追溯回答

### 本课目标

- 从简单关键词检索开始，再考虑向量检索。
- 让回答附带来源。
- 对“无依据”建立可靠降级路径。

### 本课起点

不要新建另一套 RAG 项目。第 6 课已经有 `knowledgeArticles` 表和 `searchKnowledge` service，第 5 课已经有工具循环。本课只做三项升级：

1. 把检索结果作为结构化数据保存进现有 AgentState。
2. 生成回答时附带文章 id/title。
3. 没有检索结果时进入已有 `handoff` 路径。

### 第一版不要急着上向量数据库

先用第 6 课的 `ILIKE` 或 PostgreSQL 全文检索做小版本：

```text
用户问题
  → 分类
  → 生成检索关键词
  → Drizzle 查询 knowledge_articles
  → 把原始结果放进 state
  → 模型依据结果回答
  → 输出引用 article id/title/updatedAt
```

给第 5 课以来一直使用的 `AgentState` 增加三个字段，不要用下面片段替换整个 State：

```ts
const ArticleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  updatedAt: z.coerce.date(),
});

retrievedArticles: z.array(ArticleSchema).default(() => []),
citations: z.array(z.string()).default(() => []),
grounded: z.boolean().default(false),
```

回答节点只基于检索结果：

```ts
const answerFromKnowledge: GraphNode<typeof AgentState> = async (state) => {
  if (state.retrievedArticles.length === 0) {
    return {
      answer: "当前知识库没有足够依据，我已建议转人工处理。",
      citations: [],
      grounded: false,
    };
  }

  const context = state.retrievedArticles
    .map((item) => `[${item.id}] ${item.title}\n${item.content}`)
    .join("\n\n---\n\n");

  const response = await model.invoke([
    {
      role: "system",
      content: [
        "只能依据给定企业资料回答。",
        "资料不足时明确说明，不得编造制度。",
        "回答中的关键结论要标注资料 id。",
      ].join("\n"),
    },
    {
      role: "user",
      content: `资料：\n${context}\n\n问题：${getLastUserText(state.messages)}`,
    },
  ]);

  return {
    answer: String(response.content),
    citations: state.retrievedArticles.map((item) => item.id),
    grounded: true,
  };
};
```

### 何时升级 pgvector

当关键词搜索出现明显召回问题，并且你已经有：

- 稳定的文档切块规则；
- 文档版本与权限字段；
- 离线评测问题集；
- 能衡量 Recall@K 或人工命中率；

再考虑 PostgreSQL `pgvector`、embedding 列和混合检索。技术复杂度增加不等于回答质量自动增加。

### 企业检索必须加入的字段

- `organizationId`：租户隔离。
- `department` / `visibility`：访问范围。
- `effectiveFrom` / `effectiveTo`：制度有效期。
- `version` / `updatedAt`：来源新旧。
- `sourceUrl`：原始来源。
- `status`：只检索已发布内容。

### 知识点总结

- RAG 是“先检索证据，再生成回答”。
- 检索结果应以原始结构保存到 state，prompt 在节点内临时格式化。
- 没有证据时应降级，不应让模型自由补全企业制度。
- citation 是产品能力，不只是 UI 装饰。
- 先做可评测的简单检索，再升级向量检索。

### 方法总结

企业知识问答的质量链路：

```text
权限过滤
  → 有效期过滤
  → 召回相关文档
  → 只基于证据生成
  → 返回引用
  → 无依据时转人工
```

### 练习题

必做：

1. 让已有 `searchKnowledge` 结果写入 `retrievedArticles`，最终回答返回 citations。
2. 实现没有检索结果时进入 handoff，而不是让模型继续自由回答。
3. 给知识表增加 `status` 和有效期字段，并手动验证过期制度不会被使用。

进阶：准备 10 条“问题—预期文章”样本；第 13 课再把它们做成正式评测。

### 完成标准

每个制度类回答都能指出依据；无依据时系统明确说不知道并进入安全路径。

---

# 第六阶段：生产可靠性与最终项目

## 第 13 课：为现有项目补测试、错误处理与观测

### 本课目标

- 为不同失败类型制定不同策略。
- 测试节点、路由和完整图。
- 理解子图是单图稳定后的选修重构，不是本课必做。

### 本课起点

前 12 课主要通过几组输入手动观察。本课专门把第 3 课的路由案例、第 6 课的 service 和第 12 课的检索样本变成正式测试。

测试顺序固定为：纯函数路由 → 单节点 → 完整 graph → 少量真实数据库集成。不要一开始就 mock 整个世界。

### 错误分类

| 错误 | 例子 | 策略 |
|---|---|---|
| 瞬时错误 | API 429、网络抖动 | 节点 retry policy |
| 可由模型修正 | 工具参数不合理 | 把安全错误结果返回模型再尝试 |
| 需要用户输入 | 缺少员工号 | interrupt/追问 |
| 业务拒绝 | 无权限、工单已关闭 | 明确结果，不重试 |
| 未知系统错误 | bug、数据库损坏 | 中止、记录、告警 |

为外部检索节点增加重试：

```ts
.addNode("searchKnowledge", searchKnowledgeNode, {
  retryPolicy: {
    maxAttempts: 3,
    initialInterval: 1,
  },
})
```

不要对所有错误无脑重试。权限拒绝和无效输入重试一百次也不会成功。

### 测试金字塔

1. **纯函数测试**：路由、格式化、reducer。
2. **节点测试**：模型和数据库使用 mock。
3. **图测试**：给定 state，验证经过的节点和最终 state。
4. **集成测试**：真实测试数据库和模型沙箱。
5. **评测集**：分类正确率、检索命中率、回答依据率、转人工率。

Vitest 示例：

```ts
import { describe, expect, it } from "vitest";

describe("routeAfterClassification", () => {
  it("routes critical requests to human review", () => {
    const target = routeAfterClassification({
      classification: {
        intent: "finance",
        urgency: "critical",
        summary: "重复扣款",
        reason: "涉及资金且紧急",
      },
    } as never);

    expect(target).toBe("humanReview");
  });
});
```

### 可观测性至少记录什么

- `requestId`、`threadId`、`organizationId`、`userId`。
- 经过的节点和耗时。
- 使用的工具名称，不记录密钥。
- 检索文章 id 和版本。
- 是否发生 interrupt、审批人和结果。
- 模型、token、成本和错误类型。
- 最终是否解决、转人工或创建工单。

可用 LangSmith 做 trace 和 evaluation，也可以先使用自己的结构化日志与审计表。生产环境不要记录不必要的完整 PII。

### 什么时候拆子图

第一版先保持一个图。当 HR、IT、Finance 已经有独立 state、工具、测试和维护人时，再拆为子图：

```text
入口分类图
  ├─ HR subgraph
  ├─ IT subgraph
  └─ Finance subgraph
```

子图是隔离复杂度的工具，不是越多越先进。跨部门只共享真正需要的 state 字段。

### 知识点总结

- 节点粒度应对应不同外部依赖、错误策略和测试边界。
- retry policy 适用于瞬时错误。
- 业务拒绝、用户缺信息和系统错误必须分开处理。
- 先测试纯函数，再测试图，再做在线评测。
- 子图用于清晰边界，不用于装饰架构。

### 方法总结

每增加一个节点，写下四件事：

1. 输入和输出是什么？
2. 会以什么方式失败？
3. 失败后是重试、追问、转人工还是中止？
4. 如何单独测试？

### 练习题

必做：

1. 把第 3 课四组手动输入改成 `routeRequest` 的表驱动 Vitest。
2. 为 `searchKnowledge` 写一组测试，确认 organizationId 过滤和 limit。
3. 模拟一个瞬时错误验证 retry，再模拟权限拒绝确认不会重试。

进阶：把第 12 课的 10 条样本做成离线回归评测。只画出 HR/IT 子图边界，不要求实现多 Agent。

### 完成标准

一次失败发生时，你能从 trace 判断失败节点、输入、错误类型和恢复方式。

---

## 第 14 课：毕业项目——企业内部管理客服 Agent

### 本课起点

本课整理第 1～13 课已经运行过的 state、nodes、tools、checkpointer、store、Hono routes 和 tests。HR/IT 通过扩展现有 category 枚举和知识库过滤条件接入同一个 Agent。

### 最终需求

实现一个内部客服系统，至少支持：

- HR：年假、报销、入离职制度查询。
- IT：账号、设备、VPN、软件权限问题。
- Finance：付款、发票、报销进度查询。
- 通用：无法识别时追问或转人工。
- 工具：知识库查询、工单状态查询、创建工单。
- 风险控制：创建/修改正式记录前人工审批。
- 多轮对话：同一 thread 记住上下文。
- 跨会话偏好：记住用户明确选择的语言。
- API：Hono JSON + SSE。
- 数据：PostgreSQL + Drizzle。
- 持久化：PostgresSaver + PostgresStore。
- 质量：引用来源、测试、审计、评测。

### 推荐图结构

```text
START
  ↓
normalizeInput
  ↓
classifyIntent
  ├─ 信息不足 → askClarification → END/下一轮
  ├─ 高风险 → humanReview
  ├─ HR ─────┐
  ├─ IT ─────┼→ retrieveKnowledge
  └─ Finance ┘         ↓
                  draftAnswer
                       ↓
                evaluateGrounding
                  ├─ 合格 → finalizeAnswer → END
                  ├─ 需操作 → planAction → humanReview
                  └─ 无依据 → createHandoffDraft → END

humanReview
  ├─ 拒绝 → finalizeAnswer → END
  └─ 批准 → executeAction → auditAction → finalizeAnswer → END
```

### 推荐 state

```ts
const PendingActionSchema = z.object({
  type: z.enum(["create_ticket", "send_email", "update_record"]),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string(),
});

const SupportAgentState = new StateSchema({
  question: z.string(),
  messages: MessagesValue,
  category: z
    .enum(["account", "hr", "it", "finance", "general", "unknown"])
    .default("unknown"),
  urgency: z
    .enum(["normal", "high", "critical"])
    .default("normal"),
  summary: z.string().default(""),
  classificationReason: z.string().default(""),
  retrievedArticles: z.array(ArticleSchema).default(() => []),
  pendingAction: PendingActionSchema.optional(),
  answer: z.string().default(""),
  citations: z.array(z.string()).default(() => []),
  grounded: z.boolean().default(false),
  nodeCallCount: new ReducedValue(
    z.number().default(0),
    {
      inputSchema: z.number(),
      reducer: (oldValue, increment) => oldValue + increment,
    },
  ),
});
```

### 推荐业务模块

```text
src/
├─ agent/
│  ├─ state.ts                 # 只定义 graph state/context
│  ├─ graph.ts                 # 只负责组图
│  ├─ nodes/
│  │  ├─ classify-intent.ts
│  │  ├─ retrieve-knowledge.ts
│  │  ├─ draft-answer.ts
│  │  ├─ evaluate-grounding.ts
│  │  ├─ human-review.ts
│  │  └─ execute-action.ts
│  └─ tools/
│     ├─ search-knowledge.tool.ts
│     ├─ get-ticket.tool.ts
│     └─ create-ticket.tool.ts
├─ services/
│  ├─ knowledge.service.ts
│  ├─ ticket.service.ts
│  └─ authorization.service.ts
├─ db/
│  ├─ client.ts
│  └─ schema.ts
└─ api/
   └─ agent.route.ts
```

### 分 7 个里程碑完成

#### M1：确定性路由

- 不用 LLM。
- 输入固定关键词，进入 HR/IT/Finance 节点。
- 验收：所有分支有测试。

#### M2：LLM 分类

- 结构化输出。
- 低置信度追问。
- 验收：20 条分类评测。

#### M3：只读知识工具

- Drizzle 查询知识表。
- 强制 organization 过滤。
- 验收：回答包含引用。

#### M4：多轮与持久化

- PostgresSaver。
- 同一 thread 可继续对话。
- 验收：重启后仍可恢复。

#### M5：Hono 与 Streaming

- JSON 接口和 SSE 接口。
- 验收：前端可区分 token、status、done。

#### M6：人工审批写操作

- `interrupt()` 暂停。
- 批准后创建工单。
- 验收：拒绝不执行；重复恢复不重复创建。

#### M7：质量与上线准备

- 回归评测、trace、审计、错误告警。
- 验收：50 条核心问题达到你设定的准确率目标。

### 最终验收清单

功能：

- [ ] 每个问题都进入明确分支。
- [ ] 不知道时会追问或转人工。
- [ ] 制度类回答有来源。
- [ ] 多轮对话能延续。
- [ ] 用户偏好能跨 thread 使用。
- [ ] 高风险操作必须审批。

安全：

- [ ] organizationId 和 userId 来自服务端鉴权上下文。
- [ ] 每个数据库工具都做租户过滤。
- [ ] 没有通用 SQL 工具。
- [ ] 工具返回内容不会覆盖系统规则。
- [ ] 副作用节点有幂等键。
- [ ] 日志不包含密钥和不必要的 PII。

可靠性：

- [ ] transient error 才重试。
- [ ] checkpoint 能在进程重启后恢复。
- [ ] interrupt 恢复使用相同 thread_id。
- [ ] 有失败、拒绝、无权限和无资料测试。
- [ ] 有离线问题集和固定回归指标。

### 知识点总结

- 企业 Agent 的难点不只是模型回答，而是权限、状态、证据、审批和恢复。
- LangGraph 把这些非线性流程变成可检查、可暂停、可测试的图。
- Hono、Drizzle 和 LangGraph 应通过清晰边界协作。
- 先做单 Agent、窄工具和明确流程，再考虑多 Agent。
- 生产质量来自评测和反馈循环，不来自更长的 prompt。

### 方法总结

最终项目始终坚持这个迭代公式：

```text
最小确定性流程
  → 加一个模型判断
  → 加一个只读工具
  → 加持久化
  → 加人工审批
  → 加评测
  → 根据真实失败再扩展
```

### 练习题

1. 完成 M1～M7，并为每个里程碑打 Git tag。
2. 为“重复报销”“VPN 无法连接”“忘记密码”“询问过期制度”各设计一条端到端测试。
3. 写一份事故演练：模型建议了错误操作时，系统有哪些防线？
4. 统计自动解决率、转人工率、无依据回答率和人工改写率。

### 完成标准

不是“能聊天”就算完成。只有当系统能安全查询、基于证据回答、必要时暂停、失败后恢复并通过固定评测，才算完成企业客服 Agent 的第一版。

---

## 3. LangGraph 高频 API 速查

| API | 一句话记忆 | 本教程位置 |
|---|---|---|
| `new StateSchema({...})` | 定义图中共享数据及更新语义 | 第 1～2 课 |
| `new StateGraph(State)` | 创建图的 builder | 第 1 课 |
| `.addNode(name, fn)` | 注册一步业务处理 | 第 1 课 |
| `.addEdge(from, to)` | 固定下一步 | 第 1 课 |
| `.addConditionalEdges()` | 根据 state 选择下一步 | 第 3 课 |
| `new Command({ update, goto })` | 更新状态并动态跳转 | 第 10 课 |
| `.compile()` | 把 builder 变成可执行 graph | 第 1 课 |
| `.invoke(input, config)` | 执行一次并得到最终/暂停状态 | 第 1、7 课 |
| `.stream(input, config)` | 逐步消费图输出 | 第 9 课 |
| `MessagesValue` | 对话消息状态及合并逻辑 | 第 2、5 课 |
| `ReducedValue` | 自定义字段合并逻辑 | 第 2 课 |
| `ToolNode` | 执行模型的 tool calls | 第 5 课 |
| `MemorySaver` | 进程内学习型 checkpointer | 第 7 课 |
| `PostgresSaver` | PostgreSQL 生产 checkpointer | 第 7 课 |
| `PostgresStore` | PostgreSQL 长期记忆 store | 第 11 课 |
| `interrupt(payload)` | 暂停并等待外部输入 | 第 10 课 |
| `Command({ resume })` | 恢复被暂停的 thread | 第 10 课 |
| `.getState()` | 查看线程当前快照 | 第 7 课 |
| `.getStateHistory()` | 查看线程历史 checkpoints | 第 7、13 课 |

---

## 4. 最容易踩的 12 个坑

1. 第一天就做多 Agent，连一个节点的输入输出都没有稳定。
2. 把 state 当成所有数据的垃圾桶。
3. 在 state 中保存已经格式化好的整段 prompt，而不是原始数据。
4. 让模型直接决定高风险业务动作。
5. 暴露 `execute_sql` 之类的通用工具。
6. 让模型传 `organizationId`，导致跨租户越权。
7. 把 `MemorySaver` 用在生产环境，重启后状态丢失。
8. 把 checkpointer、store、聊天记录表和企业知识库混成同一概念。
9. 在 `interrupt()` 之前发送邮件或创建工单，恢复后重复执行。
10. 对权限错误和参数错误不停重试。
11. 只有 demo 问题，没有固定评测集。
12. 检索不到资料时仍让模型自由回答企业制度。

---

## 5. 练习时的自检方式

每完成一课，使用下面五个问题检查自己：

1. 我能画出这次执行的节点顺序吗？
2. 我能写出每个节点读取和更新的 state 字段吗？
3. 我能说明错误发生后去哪里吗？
4. 我能在不调用真实模型的情况下测试主要规则吗？
5. 我能解释这段代码属于 LangGraph、Hono、Drizzle 还是业务 service 吗？

如果有两个问题答不出来，不要继续加新功能，先回到当前课做练习。

---

## 6. 官方资料与推荐阅读顺序

本教程以 TypeScript 官方文档当前内容为主，建议按下面顺序阅读，而不是从 API Reference 随机翻：

1. [LangGraph Overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
2. [LangGraph Quickstart](https://docs.langchain.com/oss/javascript/langgraph/quickstart)
3. [Thinking in LangGraph](https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph)
4. [Workflows and agents](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents)
5. [Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
6. [Checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)
7. [Streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)
8. [Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
9. [Memory](https://docs.langchain.com/oss/javascript/langgraph/add-memory)
10. [Subgraphs](https://docs.langchain.com/oss/javascript/langgraph/use-subgraphs)
11. [Testing](https://docs.langchain.com/oss/javascript/langgraph/test)
12. [Hono Streaming Helper](https://hono.dev/docs/helpers/streaming)
13. [Drizzle + PostgreSQL Getting Started](https://orm.drizzle.team/docs/get-started/postgresql-new)

官方文档的核心提醒也适用于本教程：LangGraph 是偏底层的 orchestration framework。开始前至少要理解模型调用和工具调用；如果只想快速做一个标准工具 Agent，可以先使用更高层的 agent 抽象。但要做企业内部客服所需的暂停、恢复、审批和长期状态，理解 LangGraph 的底层图模型非常有价值。

---

## 7. 下一步行动

今天只做三件事：

1. 创建项目并完成依赖安装。
2. 完成第 1 课，不接模型和数据库。
3. 独立完成第 1 课的三个练习。

等你能从空文件写出 `StateSchema → nodes → edges → compile → invoke`，再进入第 2 课。这个速度看起来慢，但它会让后面的 Hono、Drizzle、工具和记忆真正变得可理解。
