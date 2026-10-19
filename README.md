# 虚拟AI工作室 · Immersive AI Studio

> **一句话简介**：一个打开网页就能"走进去"的 3D 虚拟 AI 工作室——你操控第一人称角色在低多边形办公室里自由漫游，与 3 个（最多 10 个）AI 员工对话、下发任务，观看他们实时思考、互相转派、修改代码，一切发生在浏览器里，无需安装任何东西。

---

## 一、项目创意来源

本项目的创意来自两个方向的结合：

1. **开源项目 [arturitu/the-delegation](https://github.com/arturitu/the-delegation)**：借鉴了它的页面布局（中间 3D 场景 + 右侧深色信息面板）、Agent 状态可视化与"点击查看详情"的交互风格。我们没有照搬它的任务看板与自动寻路，而是把它改造成了一个**可以亲自走进去的沉浸式版本**——玩家能在办公室里自由走路、走到任意员工身边对话。
2. **"让 AI 同事可见"的产品直觉**：平时我们和 AI 的交流只有一个聊天框。如果把 AI 变成办公室里一个个看得见、有岗位、有状态的"数字员工"，任务的下发、思考、协作、落地就变成了一场可以观看的"直播"，AI 的工作过程第一次变得透明、可感知。

美术上采用**简约低多边形风格**：全部物体由立方体、圆柱、球体等基础几何体搭建，柔和光照 + 软阴影 + 屏幕自发光 + 轻微雾化，没有炫酷赛博特效，保证低性能设备（平板）也能流畅运行。

---

## 二、当前版本（V1）已实现功能清单

### 1. 完整 3D 简约 AI 公司室内场景
- 地面、墙体、天花板、基础环境灯光（纯基础几何体搭建，无任何外部图片/模型）
- 7 个办公工位（电脑桌 + 显示器 + 座椅）+ 中央圆形会议区
- 简约人形 AI 员工：球体头部 + 胶囊躯干四肢（**不是方块**），头顶悬浮状态光环与状态珠
- 电脑屏幕淡淡自发光并缓慢刷新，全场景轻微雾化

### 2. 玩家自由移动系统
- 电脑：**WASD / 方向键**移动，**鼠标**控制视角（点击画面进入沉浸模式，Esc 释放），**Shift** 加速
- 平板：**触屏方向按钮**移动 + **单指拖拽**转动视角
- 完整碰撞检测：禁止穿墙、穿模（圆形玩家 vs 盒体/圆柱，分轴解算可沿墙滑动）

### 3. AI 智能体 Agent 基础系统
- 最多 **10 个**简约几何体人形 AI 员工，每个拥有**独立名称、岗位、任务状态**
- **性能约束：启动默认只加载 3 个 Agent**（规划/编码/创作），其余槽位由用户在右侧面板手动点击"添加"逐步解锁，避免一次性渲染 10 个小人导致平板卡顿；也可随时移除
- 点击选中 Agent 后，手动发布任务指令
- 头顶实时显示状态文字：**空闲 / 思考中 / 执行任务 / 对话中**（光环、状态珠、面板卡片三处同步变色）
- 点击 3D 中的员工弹出**深色详情面板**：名称、岗位、工位、当前状态、当前任务、历史对话记录

### 4. 基础侧边 UI 面板（页面右侧固定深色控制台）
- AI 员工列表：名称 / 岗位 / 状态徽标 / 当前任务，点击选中
- 添加员工表单：输入名称 + 岗位，点击"添加"（实时显示当前人数 x/10）
- 任务输入框 + 下发按钮：选中员工后输入指令，Enter 发送
- 任务反馈：**流式日志**实时输出每个员工的思考内容（打字机光标效果）、员工之间互相发送的消息（发送方 → 接收方）、状态与执行动作；支持 全部 / 思考 / 消息 / 系统 分类过滤、自动滚动、一键清屏

### 5. C++ 编程实验室
- 代码输入框（等宽字体编辑器）+ 运行按钮 + 控制台输出窗口
- 默认**离线壳子模式**：本地结构检查（括号配对、main 函数、全角符号检测等）+ 模拟运行，**无需联网**
- 可选勾选"联网真实编译"：连接 Wandbox / Piston 在线编译器获得真实运行结果
- 编码岗位员工读取、修改的代码保存在浏览器内存虚拟文件系统中，"代码文件"面板可实时查看（被 AI 改过的文件带角标）

### 6. AI 一定能连接上（三通道设计）
- **离线AI引擎（默认）**：内置规则引擎，无需联网、开箱即用——规划岗会输出拆解方案并转派给编码岗，编码岗会真实读取并修改虚拟文件
- **本地大模型 WebLLM**：浏览器内 WebGPU 推理（Qwen2.5 / Llama-3.2），首次需下载模型权重
- **在线 API**：OpenAI 兼容接口（DeepSeek / 通义千问 / 智谱 / Kimi / OpenAI），填写地址 + Key + 模型名即用
- 三种通道均可点击"**测试连接**"验证，任一通道异常自动回退离线引擎，平台功能不中断

---

## 三、操作使用说明

### 电脑（键盘 + 鼠标）
| 操作 | 按键 |
| --- | --- |
| 前后左右移动 | `W` `A` `S` `D` 或方向键 |
| 加速跑 | `Shift` |
| 转动视角 | 移动鼠标（先点击一下画面进入沉浸模式） |
| 释放鼠标 | `Esc` |
| 查看员工详情 | 鼠标点击 3D 场景中的 AI 小人 |
| 下发任务 | 右侧面板选中员工 → 输入指令 → Enter |

### 平板（触屏）
| 操作 | 方式 |
| --- | --- |
| 移动 | 左下角**方向按钮**（▲▼◀▶），按住即走 |
| 转动视角 | 在画面上**单指拖动** |
| 查看员工详情 | 手指轻点 AI 小人 |
| 下发任务 | 右侧面板：点员工卡片 → 输入指令 → 发送 |

### 快速上手（30 秒）
1. 打开网页，等待"正在构建低多边形工作室…"消失
2. 走到任意 AI 员工面前，点击他 → 弹出深色详情面板
3. 在详情面板点"发起对话"，或在右侧控制台选中该员工
4. 输入指令，例如：**"请规划并实现一个冒泡排序功能"**
5. 观看右侧日志：规划员工思考拆解 → 自动转派 `[TO:小码]` → 编码员工读取并修改 `main.cpp`
6. 打开"C++实验室"查看/运行代码；打开"代码文件"查看 AI 的修改记录

---

## 四、技术栈说明

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 3D 渲染 | **Three.js**（r166，本地内置） | WebGL 渲染器 + CSS2D 渲染器（头顶标签/气泡），importmap 引入，无需构建工具 |
| 语言 | 原生 **JavaScript ES Modules** | 零框架、零打包，`python3 -m http.server` 即可运行 |
| AI 推理 | WebLLM（WebGPU）/ OpenAI 兼容 API / 内置离线规则引擎 | 三通道自动降级 |
| C++ 编译 | Wandbox / Piston 在线 API（可选）+ 本地离线壳子（默认） | 默认不联网 |
| 数据 | 浏览器内存虚拟文件系统 | 不落盘、刷新即重置 |
| 兼容 | Chrome / Edge / Safari / 平板浏览器 | 模型轻量化（约 140 个低面数网格 + 1 盏投影灯） |

代码结构（全部中文注释，分层清晰，便于后续迭代）：

```
├── index.html            页面骨架（布局 + importmap）
├── css/
│   ├── main.css          全局深色科技风布局
│   └── panel.css         右侧控制台 / 浮动面板 / 详情弹窗样式
├── js/
│   ├── config.js         全局配置（状态枚举 / 槽位 / 配色 / 场景尺寸）
│   ├── scene.js          低多边形办公室场景（几何体搭建 / 光照 / 雾化 / 碰撞体）
│   ├── avatar.js         简约人形 AI 员工（几何体 + 状态光环 + CSS2D 标签）
│   ├── player.js         玩家漫游（WASD / 触屏 / 指针锁定 / 碰撞滑动）
│   ├── agents.js         Agent 管理（四状态机 / 任务执行 / 协作转派 / 射线拾取）
│   ├── logPanel.js       右侧流式日志控制台
│   ├── detailPanel.js    Agent 详情弹窗
│   ├── webllm.js         AI 三通道连接服务
│   ├── compiler.js       C++ 实验室（离线检查 / 联网编译）
│   ├── vfs.js            内存虚拟文件系统
│   ├── uiPanels.js       浮动功能面板控制器
│   └── main.js           入口：组装各模块 + 主循环
└── vendor/three/         Three.js 本地依赖
```

---

## 五、后续开发迭代规划（V1 → V5 路线图）

> 当前仅完成 **V1**，后续版本按策略逐代迭代，一代稳定后再开发下一代。

| 版本 | 主题 | 规划内容 |
| --- | --- | --- |
| **V1（当前）** | 沉浸式单机工作室 | 3D 场景、自由漫游、Agent 四状态、流式日志、详情弹窗、C++ 实验室、AI 三通道 |
| **V2** | 任务与协作深化 | 任务队列与优先级、Agent 间多轮协作、代码 Diff 可视化、日志检索与导出 |
| **V3** | 场景与表现增强 | 更多办公设施（茶水间 / 白板 / 机房）、昼夜环境变化、员工个性化配色与饰品 |
| **V4** | 多人联机 | Socket.io 房间机制、JSON 一次性下发场景、轻量化玩家坐标同步、访客参观模式 |
| **V5** | 开放与智能 | 自定义 Agent 岗位与技能、看板式任务大厅、语音交互、移动端 PWA |

---

## 六、项目亮点（科创亮点，用于答辩）

1. **沉浸式 AI 协作"可视化"**：把黑盒的 AI 调用过程变成办公室里可观看的实况——员工头顶光环随状态变色、思考内容流式打字、转派消息 `A → B` 清晰可追，AI 的"工作过程"第一次变得透明。
2. **零依赖开箱即用**：不打包、不构建、不联网，一个静态文件夹 + 任意 HTTP 服务即可运行；Three.js 已本地化，克隆仓库离线也能打开。
3. **AI 三通道"永续在线"设计**：离线规则引擎（默认）→ 本地 WebLLM 大模型 → 在线 API，逐级增强、异常自动降级，任何环境下"AI 一定能连接上"，现场演示不断电。
4. **平板优先的性能工程**：默认只渲染 3 个 Agent、按需手动添加（上限 10）；场景约 140 个低面数网格 + 单盏投影灯 + 日志 DOM 条数上限，保证平板浏览器流畅不崩溃。
5. **真实的"AI 改代码"闭环**：规划岗拆解需求 → 转派编码岗 → 读取虚拟文件 → 生成新代码 → 写入并显示修改，C++ 实验室可直接运行验证，形成"提需求 → 看过程 → 验结果"完整链路。
6. **干净的工程分层**：12 个 ES 模块按职责划分、全中文注释，V2~V5 的扩展点（槽位系统、消息路由、提供方抽象）已在 V1 预留。

---

## 七、开源协议

本项目采用 **MIT License** 开源。

- Three.js 采用 MIT License（© Three.js Authors）
- 页面布局与交互风格借鉴 [arturitu/the-delegation](https://github.com/arturitu/the-delegation)（MIT），美术与代码均为独立实现
- 可自由使用、修改、分发，保留版权声明即可

---

---

# Immersive AI Studio (English)

> **One-liner**: A 3D virtual AI studio you can literally walk into in your browser — roam a low-poly office in first person, chat with up to 10 AI employees, assign tasks, and watch them think, delegate to each other, and edit code in real time. No install, no build.

## 1. Where the Idea Comes From

- **[arturitu/the-delegation](https://github.com/arturitu/the-delegation)**: we borrowed its page layout (centered 3D scene + fixed dark side panel), agent-state visualization and click-for-details interaction — then rebuilt it as an *immersive* version where you personally walk around the office and talk to agents. We deliberately skipped its task kanban and auto-pathfinding, and kept the art minimal low-poly.
- **The product intuition**: chatting with AI in a text box hides *how* AI works. Turn AI into visible "digital employees" with roles, desks and live states, and task assignment / thinking / delegation becomes a watchable live show.

All geometry is built from primitives (boxes, cylinders, spheres) — soft lighting, soft shadows, faint screen glow, light fog. No cyberpunk neon, no external images or models.

## 2. What's Implemented in V1

- **Complete low-poly office**: floor, walls, ceiling, ambient lighting, 7 workstations (desk + monitor + chair), central round meeting area, humanoid agents (sphere head + capsule body, *not cubes*) with floating status ring/orb, faintly glowing screens, light fog.
- **Free movement**: WASD + mouse (pointer-lock immersion, Esc to release, Shift to run) on desktop; on-screen d-pad + one-finger drag on tablets. Full collision detection (no wall clipping, slide along walls).
- **Agent system**: up to 10 named agents with roles and live states; **only 3 load by default** (planner / coder / artist) to keep tablets smooth — add more manually up to 10, remove anytime. Head-up status text: Idle / Thinking / Executing / Talking.
- **Dark side console**: agent list with state chips and current task, add-employee form, task input, and a **streaming log** of thoughts (typewriter cursor), inter-agent messages (`A → B`), states and actions — with filters and auto-scroll.
- **Agent detail modal**: click any 3D agent for name, role, desk, live state, current task and chat history (dark themed, never a native browser dialog).
- **C++ lab**: code editor + run button + console output; offline shell mode by default (syntax checks + simulated run, no network); optional online real compilation (Wandbox / Piston); agents read/write an in-memory virtual file system.
- **AI that always connects**: three channels — built-in offline rule engine (default), local WebLLM (WebGPU), or any OpenAI-compatible API — each testable via a "Test Connection" button, with automatic fallback.

## 3. Controls

**Desktop**: `WASD`/arrows to move · mouse to look (click canvas to lock, `Esc` to release) · `Shift` to run · click an agent for details · select an agent in the side panel, type a task, press `Enter`.

**Tablet**: bottom-left d-pad to move · one-finger drag to look · tap an agent for details · side panel to send tasks.

**30-second demo**: open the page → click an agent → "发起对话" → send *"请规划并实现一个冒泡排序功能"* → watch the planner delegate `[TO:coder]`, the coder edit `main.cpp`, then open the C++ lab to run it.

## 4. Tech Stack

Three.js r166 (vendored locally, importmap, zero build), vanilla JavaScript ES Modules, WebLLM / OpenAI-compatible API / offline rule engine for AI, Wandbox / Piston for optional online C++ compilation, in-memory virtual file system. Runs from any static HTTP server; works offline.

## 5. Roadmap V1–V5

| Ver | Theme | Content |
| --- | --- | --- |
| V1 (now) | Immersive solo studio | Scene, roaming, 4 agent states, streaming log, detail modal, C++ lab, 3-channel AI |
| V2 | Tasks & collaboration | Task queue, multi-round delegation, code diff view, log search/export |
| V3 | Scene & visuals | More facilities (pantry/whiteboard/server room), day-night cycle, agent customization |
| V4 | Multiplayer | Socket.io rooms, one-shot JSON scene sync, lightweight player-coordinate sync, visitor mode |
| V5 | Open & smart | Custom agent skills, kanban task hall, voice interaction, PWA |

## 6. Highlights

1. **Visible AI collaboration** — status rings, typewriter thought streams and `A → B` delegation messages make the AI's working process transparent and watchable.
2. **Zero-dependency** — no build, no network, no install; vendored Three.js works offline.
3. **Always-on AI** — offline engine → local WebLLM → online API, auto-fallback, never breaks the demo.
4. **Tablet-first performance** — 3 agents by default (up to 10 manually), ~140 low-poly meshes, one shadow-casting light, capped log DOM.
5. **Real code loop** — requirement → plan → delegate → read file → write code → compile & run.
6. **Clean layering** — 12 commented ES modules with extension points reserved for V2–V5.

## 7. License

**MIT License**. Three.js is MIT (© Three.js Authors). Layout/interaction inspired by [the-delegation](https://github.com/arturitu/the-delegation) (MIT); art and code are independent implementations.
