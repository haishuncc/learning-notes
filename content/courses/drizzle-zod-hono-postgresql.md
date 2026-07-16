---
title: Drizzle、Zod、Hono 与 PostgreSQL 渐进式课程
description: 从数据边界、CRUD 和 SQL 原理，逐步掌握 Drizzle ORM、Zod、PostgreSQL 与 Hono
---

# Drizzle ORM + Zod + PostgreSQL + Hono 渐进式课程

> 面向已有一些 TypeScript / Hono 基础、希望系统掌握 Drizzle ORM 与 Zod 的学习者。
> 主线技术栈：TypeScript、Hono、Drizzle ORM、Zod 4、PostgreSQL、node-postgres。
> 贯穿项目：一个支持成员、任务、筛选、统计和 LLM 任务草稿导入的团队任务 API。

## 课程目标

完成课程后，你应该能够：

1. 分清 TypeScript 类型、Zod 运行时校验、Drizzle 数据访问和 PostgreSQL 约束各自负责什么。
2. 用 Drizzle 声明 PostgreSQL schema，生成并执行迁移，完成 CRUD、关联查询、事务和统计。
3. 读懂常见 Drizzle 方法生成的 SQL，而不是只会背 ORM 语法。
4. 熟练使用 Zod 的对象、联合、转换、细化、错误格式化和类型推导。
5. 把 HTTP 输入、业务对象、数据库写入对象和 API 输出当成不同的数据边界处理。
6. 用 Zod 生成 JSON Schema，约束并二次校验 LLM 的结构化输出，再安全写入数据库。
7. 独立完成一个 Hono + Drizzle + Zod + PostgreSQL 的小型项目。

## 版本边界

- 本课程以 **Zod 4** 为基线。
- Drizzle 官方文档在 2026-07-15 的部分页面展示了 `v1.0` Beta/RC 示例。课程主体只使用长期稳定的 SQL-like API：schema、`select`、`insert`、`update`、`delete`、filters、joins、transactions 和 migrations。
- 当前官方文档把 Zod 集成放在 `drizzle-orm/zod`。旧项目中可能看到独立的 `drizzle-zod` 包；学习新项目时不要把两套导入路径混在一起。
- 安装命令默认使用包管理器的稳定标签。若你主动跟随 Drizzle RC，`drizzle-orm` 与 `drizzle-kit` 应保持同一发布线，并按该版本文档调整 API。

## 一条必须先记住的数据流水线

```text
不可信输入
  ↓ HTTP JSON / query / param
Hono 读取请求
  ↓
Zod 解析、校验、转换
  ↓ 已验证的业务输入
Drizzle 构造参数化 SQL
  ↓
PostgreSQL 再执行类型、NOT NULL、UNIQUE、FK、CHECK 等约束
  ↓
Drizzle 返回行
  ↓
可选：Zod 校验 API 输出
  ↓
HTTP JSON 响应
```

四层职责不能互相替代：

| 层 | 主要职责 | 不能替代什么 |
| --- | --- | --- |
| TypeScript | 编译期类型检查、编辑器提示 | 不能检查网络请求、环境变量、LLM 输出等运行时数据 |
| Zod | 运行时解析、校验、转换、错误结构 | 不能保证并发下的唯一性，也不能代替数据库事务 |
| Drizzle | 类型安全地构造和执行 SQL、映射查询结果 | 不是业务输入校验器，也不会自动替你设计约束 |
| PostgreSQL | 持久化、约束、事务、并发控制、查询计划 | 不负责向前端返回友好的字段级错误 |

## 课程地图

| 阶段 | 课程 | 阶段产物 |
| --- | --- | --- |
| 第一阶段：建立边界 | 第 1～5 课 | 可连接数据库、可建表、可校验请求的数据层骨架 |
| 第二阶段：掌握 CRUD | 第 6～9 课 | 完整任务 CRUD、筛选分页、关系与 JOIN |
| 第三阶段：工程能力 | 第 10～13 课 | 可维护迁移、事务、统计、索引与查询分析 |
| 第四阶段：结构化数据 | 第 14～15 课 | LLM 结构化输出管线与最终项目 |

每节课都包含：知识点、方法解释、核心功能、Drizzle 到 SQL 的映射、实践、总结和练习。

---

# 第一阶段：建立正确的数据边界

## 第 1 课：ORM、校验器和数据库分别解决什么问题

### 本课目标

- 建立 Drizzle、Zod、PostgreSQL、Hono 的职责模型。
- 理解“类型正确”不等于“数据可信”。
- 能把一条请求追踪到 SQL 和响应。

### 知识点讲解

#### 1. ORM 不是数据库

Drizzle 是 TypeScript 库。它根据 schema 和查询构造器生成 SQL，再通过 `pg` 等驱动把 SQL 发送给 PostgreSQL。真正保存数据、检查外键、处理事务的是 PostgreSQL。

Drizzle 的设计接近 SQL。官方文档的核心表述是：如果你知道 SQL，就能较直接地理解 Drizzle。学习时应始终问两句话：

1. 这段 Drizzle 会生成什么 SQL？
2. SQL 在数据库里如何执行？

#### 2. TypeScript 类型会在运行前消失

```ts
type CreateTask = {
  title: string;
  priority: number;
};
```

这个类型能检查你自己写的 TypeScript 代码，但下面的数据在运行时仍然可能进入应用：

```json
{ "title": 123, "priority": "high" }
```

网络请求不会因为你声明了 `CreateTask` 就自动变正确。Zod 的价值是把 `unknown` 解析成可信数据。

#### 3. 校验有两个层级

- 应用校验：标题长度、日期格式、联合字段、友好错误、输入转换。
- 数据库约束：主键、唯一性、外键、非空、检查约束、事务一致性。

关键规则：**能影响持久化正确性的约束，最终必须落到数据库；需要用户友好反馈或复杂输入解释的规则，通常也要在 Zod 中表达。**

### 方法讲解

先认识三类常用方法：

```ts
const parsed = schema.safeParse(input); // Zod：运行时检查
const rows = await db.select().from(tasks); // Drizzle：生成并执行 SELECT
return c.json(rows); // Hono：返回 HTTP 响应
```

- `safeParse` 不抛出普通控制流异常，而是返回成功/失败联合类型。
- `db.select().from(...)` 描述 SQL，不是对数组调用 JavaScript `filter`。
- `c.json(...)` 是传输层操作，不负责验证数据是否可入库。

### Drizzle 对应的 SQL 原理

```ts
await db.select().from(tasks);
```

概念上对应：

```sql
SELECT * FROM tasks;
```

Drizzle 提供类型推导和参数绑定，但数据库看到的仍然是 SQL。

### 实践

用一句话解释下面每一层为何存在：

```text
POST /tasks → Hono → Zod → Drizzle → PostgreSQL
```

建议答案方向：Hono 读取请求，Zod 把未知输入变成已验证输入，Drizzle 构造 SQL，PostgreSQL 持久化并执行最终约束。

### 本课总结

- TypeScript 管编译期，Zod 管运行时边界，Drizzle 管 SQL 构造，PostgreSQL 管持久化一致性。
- ORM 语法背后仍然是 SQL。
- 数据校验不是单点，而是应用和数据库的双层防线。

### 练习题

1. 为什么 `as CreateTask` 不能替代 `createTaskSchema.parse(input)`？
2. 邮箱唯一性只写 `z.email()` 是否足够？为什么？
3. 如果任务优先级只能是 1～5，分别写出 Zod 和数据库应承担的部分。
4. 画出一个非法请求从 Hono 到返回 400 的路径。

---

## 第 2 课：搭建 Hono、Drizzle 和 PostgreSQL

### 本课目标

- 创建 Node.js + Hono 项目。
- 通过 `node-postgres` 连接 PostgreSQL。
- 理解连接池、数据库实例和环境变量的作用。

### 项目初始化

创建 Hono 项目时选择 Node.js 模板，然后安装依赖：

```bash
npm create hono@latest drizzle-zod-course
cd drizzle-zod-course
npm install drizzle-orm pg zod @hono/zod-validator
npm install --save-dev drizzle-kit @types/pg tsx
```

开发数据库可以用本地 PostgreSQL 或容器。连接字符串示例：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/drizzle_course
```

不要把真实密码提交到 Git。仓库只保留 `.env.example`：

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

### 推荐目录

```text
src/
├── db/
│   ├── index.ts
│   └── schema.ts
├── schemas/
│   └── task.ts
├── routes/
│   └── tasks.ts
└── index.ts
drizzle/
drizzle.config.ts
.env
```

### 数据库连接

```ts
// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString });

export const db = drizzle({ client: pool, schema });
```

### 方法与核心功能讲解

#### `new Pool()`

连接数据库不是每次查询都重新建立 TCP 连接。连接池维护一组可复用连接，查询借用连接，完成后归还。

#### `drizzle({ client, schema })`

- `client`：真正与 PostgreSQL 通信的驱动对象。
- `schema`：让 Drizzle 认识表和关系，尤其供 relational query API 使用。
- `db`：后续查询的统一入口。

#### 健康检查

```ts
import { sql } from "drizzle-orm";

app.get("/health", async (c) => {
  await db.execute(sql`select 1`);
  return c.json({ ok: true });
});
```

### Drizzle 对应的 SQL 原理

```ts
await db.execute(sql`select 1`);
```

对应：

```sql
SELECT 1;
```

它不访问业务表，只验证应用能否把查询送到数据库并收到结果。

### 常见错误

- `DATABASE_URL` 是 `undefined`：环境变量没有加载，或启动目录不对。
- `ECONNREFUSED`：PostgreSQL 未启动、端口不对或容器未暴露端口。
- `password authentication failed`：用户、密码或 `pg_hba.conf` 不匹配。
- “能连接”不代表 schema 已存在；连接和迁移是两件事。

### 本课总结

- `pg` 负责连接，Drizzle 负责类型安全的 SQL 构造和结果映射。
- 连接池应复用，不应在每个路由里创建。
- 健康检查只证明连接正常，不证明业务表和数据都正确。

### 练习题

1. 增加 `/health/db` 路由并返回当前数据库时间 `select now()`。
2. 故意把端口写错，记录错误信息并判断错误发生在哪一层。
3. 为什么不能在每次请求处理器中都 `new Pool()`？
4. 为 `.env.example` 添加说明，但不要填写真实凭据。

---

## 第 3 课：用 Drizzle 声明 PostgreSQL Schema

### 本课目标

- 掌握表、列、类型、默认值、主键、唯一约束和外键。
- 理解 Drizzle schema 是迁移和查询的类型来源。
- 能把 TypeScript schema 翻译成 `CREATE TABLE`。

### Schema 代码

```ts
// src/db/schema.ts
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["member", "manager"]);
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "doing",
  "done",
  "cancelled",
]);

export const users = pgTable(
  "users",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 100 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    role: userRoleEnum().default("member").notNull(),
    points: integer().default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    title: varchar({ length: 200 }).notNull(),
    description: text(),
    status: taskStatusEnum().default("todo").notNull(),
    priority: integer().default(3).notNull(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    metadata: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("tasks_priority_check", sql`${table.priority} between 1 and 5`),
  ],
);
```

### 方法讲解

| Drizzle 方法 | 作用 | PostgreSQL 概念 |
| --- | --- | --- |
| `pgTable("tasks", ...)` | 声明表 | `CREATE TABLE tasks` |
| `integer()` / `varchar()` | 声明列类型 | `integer` / `varchar(n)` |
| `.notNull()` | 禁止空值 | `NOT NULL` |
| `.defaultNow()` | 数据库生成当前时间 | `DEFAULT now()` |
| `.primaryKey()` | 唯一标识一行 | `PRIMARY KEY` |
| `.generatedAlwaysAsIdentity()` | 由 PostgreSQL 生成 ID | `GENERATED ALWAYS AS IDENTITY` |
| `.references(...)` | 建立外键 | `REFERENCES users(id)` |
| `uniqueIndex(...)` | 唯一索引 | `CREATE UNIQUE INDEX` |
| `check(...)` | 行级值约束 | `CHECK (...)` |
| `$type<T>()` | 改善 TS 映射类型 | 不会自动生成 JSON 内部结构约束 |

### 核心功能讲解

#### `notNull`、`default` 和 `optional` 不是一回事

- 数据库列可为 `NULL`：查询类型通常含 `null`。
- 数据库有默认值：插入时可以不传该字段。
- Zod 字段 `.optional()`：输入对象可以没有这个键。

不要把 `null` 和 `undefined` 混淆：`null` 常表示“明确为空”，`undefined` 常表示“没有提供”。

#### `$type<T>()` 只影响 TypeScript

`jsonb().$type<Record<string, unknown>>()` 不会校验 JSON 内部是否符合某个业务结构。若 `metadata` 有固定形状，仍应使用 Zod，必要时配合 PostgreSQL CHECK 或拆成正规列。

### 对应的 SQL 原理

上面的 `tasks` 会生成接近下面的 DDL：

```sql
CREATE TYPE task_status AS ENUM ('todo', 'doing', 'done', 'cancelled');

CREATE TABLE tasks (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title varchar(200) NOT NULL,
  description text,
  status task_status DEFAULT 'todo' NOT NULL,
  priority integer DEFAULT 3 NOT NULL,
  owner_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  due_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT tasks_priority_check CHECK (priority BETWEEN 1 AND 5)
);
```

### 类型推导

```ts
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
```

- `$inferSelect`：数据库查询完整行的形状。
- `$inferInsert`：Drizzle 插入值的形状；有默认值或自动生成的列通常可省略。
- 两者是 TypeScript 类型，不执行运行时校验。

### 本课总结

- Drizzle schema 同时服务查询类型和迁移差异比较。
- 重要数据规则应落到 PostgreSQL 约束。
- `$inferInsert` 不是 API 请求 DTO，`$type<T>()` 也不是运行时验证。

### 练习题

1. 给任务增加 `completedAt`，允许为空，并写出对应 SQL。
2. 新建 `tags` 表，包含 `id` 和唯一的 `name`。
3. 把 `onDelete: "restrict"` 改成 `cascade` 会产生什么业务后果？
4. 为什么 `priority` 同时值得有 Zod 范围检查和数据库 CHECK？

---

## 第 4 课：Zod 基础——从 unknown 得到可信数据

### 本课目标

- 熟练使用 `parse`、`safeParse`、`z.infer`。
- 掌握对象、字符串、数字、枚举、数组、可选和可空。
- 理解 Zod 的输入类型与输出类型可能不同。

### 第一份请求 Schema

```ts
import * as z from "zod";

export const createTaskRequestSchema = z.strictObject({
  title: z.string().trim().min(1, "标题不能为空").max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  priority: z.int().min(1).max(5).default(3),
  ownerId: z.int().positive(),
  dueAt: z.iso.datetime().nullable().optional(),
  labels: z.array(z.string().trim().min(1)).max(10).default([]),
});

export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
```

### 方法讲解

#### `parse`

```ts
const data = createTaskRequestSchema.parse(input);
```

- 成功：返回经过解析后的深拷贝。
- 失败：抛出 `ZodError`。
- 适合在异常已由统一错误中间件接管的地方使用。

#### `safeParse`

```ts
const result = createTaskRequestSchema.safeParse(input);

if (!result.success) {
  console.log(result.error.issues);
} else {
  console.log(result.data);
}
```

结果是判别联合：检查 `success` 后，TypeScript 会正确缩小到 `error` 或 `data`。

#### `z.infer`、`z.input`、`z.output`

```ts
const countSchema = z.string().transform((value) => Number(value));

type CountInput = z.input<typeof countSchema>;   // string
type CountOutput = z.output<typeof countSchema>; // number
```

当 schema 含转换时，输入形状和解析后形状不同。数据库只应接收解析后的输出。

### 核心功能讲解

#### `optional` 与 `nullable`

```ts
z.string().optional(); // string | undefined，键可以不传
z.string().nullable(); // string | null，键要传但值可为空
z.string().nullish();  // string | null | undefined
```

#### `z.object`、`z.strictObject`、`z.looseObject`

- `z.object`：默认移除未声明的键。
- `z.strictObject`：遇到未知键就报错，适合严格 API 和 LLM 输出。
- `z.looseObject`：保留未知键，适合确实允许扩展字段的场景。

#### 日期的常见误区

- `z.date()` 校验 JavaScript `Date` 实例。
- `z.iso.datetime()` 校验 ISO 日期时间字符串。
- HTTP JSON 中通常收到字符串，不会自动成为 `Date`。

### Zod 与 SQL 的关系

Zod 不生成 SQL。它的作用是保证进入 Drizzle 的值满足应用约定：

```ts
const parsed = createTaskRequestSchema.parse(input);

await db.insert(tasks).values({
  title: parsed.title,
  priority: parsed.priority,
  ownerId: parsed.ownerId,
  dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
});
```

SQL 仍由 Drizzle 生成，Zod 只是把危险的 `unknown` 变成明确的数据。

### 本课总结

- Zod schema 同时提供运行时校验和静态类型推导。
- `safeParse` 很适合 HTTP 边界。
- 输入类型与输出类型在 coercion/transform 后可能不同。
- 日期字符串和 `Date` 对象必须明确区分。

### 练习题

1. 为“创建成员”写 schema：姓名 2～50 字符、邮箱、角色枚举。
2. 比较 `z.object` 与 `z.strictObject` 对 `{ title: "A", admin: true }` 的行为。
3. 写一个接收字符串页码并输出正整数的 schema。
4. 什么时候使用 `nullable`，什么时候使用 `optional`？各举一个 API 示例。

---

## 第 5 课：Drizzle Schema 与 Zod Schema 如何衔接

### 本课目标

- 掌握 `createSelectSchema`、`createInsertSchema`、`createUpdateSchema`。
- 分清数据库行、创建请求、更新请求和响应 schema。
- 学会在自动生成 schema 的基础上收窄业务边界。

### 从表生成基础 Schema

```ts
// src/schemas/task.ts
import * as z from "zod";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/zod";
import { tasks } from "../db/schema";

export const taskRowSchema = createSelectSchema(tasks);

const taskInsertBaseSchema = createInsertSchema(tasks, {
  title: (schema) => schema.trim().min(1).max(200),
  description: (schema) => schema.trim().max(2000),
  priority: (schema) => schema.int().min(1).max(5),
});

export const createTaskBodySchema = taskInsertBaseSchema
  .pick({
    title: true,
    description: true,
    priority: true,
    ownerId: true,
    dueAt: true,
    metadata: true,
  })
  .extend({
    dueAt: z.coerce.date().nullable().optional(),
  });

const taskUpdateBaseSchema = createUpdateSchema(tasks, {
  title: (schema) => schema.trim().min(1).max(200),
  priority: (schema) => schema.int().min(1).max(5),
});

export const updateTaskBodySchema = taskUpdateBaseSchema
  .pick({
    title: true,
    description: true,
    status: true,
    priority: true,
    ownerId: true,
    dueAt: true,
    metadata: true,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "至少提供一个要更新的字段",
  });
```

### 三个生成方法分别代表什么

| 方法 | 描述的数据边界 | 常见用途 |
| --- | --- | --- |
| `createSelectSchema(table)` | 从数据库读出的完整行 | 校验 API 响应、测试数据、外部数据同步 |
| `createInsertSchema(table)` | Drizzle 允许插入的形状 | 创建请求的基础，再用 `pick`/`omit` 收窄 |
| `createUpdateSchema(table)` | 可更新字段通常变为可选 | PATCH 请求的基础，仍要移除禁止更新字段 |

### 为什么不能直接把自动 Schema 暴露成 API

数据库插入结构不等于公开请求结构。例如：

- 数据库可能允许内部服务写 `status`，普通用户创建时却不应指定为 `done`。
- `id`、`createdAt` 由数据库生成，客户端不应控制。
- 管理员可更新 `ownerId`，普通成员只能更新标题。
- 数据库 JSON 字段的 TS 类型可能很宽，业务 API 应更严格。

因此推荐：**表生成基础 schema → `pick`/`omit` 收窄 → `extend`/refine 添加业务规则。**

### Refinement 回调与覆盖

```ts
createSelectSchema(tasks, {
  title: (schema) => schema.max(200), // 在推导出的字段 schema 上继续链式约束
  metadata: z.object({ source: z.string() }), // 完全覆盖该字段的 Zod schema
});
```

使用覆盖时，你也接管了字段的 nullable/optional 语义，必须重新检查。

### 对应的 SQL 原理

这三个 Zod 方法本身不执行 SQL。它们根据 Drizzle 列定义生成运行时 schema。真正的 SQL 发生在：

```ts
const input = createTaskBodySchema.parse(body);
await db.insert(tasks).values(input);
```

对应：

```sql
INSERT INTO tasks (title, description, priority, owner_id, due_at, metadata)
VALUES ($1, $2, $3, $4, $5, $6);
```

`$1` 等占位符由驱动绑定，避免把输入直接拼进 SQL 文本。

### 本课总结

- Drizzle 生成的 Zod schema 是可靠起点，不是最终 API 合同。
- Select、Insert、Update 是三个不同的数据形状。
- 用 `pick`、`omit`、`extend`、refine 表达业务权限和边界。
- Zod schema 生成不等于 SQL 执行。

### 练习题

1. 创建一个普通成员专用的更新 schema，禁止修改 `ownerId` 和 `status`。
2. 创建一个管理员更新 schema，允许改变 `ownerId`。
3. 为什么更新 schema 要拒绝空对象 `{}`？
4. 为 `metadata` 定义 `{ source: "manual" | "llm", confidence?: number }`。

---

# 第二阶段：把 Drizzle CRUD 与 SQL 学透

## 第 6 课：INSERT、RETURNING 与创建接口

### 本课目标

- 掌握 `insert`、`values`、批量插入和 `returning`。
- 用 Hono + Zod 完成创建任务接口。
- 理解应用默认值和数据库默认值的差别。

### 创建路由

```ts
// src/routes/tasks.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";
import { db } from "../db";
import { tasks } from "../db/schema";
import { createTaskBodySchema } from "../schemas/task";

export const taskRoutes = new Hono();

taskRoutes.post(
  "/",
  zValidator("json", createTaskBodySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: "VALIDATION_ERROR",
          details: z.flattenError(result.error),
        },
        400,
      );
    }
  }),
  async (c) => {
    const input = c.req.valid("json");

    const [created] = await db
      .insert(tasks)
      .values(input)
      .returning();

    return c.json(created, 201);
  },
);
```

### 方法讲解

#### `.insert(table)`

确定目标表：

```ts
db.insert(tasks)
```

对应 SQL 的 `INSERT INTO tasks`。

#### `.values(data)`

```ts
.values({ title: "学习 Drizzle", ownerId: 1 })
```

Drizzle 根据对象键确定列，根据 schema 检查 TypeScript 类型，并把值作为参数绑定。

#### `.returning()`

PostgreSQL 的 `RETURNING` 可以在写入后直接返回数据库最终保存的行，包括生成的 ID 和默认时间：

```ts
.returning({ id: tasks.id, title: tasks.title })
```

不要忘记查询返回的是数组。单条插入通常写成：

```ts
const [created] = await db.insert(tasks).values(input).returning();
```

### 对应 SQL

```ts
await db
  .insert(tasks)
  .values({ title: "学习 Drizzle", ownerId: 1 })
  .returning({ id: tasks.id, title: tasks.title });
```

近似 SQL：

```sql
INSERT INTO tasks (title, owner_id)
VALUES ($1, $2)
RETURNING id, title;
```

`status`、`priority`、`created_at` 没出现在 INSERT 中时，由 PostgreSQL 默认值补齐。

### 批量插入

```ts
await db
  .insert(tasks)
  .values([
    { title: "任务 A", ownerId: 1 },
    { title: "任务 B", ownerId: 1 },
  ])
  .returning();
```

对应一条多值 INSERT：

```sql
INSERT INTO tasks (title, owner_id)
VALUES ($1, $2), ($3, $4)
RETURNING *;
```

### 默认值放在哪里

| 放置位置 | 优点 | 风险/适用场景 |
| --- | --- | --- |
| Zod `.default()` | 解析后应用立即看到值 | 绕过应用直接写数据库时不会生效 |
| Drizzle `$defaultFn()` | 可由应用生成复杂值 | 仍是应用侧逻辑 |
| PostgreSQL `DEFAULT` | 所有写入路径都一致 | 复杂业务上下文不一定适合 |

时间戳、状态初值、数据库 ID 等通常优先放在数据库默认值。

### 错误边界

即使 Zod 成功，数据库仍可能失败：

- `ownerId` 不存在：外键错误。
- 唯一键冲突：unique violation。
- 并发请求同时抢占唯一值：只有数据库能最终裁决。

对外不要直接泄露完整数据库错误。把已知约束错误映射为 409 或 400，并记录内部日志。

### 本课总结

- `insert → values → returning` 对应 `INSERT ... VALUES ... RETURNING`。
- Zod 先验证，数据库约束最后裁决。
- 数据库默认值能覆盖所有写入路径。

### 练习题

1. 实现 `POST /users`，邮箱冲突时返回 409。
2. 批量创建 3 个任务，并只返回 `id`、`title`。
3. 比较在 Zod 和 PostgreSQL 中设置 `priority = 3` 的差异。
4. 如果 `returning()` 没有 `await`，为什么数组解构会报类型错误？

---

## 第 7 课：SELECT、过滤、排序和分页

### 本课目标

- 掌握完整选择、部分选择、`where`、operators、排序和分页。
- 理解 SQL 执行的逻辑阶段。
- 用 Zod 校验 query string。

### 查询参数 Schema

HTTP query 全部先以字符串出现，因此要显式转换：

```ts
import * as z from "zod";

export const taskQuerySchema = z.object({
  status: z.enum(["todo", "doing", "done", "cancelled"]).optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

### 动态筛选路由

```ts
import { and, desc, eq, ilike, type SQL } from "drizzle-orm";

taskRoutes.get(
  "/",
  zValidator("query", taskQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const filters: SQL[] = [];

    if (query.status) filters.push(eq(tasks.status, query.status));
    if (query.ownerId) filters.push(eq(tasks.ownerId, query.ownerId));
    if (query.q) filters.push(ilike(tasks.title, `%${query.q}%`));

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(and(...filters))
      .orderBy(desc(tasks.createdAt), desc(tasks.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    return c.json({ data: rows });
  },
);
```

### 方法与 SQL 映射

| Drizzle | SQL | 用途 |
| --- | --- | --- |
| `select().from(tasks)` | `SELECT * FROM tasks` | 全列查询 |
| `select({ id: tasks.id })` | `SELECT id` | 部分选择 |
| `eq(column, value)` | `column = $1` | 等值 |
| `ne` / `gt` / `gte` / `lt` / `lte` | `<>` / `>` / `>=` / `<` / `<=` | 比较 |
| `ilike(column, pattern)` | `ILIKE $1` | PostgreSQL 不区分大小写匹配 |
| `inArray(column, values)` | `IN (...)` | 多个候选值 |
| `and(...)` / `or(...)` | `AND` / `OR` | 组合条件 |
| `isNull(column)` | `IS NULL` | 空值判断，不能写 `= NULL` |
| `orderBy(desc(column))` | `ORDER BY column DESC` | 排序 |
| `limit(n).offset(m)` | `LIMIT n OFFSET m` | 偏移分页 |

### 对应 SQL

上面的查询近似：

```sql
SELECT id, title, status, priority, created_at
FROM tasks
WHERE status = $1
  AND owner_id = $2
  AND title ILIKE $3
ORDER BY created_at DESC, id DESC
LIMIT $4 OFFSET $5;
```

SQL 的逻辑理解顺序可先记成：`FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT/OFFSET`。书写顺序与逻辑处理顺序不同。

### 为什么优先部分选择

只查询需要的列可以：

- 减少数据库到应用的传输量。
- 防止误把内部字段返回给客户端。
- 让 API 响应结构更清晰。

### OFFSET 分页与游标分页

`OFFSET` 容易理解，但页数很深时数据库仍需跳过大量行，而且数据变化可能造成重复或遗漏。更稳定的方式是基于排序键做 keyset pagination：

```ts
where(lt(tasks.id, cursor)).orderBy(desc(tasks.id)).limit(pageSize)
```

近似 SQL：

```sql
WHERE id < $1 ORDER BY id DESC LIMIT $2;
```

### 安全提示

`ilike(tasks.title, `%${query.q}%`)` 中的模式字符串仍会作为参数绑定，不是 SQL 字符串拼接。不要把用户输入传给 `sql.raw()`。

### 本课总结

- 查询参数先由 Zod 从字符串转换并限制范围。
- Drizzle operators 基本直接映射到 SQL 操作符。
- 部分选择更安全；深分页优先考虑游标。

### 练习题

1. 增加 `priorityMin` 和 `dueBefore` 筛选。
2. 实现按 `status` 多选，使用 `inArray`。
3. 把 OFFSET 分页改为以 `id` 为游标的分页。
4. 解释为什么 SQL 中判断空值使用 `IS NULL` 而不是 `= NULL`。

---

## 第 8 课：UPDATE、DELETE 与 PATCH 语义

### 本课目标

- 掌握 `update().set().where().returning()` 和 `delete().where()`。
- 理解 PATCH 中“缺失、清空、保持不变”的差别。
- 避免无条件更新和删除。

### 路径参数 Schema

```ts
export const taskIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
```

### 更新接口

```ts
import { eq } from "drizzle-orm";

taskRoutes.patch(
  "/:id",
  zValidator("param", taskIdParamSchema),
  zValidator("json", updateTaskBodySchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const patch = c.req.valid("json");

    const [updated] = await db
      .update(tasks)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) {
      return c.json({ error: "TASK_NOT_FOUND" }, 404);
    }

    return c.json(updated);
  },
);
```

### 删除接口

```ts
taskRoutes.delete(
  "/:id",
  zValidator("param", taskIdParamSchema),
  async (c) => {
    const { id } = c.req.valid("param");

    const [deleted] = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning({ id: tasks.id });

    if (!deleted) {
      return c.json({ error: "TASK_NOT_FOUND" }, 404);
    }

    return c.body(null, 204);
  },
);
```

### 方法与 SQL 映射

```ts
db.update(tasks).set({ status: "done" }).where(eq(tasks.id, 10));
```

```sql
UPDATE tasks SET status = $1 WHERE id = $2;
```

```ts
db.delete(tasks).where(eq(tasks.id, 10));
```

```sql
DELETE FROM tasks WHERE id = $1;
```

### `undefined`、`null` 与清空字段

PATCH 必须表达三种意图：

| 请求状态 | 业务含义 | Drizzle 更新值 |
| --- | --- | --- |
| 没有 `description` 键 | 保持原值 | 不把该列加入 `SET` |
| `description: null` | 明确清空 | `SET description = NULL` |
| `description: "新内容"` | 更新内容 | `SET description = $1` |

Drizzle 更新对象通常会忽略 `undefined` 字段。因此，如果 UI 把空字符串转换成 `undefined`，它表达的是“不更新”，不是“清空”。要清空可空列，应传明确的 `null`。

### 删除策略

- 硬删除：真正执行 `DELETE`，简单但不可恢复。
- 软删除：增加 `deletedAt`，执行 `UPDATE ... SET deleted_at = now()`；所有查询都要正确排除已删除行。

软删除不是免费功能。它影响唯一约束、索引、统计和每个查询条件。

### 最大风险：漏写 WHERE

```ts
await db.delete(tasks); // 会删除整张表的数据
await db.update(tasks).set({ status: "done" }); // 会更新所有行
```

数据库不会猜你的意图。对批量更新/删除应：

1. 在代码层明确允许。
2. 记录审计信息。
3. 必要时先 SELECT/COUNT 影响范围。
4. 使用事务。

### 本课总结

- UPDATE 和 DELETE 的危险性集中在 `WHERE`。
- `undefined` 是未提供，`null` 是明确的数据库空值。
- `returning` 可用于判断目标是否存在。

### 练习题

1. 实现“完成任务”接口，同时写入 `completedAt`。
2. 实现清空 `description`，验证 `null` 与缺失键的不同结果。
3. 将硬删除改为软删除，并列出所有受影响查询。
4. 为批量取消任务设计一个安全的请求 schema。

---

## 第 9 课：外键、关系、JOIN 与嵌套查询

### 本课目标

- 分清数据库外键、Drizzle relations 和 SQL JOIN。
- 掌握 `innerJoin`、`leftJoin` 与部分选择。
- 理解一对多数据为何会重复父行。

### 三个容易混淆的概念

#### 外键约束

```ts
ownerId: integer("owner_id").references(() => users.id)
```

它会生成 PostgreSQL `FOREIGN KEY`，保证 `owner_id` 指向真实用户。

#### SQL JOIN

JOIN 决定一次查询如何组合表，不会自动创建外键。

#### Drizzle Relations

Drizzle relations 描述应用层的表关系，供 relational query API 生成嵌套结果。它不会替代数据库外键。

### SQL-like JOIN

```ts
const rows = await db
  .select({
    taskId: tasks.id,
    title: tasks.title,
    owner: {
      id: users.id,
      name: users.name,
      email: users.email,
    },
  })
  .from(tasks)
  .innerJoin(users, eq(tasks.ownerId, users.id));
```

对应：

```sql
SELECT
  tasks.id AS task_id,
  tasks.title,
  users.id AS owner_id,
  users.name AS owner_name,
  users.email AS owner_email
FROM tasks
INNER JOIN users ON tasks.owner_id = users.id;
```

### INNER JOIN 与 LEFT JOIN

- `INNER JOIN`：只有两边匹配的行才返回。
- `LEFT JOIN`：左表所有行都返回；右表无匹配时，其字段为 `NULL`。

如果任务允许 `ownerId` 为空，`leftJoin` 返回的 owner 类型会带 `null`，这是 SQL 语义，不是 TypeScript 故意刁难。

### 声明 Relations

不同 Drizzle 发布线的 relations API 正在演进。下面展示稳定的概念；若你使用 v1 RC，应以该版本的 Relations v2 文档为准，不要复制旧版本 API 混用。

```ts
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  owner: one(users, {
    fields: [tasks.ownerId],
    references: [users.id],
  }),
}));
```

然后可以表达嵌套读取：

```ts
const result = await db.query.users.findMany({
  with: { tasks: true },
});
```

官方文档说明，relational query API 会为嵌套结果生成一条 SQL 查询。它适合常见关联读取；复杂报表、精确投影和需要直接理解 SQL 的场景，SQL-like API 往往更清晰。

### 一对多为何出现重复父行

一个用户有 3 个任务，普通 JOIN 会返回 3 行用户信息，每行搭配一个任务。这是关系表的平面结果。嵌套对象需要在应用层聚合，或使用 Drizzle relational query API/数据库 JSON 聚合。

### N+1 问题

```ts
for (const user of allUsers) {
  await db.select().from(tasks).where(eq(tasks.ownerId, user.id));
}
```

1 次用户查询 + N 次任务查询就是 N+1。优先用 JOIN、批量 `IN` 或 relational query，一次或少量查询完成。

### 本课总结

- 外键保证数据一致性；relations 提供应用查询元数据；JOIN 组合查询结果。
- INNER/LEFT JOIN 的差别会直接体现在返回类型的 nullability 上。
- 关联查询要警惕重复父行和 N+1。

### 练习题

1. 查询所有任务及负责人姓名。
2. 查询所有用户，即使没有任务也要返回，并解释为什么选 LEFT JOIN。
3. 增加 `comments` 表，设计任务与评论的一对多关系。
4. 把一个 N+1 查询改写为 JOIN 或 `inArray` 批量查询。

---

# 第三阶段：Zod 进阶与数据库工程能力

## 第 10 课：Zod 进阶——组合、条件规则、转换与错误

### 本课目标

- 掌握 schema 组合、联合、coercion、refine、transform、preprocess。
- 设计稳定、可消费的错误响应。
- 知道什么时候不应转换数据。

### 对象组合方法

```ts
const baseTaskSchema = z.object({
  title: z.string().min(1),
  priority: z.int().min(1).max(5),
  ownerId: z.int().positive(),
});

const titleOnly = baseTaskSchema.pick({ title: true });
const withoutOwner = baseTaskSchema.omit({ ownerId: true });
const patchTask = baseTaskSchema.partial();
const requiredTask = patchTask.required();
const withStatus = baseTaskSchema.safeExtend({
  status: z.enum(["todo", "doing", "done"]),
});
```

- `pick`：白名单字段，设计公开 API 时很安全。
- `omit`：排除少数字段。
- `partial`：字段变可选，适合 PATCH 的起点，但还要拒绝空对象。
- `safeExtend`：当原 schema 已含 refinement 时更安全。

### 联合与判别联合

当数据有几种明确形状时，不要堆很多相互依赖的 optional：

```ts
const reminderSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("email"),
    email: z.email(),
  }),
  z.object({
    kind: z.literal("webhook"),
    url: z.url(),
    secret: z.string().min(16),
  }),
]);
```

判别字段 `kind` 让 Zod、TypeScript、API 使用者都更容易理解数据分支。

### `refine` 与 `superRefine`

```ts
const scheduleSchema = z
  .object({
    startsAt: z.coerce.date(),
    dueAt: z.coerce.date(),
  })
  .refine((data) => data.dueAt > data.startsAt, {
    path: ["dueAt"],
    message: "截止时间必须晚于开始时间",
  });
```

多字段、多问题时用 `superRefine`：

```ts
const taskRuleSchema = z
  .object({
    status: z.enum(["todo", "done"]),
    completedAt: z.coerce.date().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "done" && !data.completedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "完成状态必须有完成时间",
      });
    }
  });
```

### Coercion、Preprocess、Transform

| 方法 | 发生时机与用途 | 示例 |
| --- | --- | --- |
| `z.coerce.number()` | 先用 JS 转数字，再校验 | query string 页码 |
| `z.preprocess(fn, schema)` | 在进入目标 schema 前规范原始值 | 把空字符串转 `undefined` |
| `.transform(fn)` | 校验成功后产生新输出 | 规范 slug、映射领域对象 |
| `.pipe(schema)` | 转换后继续由另一 schema 校验 | 字符串转数值后限制范围 |

谨慎使用 `z.coerce.boolean()`：JavaScript 中非空字符串都是真值，所以字符串 `"false"` 也可能得到 `true`。环境变量式布尔值更适合 Zod 4 的 `z.stringbool()`。

### 异步校验

```ts
const uniqueEmailSchema = z.email().refine(
  async (email) => !(await emailExists(email)),
  "邮箱已存在",
);

const result = await uniqueEmailSchema.safeParseAsync(input);
```

异步校验可以改善用户体验，但唯一性仍必须有数据库 UNIQUE 约束，因为校验完成到 INSERT 之间存在并发窗口。

### 错误格式化

Zod 4 的常用错误工具：

```ts
const result = schema.safeParse(input);

if (!result.success) {
  const nested = z.treeifyError(result.error);
  const flat = z.flattenError(result.error);
  const readable = z.prettifyError(result.error);
}
```

- `treeifyError`：嵌套对象/数组表单。
- `flattenError`：浅层表单和普通 API。
- `prettifyError`：日志或开发调试。
- `formatError` 已废弃，不应作为新代码入口。

推荐 API 错误结构：

```json
{
  "error": "VALIDATION_ERROR",
  "message": "请求参数不合法",
  "fieldErrors": {
    "title": ["标题不能为空"]
  }
}
```

不要让客户端依赖 Zod 内部 issue 的所有字段；对外定义你自己的稳定错误合同。

### Zod 与数据库规则的取舍

本课的 Zod 方法都只处理内存中的输入与输出，**不会生成 SQL**。只有解析成功的数据交给 Drizzle 后，才会进入 `INSERT`、`UPDATE` 等数据库语句；数据库约束仍会独立执行。

| 规则 | Zod | PostgreSQL |
| --- | --- | --- |
| 字符串 trim | 是 | 通常否 |
| 两个请求字段的友好比较 | 是 | 可选 CHECK |
| 外键存在 | 可预查 | 必须 FK |
| 唯一性 | 可预查改善提示 | 必须 UNIQUE |
| 枚举 | 是 | 建议 enum/CHECK |
| 事务一致性 | 否 | 必须 transaction |

### 本课总结

- 对象组合和判别联合能让复杂输入保持可读。
- `refine` 负责跨字段业务规则，数据库仍负责最终一致性。
- transform 会改变输出类型，写库前必须使用解析后的 `data`。
- 错误格式应成为稳定 API 合同。

### 练习题

1. 设计“固定日期”与“重复规则”两种任务调度输入，使用判别联合。
2. 使用 `superRefine` 规定：高优先级任务必须有 `dueAt`。
3. 验证 `z.coerce.boolean().parse("false")` 的结果，再改用 `z.stringbool()`。
4. 把 Zod 错误转换成统一的 `{ error, message, fieldErrors }`。

---

## 第 11 课：迁移——让 Schema 变化可追踪、可审查

### 本课目标

- 理解 codebase-first 与 database-first。
- 掌握 `generate`、`migrate`、`push`、`pull`。
- 建立适合团队协作的迁移流程。

### Drizzle Kit 配置

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

所有表、enum、index 等模型都必须从配置指定的 schema 文件或目录中导出，否则 Drizzle Kit 无法读取。

### 四个核心命令

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
npx drizzle-kit push
npx drizzle-kit pull
```

| 命令 | 方向 | 适用场景 |
| --- | --- | --- |
| `generate` | TS schema 差异 → SQL 文件 | 团队、生产、需要审查和版本控制 |
| `migrate` | 未执行的迁移文件 → 数据库 | 部署或本地按历史顺序执行 |
| `push` | TS schema 差异 → 直接改数据库 | 快速原型、个人开发数据库 |
| `pull` | 现有数据库 → TS schema | database-first、接手已有库 |

### 推荐学习与团队流程

```text
修改 schema.ts
  ↓
drizzle-kit generate
  ↓
阅读生成的 migration.sql
  ↓
在测试数据库 migrate
  ↓
运行测试
  ↓
提交 schema + migration + 测试
  ↓
部署时 migrate
```

### 对应 SQL 原理

在 `tasks` 增加 `completed_at`：

```ts
completedAt: timestamp("completed_at", { withTimezone: true }),
```

可能生成：

```sql
ALTER TABLE tasks ADD COLUMN completed_at timestamptz;
```

给一个已有大量数据的表增加非空列要小心：

```sql
ALTER TABLE tasks ADD COLUMN category text NOT NULL;
```

旧行没有值，迁移可能失败。更安全的展开式迁移：

1. 先增加可空列。
2. 分批回填旧数据。
3. 应用开始写新列。
4. 确认无 NULL 后再设 `NOT NULL`。

### `push` 为什么不等于迁移历史

`push` 根据当前 schema 和数据库状态直接应用差异，速度快，但没有同样清晰、可审查、可重放的 SQL 历史。课程练习可先用 `push`，最终项目和团队环境应练习 `generate + migrate`。

### 迁移纪律

- 已经在共享环境执行的旧迁移不要随意改写。
- schema 变化和迁移文件一起提交。
- 每次生成后阅读 SQL，尤其关注 DROP、类型转换、默认值、锁表和数据回填。
- 结构迁移与业务数据迁移可分步进行。
- 备份和回滚策略必须结合真实部署环境设计，不能只依赖 ORM。

### 本课总结

- Schema 是期望状态，migration 是从旧状态到新状态的历史动作。
- `generate + migrate` 更适合审查和协作，`push` 更适合快速迭代。
- 生产迁移必须考虑旧数据、锁、回填和多版本应用兼容。

### 练习题

1. 增加 `completedAt` 并生成迁移，手工解释 SQL。
2. 设计给已有任务增加非空 `category` 的四步迁移。
3. 在一个测试库运行 `push`，再说明为什么不直接把同样流程照搬到生产。
4. 模拟团队 code review：检查一个包含 `DROP COLUMN` 的迁移。

---

## 第 12 课：事务、回滚与并发一致性

### 本课目标

- 理解事务的原子性和回滚。
- 掌握 `db.transaction`、事务返回值和嵌套 savepoint。
- 知道 Zod 校验为什么不能代替事务。

### 一个必须使用事务的场景

“完成任务并增加用户积分”包含两个写操作：

```ts
const result = await db.transaction(async (tx) => {
  const [task] = await tx
    .update(tasks)
    .set({ status: "done", updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), ne(tasks.status, "done")))
    .returning();

  if (!task) {
    tx.rollback();
  }

  const [user] = await tx
    .update(users)
    .set({ points: sql`${users.points} + 10` })
    .where(eq(users.id, task.ownerId))
    .returning({ id: users.id, points: users.points });

  return { task, user };
});
```

如果第二步失败，第一步也回滚，数据库不会停留在“任务完成但积分没加”的半完成状态。

### SQL 原理

概念上对应：

```sql
BEGIN;

UPDATE tasks
SET status = 'done', updated_at = now()
WHERE id = $1 AND status <> 'done'
RETURNING *;

UPDATE users
SET points = points + 10
WHERE id = $2
RETURNING id, points;

COMMIT;
```

发生错误时：

```sql
ROLLBACK;
```

### 为什么 `points + 10` 应在 SQL 中完成

不安全的读改写：

```ts
const user = await getUser(id);
await updateUser(id, { points: user.points + 10 });
```

两个并发请求都可能读到 100，最后都写成 110，丢失一次更新。SQL 表达式：

```ts
sql`${users.points} + 10`
```

让数据库在当前行值上原子递增。

### 嵌套事务与 Savepoint

Drizzle 支持嵌套 transaction API，PostgreSQL 中对应 savepoint 概念：

```ts
await db.transaction(async (tx) => {
  await tx.insert(tasks).values(...);

  await tx.transaction(async (tx2) => {
    await tx2.insert(auditLogs).values(...);
  });
});
```

Savepoint 允许回滚事务的一部分，但不要用它掩盖不清晰的业务边界。

### 隔离级别

PostgreSQL/Drizzle 可配置 `read committed`、`repeatable read`、`serializable` 等隔离级别。默认隔离通常足够，但库存扣减、唯一抢占、财务状态等场景要分析并发异常，并考虑：

- 条件 UPDATE。
- 行锁 `FOR UPDATE`。
- 唯一约束。
- 更高隔离级别与重试。

更高隔离并非免费，会增加冲突和重试。

### 事务边界原则

- 事务内只做需要原子一致的数据库工作。
- 不要在持有数据库事务时等待慢速 LLM、邮件或第三方 HTTP。
- 外部副作用通常用 outbox、任务队列或补偿机制衔接。

### 本课总结

- 事务把多条 SQL 作为一个逻辑单元提交或回滚。
- 校验输入不能防止写入过程中的并发竞争。
- 原子表达式、条件 UPDATE、约束和隔离级别共同处理并发。

### 练习题

1. 实现“创建任务 + 写审计日志”，任一步失败都回滚。
2. 演示读改写积分可能丢失更新，并改成 SQL 原子递增。
3. 为什么不应在事务中等待 LLM 返回？
4. 为“同一用户同一标题只能有一个未完成任务”讨论约束和事务方案。

---

## 第 13 课：聚合、子查询、索引与 EXPLAIN

### 本课目标

- 掌握统计、分组、子查询和动态查询。
- 理解索引帮助什么、不能帮助什么。
- 用 `EXPLAIN` 读懂基本查询计划。

### 分组统计

```ts
import { count, desc, eq } from "drizzle-orm";

const stats = await db
  .select({
    status: tasks.status,
    total: count(),
  })
  .from(tasks)
  .groupBy(tasks.status)
  .orderBy(desc(count()));
```

对应：

```sql
SELECT status, count(*) AS total
FROM tasks
GROUP BY status
ORDER BY count(*) DESC;
```

聚合后，每一行代表一个分组，不再代表原始任务。

### HAVING 与 WHERE

- `WHERE` 在分组前过滤原始行。
- `HAVING` 在分组后过滤聚合结果。

```sql
SELECT owner_id, count(*)
FROM tasks
WHERE status <> 'cancelled'
GROUP BY owner_id
HAVING count(*) >= 5;
```

### 子查询

```ts
const activeOwners = db
  .select({ ownerId: tasks.ownerId })
  .from(tasks)
  .where(eq(tasks.status, "doing"))
  .groupBy(tasks.ownerId)
  .as("active_owners");

const rows = await db
  .select({ id: users.id, name: users.name })
  .from(users)
  .innerJoin(activeOwners, eq(users.id, activeOwners.ownerId));
```

### 常用索引设计

如果常见查询是：

```sql
SELECT * FROM tasks
WHERE owner_id = $1 AND status = $2
ORDER BY created_at DESC
LIMIT 20;
```

可考虑复合索引：

```ts
import { index } from "drizzle-orm/pg-core";

index("tasks_owner_status_created_idx").on(
  tasks.ownerId,
  tasks.status,
  tasks.createdAt,
)
```

索引不是“查询加速开关”。它会：

- 占磁盘。
- 增加 INSERT/UPDATE/DELETE 维护成本。
- 是否被使用取决于选择性、数据量、排序和统计信息。

### EXPLAIN 基础

```sql
EXPLAIN ANALYZE
SELECT * FROM tasks
WHERE owner_id = 42 AND status = 'doing';
```

先关注：

- `Seq Scan`：顺序扫描整表。
- `Index Scan`：通过索引定位表行。
- `Bitmap Index Scan / Bitmap Heap Scan`：先收集匹配位置，再批量访问表页。
- `rows`：计划估计或实际输出行数。
- `cost`：规划器比较方案的内部估算，不等于毫秒。
- `actual time`：`ANALYZE` 真正执行后的时间。

PostgreSQL 会为每个查询选择计划；小表或低选择性条件使用顺序扫描可能完全合理，不要看到 `Seq Scan` 就盲目加索引。

### ORM 性能排查顺序

1. 明确实际生成的 SQL 和参数。
2. 确认返回行数与列数是否过多。
3. 检查是否存在 N+1。
4. 用 `EXPLAIN (ANALYZE, BUFFERS)` 查看计划。
5. 再决定索引、查询改写、缓存或数据模型调整。

### 本课总结

- `count/groupBy/having` 直接映射 SQL 聚合。
- 索引要根据真实查询模式设计。
- 性能优化从实际 SQL 和查询计划开始，不从猜测开始。

### 练习题

1. 统计每个负责人未完成任务数。
2. 只返回未完成任务数大于 5 的负责人。
3. 对常用筛选写出候选复合索引，并解释列顺序。
4. 对同一查询在加索引前后运行 `EXPLAIN ANALYZE`，记录计划差异。

---

# 第四阶段：结构化数据与完整项目

## 第 14 课：用 Zod 约束 LLM 结构化输出

### 本课目标

- 把 Zod schema 转成 JSON Schema。
- 理解“提示模型输出 JSON”与“得到可信数据”的差别。
- 建立 LLM → Zod → 业务规则 → Drizzle 的安全管线。

### 为什么 Zod 适合 LLM 结构化输出

LLM 返回的是外部、不可信数据，即使模型提供 structured output 功能，也仍可能遇到：

- 模型拒答或工具错误。
- JSON 能解析，但字段语义不合法。
- schema 版本变化。
- 值满足类型，却违反业务或数据库约束。

Zod 可以同时成为：

1. TypeScript 类型来源。
2. 运行时校验器。
3. JSON Schema 的来源。

### 设计适合 JSON Schema 的 Schema

```ts
import * as z from "zod";

export const llmTaskDraftSchema = z.strictObject({
  title: z.string().min(1).max(200).meta({
    description: "简洁、可执行的任务标题",
  }),
  description: z.string().max(2000).nullable(),
  priority: z.int().min(1).max(5),
  status: z.enum(["todo", "doing"]),
  dueAt: z.iso.datetime().nullable(),
  labels: z.array(z.string().min(1).max(30)).max(10),
  confidence: z.number().min(0).max(1),
});

export type LlmTaskDraft = z.infer<typeof llmTaskDraftSchema>;

export const llmTaskDraftJsonSchema = z.toJSONSchema(llmTaskDraftSchema);
```

Zod 4 原生 `z.toJSONSchema()` 默认目标为 JSON Schema Draft 2020-12，也可以指定 `openapi-3.0` 等目标。

### 不能直接转换的类型

JSON Schema 无法自然表达某些 Zod 类型，包括 `z.date()`、`z.bigint()`、`z.transform()`、`z.map()`、`z.set()` 等。用于 LLM structured output 的 schema 应优先使用 JSON 原生形状：

- 日期使用 ISO 字符串，而不是 `Date`。
- 大整数按业务决定使用受限 number 或字符串。
- 不在提供给模型的 schema 中做 transform；模型输出通过后，再在第二阶段转换。

### 两阶段 Schema

第一阶段：描述 LLM 必须生成的 JSON。

```ts
const rawDraftSchema = z.strictObject({
  title: z.string().min(1).max(200),
  dueAt: z.iso.datetime().nullable(),
  priority: z.int().min(1).max(5),
});
```

第二阶段：转换成数据库写入对象。

```ts
const draftToInsertSchema = rawDraftSchema.transform((draft) => ({
  title: draft.title.trim(),
  dueAt: draft.dueAt ? new Date(draft.dueAt) : null,
  priority: draft.priority,
  metadata: { source: "llm" as const },
}));
```

这样既能生成兼容 JSON Schema 的模型合同，又能得到适合 Drizzle 的 `Date` 和内部 metadata。

### 完整安全管线

```ts
async function persistLlmDraft(rawText: string, ownerId: number) {
  let json: unknown;

  try {
    json = JSON.parse(rawText);
  } catch {
    return { ok: false as const, error: "INVALID_JSON" };
  }

  const draftResult = llmTaskDraftSchema.safeParse(json);
  if (!draftResult.success) {
    return {
      ok: false as const,
      error: "INVALID_LLM_OUTPUT",
      details: z.treeifyError(draftResult.error),
    };
  }

  const draft = draftResult.data;

  const insertResult = createTaskBodySchema.safeParse({
    title: draft.title,
    description: draft.description,
    priority: draft.priority,
    status: draft.status,
    ownerId,
    dueAt: draft.dueAt,
    metadata: {
      source: "llm",
      confidence: draft.confidence,
      labels: draft.labels,
    },
  });

  if (!insertResult.success) {
    return { ok: false as const, error: "BUSINESS_VALIDATION_FAILED" };
  }

  const [created] = await db
    .insert(tasks)
    .values({
      ...insertResult.data,
      status: draft.status,
    })
    .returning();

  return { ok: true as const, data: created };
}
```

### 为什么要校验两次

- LLM schema：模型生成格式和模型可理解的字段。
- 写入 schema：当前用户权限、数据库字段、业务默认值和内部映射。

不要为了“只维护一个 schema”而把所有边界强行合并。可以从共同基础组合，但每个边界应该有自己的明确合同。

### 结构化输出的工程规则

- 使用 `strictObject`，减少模型偷偷增加字段。
- enum 值要少而明确。
- 字段描述要写语义，不只是重复字段名。
- schema 要版本化；保存模型名、schemaVersion 和原始响应或摘要以便审计。
- 设置超时、重试上限和拒答处理。
- LLM 调用不要放在数据库事务内部。
- 永远在写库前执行本地 Zod 校验。

### 本课总结

- Structured output 改善生成格式，但不取消运行时校验。
- Zod 4 可原生生成 JSON Schema。
- LLM JSON schema 和数据库写入 schema 是两个边界。
- JSON 不可表示的类型要在第二阶段转换。

### 练习题

1. 为“会议纪要 → 多个任务”设计 `z.array(...)` 输出 schema。
2. 故意让模型输出多余字段，比较 `z.object` 和 `z.strictObject`。
3. 尝试把含 `z.date()` 或 `.transform()` 的 schema 转 JSON Schema，解释失败原因。
4. 为 LLM 任务草稿增加 `schemaVersion`，并设计升级策略。

---

## 第 15 课：结课项目——团队任务 API

### 项目完成目标

实现一个小而完整的 API：

| 方法与路径 | 功能 | 核心方法 | 对应 SQL 原理 |
| --- | --- | --- | --- |
| `POST /users` | 创建成员 | Zod、`insert().values().returning()` | `INSERT ... RETURNING` + `UNIQUE` |
| `POST /tasks` | 创建任务 | `createInsertSchema`、`insert` | `INSERT` + 默认值 + 外键 |
| `GET /tasks` | 筛选、排序、分页 | operators、partial select | `SELECT ... WHERE ... ORDER BY ... LIMIT` |
| `GET /tasks/:id` | 任务和负责人 | param 校验、`innerJoin` | `SELECT ... INNER JOIN ... ON` |
| `PATCH /tasks/:id` | 部分更新 | update schema、`update().set()` | `UPDATE ... SET ... WHERE ... RETURNING` |
| `DELETE /tasks/:id` | 删除或软删除 | `delete().where()` | `DELETE ... WHERE ... RETURNING` |
| `POST /tasks/:id/complete` | 完成任务并加积分 | `transaction`、SQL 表达式 | `BEGIN` + 两次 `UPDATE` + `COMMIT/ROLLBACK` |
| `GET /stats/tasks` | 按状态/负责人统计 | `count`、`groupBy` | `COUNT(*) ... GROUP BY` |
| `POST /tasks/import/llm` | 导入 LLM 任务草稿 | JSON Schema、双层 Zod 校验 | 校验成功后执行参数化 `INSERT` |

### 推荐模块边界

```text
src/
├── app.ts                 # 组装 Hono 与错误处理
├── index.ts               # 启动入口
├── db/
│   ├── index.ts           # 连接池和 drizzle 实例
│   └── schema/
│       ├── users.ts
│       ├── tasks.ts
│       └── index.ts
├── schemas/
│   ├── common.ts          # id、分页、公共错误
│   ├── user.ts
│   ├── task.ts
│   └── llm-task.ts
├── routes/
│   ├── users.ts
│   └── tasks.ts
├── services/
│   ├── task-service.ts    # 用例和事务边界
│   └── llm-import.ts
└── errors/
    └── app-error.ts
```

Hono route 应负责 HTTP 输入/输出，service 负责用例，Drizzle schema/query 负责数据访问。项目小的时候不必堆大量 repository 抽象；当查询需要被多个用例复用或数据源会变化时再抽取。

### 统一错误合同

```ts
type ApiError = {
  error: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
};
```

建议状态码：

- 400：Zod 请求校验失败。
- 404：资源不存在。
- 409：唯一键或业务状态冲突。
- 500：未预期错误，对外隐藏 SQL、连接串和堆栈。

### 最小测试清单

Hono 可用 `app.request()` 做端到端路由测试。发送 JSON 时必须设置正确的 `Content-Type`，否则 Hono 不会按 JSON 解析请求体。

```ts
const response = await app.request("/tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "完成课程",
    ownerId: 1,
    priority: 5,
  }),
});

expect(response.status).toBe(201);
```

至少覆盖：

1. 合法创建。
2. Zod 字段错误。
3. 未知字段。
4. 外键不存在。
5. 唯一键冲突。
6. PATCH 空对象。
7. `null` 清空字段。
8. 资源不存在。
9. 事务中途失败后没有半完成数据。
10. LLM 返回非法 JSON、合法 JSON 但不符合 schema、完全合法三种情况。

### 验收标准

- [ ] Schema 与迁移文件都纳入版本控制。
- [ ] 所有 HTTP 输入都从 `unknown` 经过 Zod。
- [ ] API schema 没有直接暴露不应由客户端控制的数据库字段。
- [ ] 每个 UPDATE/DELETE 都审查了 WHERE。
- [ ] 唯一性、外键、范围等关键规则在数据库有最终约束。
- [ ] 事务中没有 LLM 或慢速第三方调用。
- [ ] 列表查询使用部分选择、分页和确定性排序。
- [ ] 能为关键 Drizzle 查询手写近似 SQL。
- [ ] 至少对一个核心查询运行并解释 `EXPLAIN ANALYZE`。
- [ ] LLM 结构化输出经过本地 Zod 二次校验。

### 练习题（最终综合练习）

1. 新增标签多对多关系，并实现按标签筛选任务。
2. 实现任务状态流转规则：`todo → doing → done`，取消后不能恢复。
3. 实现软删除，并调整唯一约束与统计查询。
4. 为 LLM 导入增加“人工确认后再入库”的草稿表。
5. 写一份 `README.md`，说明环境变量、迁移、启动、测试和 API 示例。

### 本课总结

- 完整项目的重点不是路由数量，而是边界清楚、SQL 可解释、约束可靠。
- Zod 和 Drizzle 可以共享结构信息，但请求、数据库写入、数据库读取和 LLM 输出仍应分别建模。
- 当你能预测 SQL、处理错误、迁移和并发时，才算真正会用 ORM。

---

# 附录 A：Drizzle 方法 → SQL 速查

| Drizzle | 近似 SQL |
| --- | --- |
| `db.select().from(tasks)` | `SELECT * FROM tasks` |
| `db.select({ id: tasks.id }).from(tasks)` | `SELECT id FROM tasks` |
| `.where(eq(tasks.id, id))` | `WHERE id = $1` |
| `.where(and(eq(...), gte(...)))` | `WHERE ... AND ... >= ...` |
| `.orderBy(desc(tasks.createdAt))` | `ORDER BY created_at DESC` |
| `.limit(20).offset(40)` | `LIMIT 20 OFFSET 40` |
| `db.insert(tasks).values(data)` | `INSERT INTO tasks (...) VALUES (...)` |
| `.returning()` | `RETURNING *` |
| `db.update(tasks).set(data)` | `UPDATE tasks SET ...` |
| `db.delete(tasks)` | `DELETE FROM tasks` |
| `.innerJoin(users, eq(...))` | `INNER JOIN users ON ...` |
| `.leftJoin(users, eq(...))` | `LEFT JOIN users ON ...` |
| `count()` + `.groupBy(column)` | `COUNT(*) ... GROUP BY column` |
| `db.transaction(async tx => ...)` | `BEGIN ... COMMIT/ROLLBACK` |
| <code>sql\`${column} + 1\`</code> | SQL 表达式，值仍参数化 |

> 速查表只用于建立映射。具体 SQL 受所选列、驱动、dialect 和 Drizzle 版本影响，应通过日志或查询工具查看实际生成结果。

# 附录 B：Zod 常用方法速查

| 方法 | 核心用途 | 常见场景 |
| --- | --- | --- |
| `z.object` | 对象结构，默认移除未知键 | 普通内部输入 |
| `z.strictObject` | 拒绝未知键 | 公开 API、LLM 输出 |
| `z.string` / `z.number` / `z.int` | 基础类型 | 字段校验 |
| `z.enum` | 有限字符串集合 | 状态、角色 |
| `z.array` / `z.tuple` | 列表/固定位置数组 | 标签、坐标 |
| `optional` / `nullable` / `nullish` | 缺失与空值 | PATCH、可空列 |
| `pick` / `omit` | 收窄对象字段 | 从基础 schema 派生 API |
| `partial` / `required` | 切换字段可选性 | PATCH 与完整对象 |
| `safeExtend` | 安全扩展对象 | 已有 refinement 的 schema |
| `union` / `discriminatedUnion` | 多种数据形状 | 条件输入、事件 |
| `refine` / `superRefine` | 业务与跨字段规则 | 日期顺序、条件必填 |
| `coerce` | 从 query/form 字符串转换 | 数字、日期 |
| `preprocess` | 校验前清洗原值 | 空字符串处理 |
| `transform` / `pipe` | 校验后转换并继续验证 | DTO → 领域/写入对象 |
| `parse` / `safeParse` | 执行校验 | 内部边界 / HTTP 边界 |
| `parseAsync` / `safeParseAsync` | 执行异步规则 | 异步 refinement |
| `z.infer` / `z.input` / `z.output` | 推导类型 | schema 为类型源 |
| `treeifyError` / `flattenError` | 格式化错误 | 嵌套表单 / 普通 API |
| `z.toJSONSchema` | 输出 JSON Schema | OpenAPI、LLM structured output |

# 附录 C：高频错误清单

1. 用 TypeScript `as` 假装运行时数据已验证。
2. 把 `$inferInsert` 直接当公开 API 请求类型。
3. 忘记 `await` 就解构 Drizzle 返回结果。
4. HTTP query 未转换，拿字符串和数字混用。
5. 把日期字符串直接传给要求 `Date` 的列。
6. 把空字符串转成 `undefined`，导致 PATCH 无法清空数据库字段。
7. UPDATE/DELETE 漏写 WHERE。
8. 只在 Zod 检查唯一性，没有数据库 UNIQUE。
9. 只声明 Drizzle relations，没有数据库外键。
10. 在循环里逐行查询，形成 N+1。
11. 用 `sql.raw(userInput)` 拼接不可信输入。
12. 在事务中调用慢速 LLM 或第三方 API。
13. 生成迁移后不阅读 SQL。
14. 给每个筛选字段都加索引，却不看真实查询和 EXPLAIN。
15. 相信 LLM 的 JSON 一定符合 schema，未做本地校验。

# 附录 D：建议学习节奏

如果每天学习 60～90 分钟：

- 第 1 周：第 1～5 课，每天运行代码并手写对应 SQL。
- 第 2 周：第 6～10 课，完成 CRUD 和错误处理。
- 第 3 周：第 11～13 课，练迁移、事务和 EXPLAIN。
- 第 4 周：第 14～15 课，完成 LLM 导入和结课项目。

每学完一课执行三件事：

1. 不看文档重新写出核心代码。
2. 为核心 Drizzle 查询写出近似 SQL。
3. 完成本课至少两道练习，并增加一个失败用例。

# 附录 E：官方资料与继续阅读

课程依据与推荐阅读顺序：

1. [Drizzle ORM Overview](https://orm.drizzle.team/docs/overview) — SQL-like 与 relational 两类查询思路。
2. [Drizzle + PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql) — `node-postgres` / `postgres.js` 连接方式。
3. [Drizzle Schema](https://orm.drizzle.team/docs/sql-schema-declaration) — TypeScript schema、列、组织方式与 SQL 映射。
4. [Drizzle Query Data](https://orm.drizzle.team/docs/data-querying) — SQL-like CRUD 与 relational queries。
5. [Drizzle Select](https://orm.drizzle.team/docs/select) — filters、排序、分页、子查询与聚合。
6. [Drizzle Transactions](https://orm.drizzle.team/docs/transactions) — 事务、嵌套事务、回滚和隔离配置。
7. [Drizzle Migrations](https://orm.drizzle.team/docs/migrations) — codebase-first、database-first 与 Kit 命令。
8. [Drizzle + Zod](https://orm.drizzle.team/docs/zod) — select/insert/update schema、refinement、factory 与 coercion。
9. [Zod Basic Usage](https://zod.dev/basics) — parse、safeParse、错误和类型推导。
10. [Zod Defining Schemas](https://zod.dev/api) — 对象、联合、refine、transform 等完整 API。
11. [Zod Formatting Errors](https://zod.dev/error-formatting) — treeify、flatten、prettify。
12. [Zod JSON Schema](https://zod.dev/json-schema) — 结构化输出、可转换与不可转换类型。
13. [Hono Validation](https://hono.dev/docs/guides/validation) — validation targets、Zod middleware 与 Content-Type 注意事项。
14. [PostgreSQL Data Manipulation](https://www.postgresql.org/docs/current/dml.html) — INSERT、UPDATE、DELETE 的数据库原理入口。
15. [PostgreSQL Queries](https://www.postgresql.org/docs/current/queries.html) — 查询处理的官方章节。
16. [PostgreSQL Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) — 查询计划、扫描节点、成本与行数。

## 最后的自测

如果你能不查答案解释下面 10 个问题，就已经具备独立项目的基础：

1. 为什么 TypeScript 类型不能校验 HTTP 请求？
2. `createInsertSchema` 为什么不应原样成为公开 API schema？
3. `undefined` 和 `null` 对 Drizzle UPDATE 有什么不同？
4. `returning()` 在 PostgreSQL 中解决什么问题？
5. 外键、relations 和 JOIN 各自是什么？
6. `generate + migrate` 与 `push` 有什么取舍？
7. 哪些一致性问题必须交给数据库约束或事务？
8. 如何从一个 Drizzle 查询推导出 SQL？
9. 为什么 structured output 之后仍要 `safeParse`？
10. 为什么给 LLM 的 schema 和数据库 insert schema 应是两个边界？
