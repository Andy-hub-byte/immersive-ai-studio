# Immersive 3D AI Studio Creation Platform
# 网页沉浸式虚拟AI公司创作平台

> 3D虚拟AI智能体工作室 · 在线C++编程实训平台
>
> **一句话简介**：一个打开网页就能"走进去"的 3D 虚拟 AI 工作室——你化身第一人称角色在低多边形办公室里自由漫游，创建最多 10 个 AI 员工团队，下发任务、观看他们实时思考、互相协作、自己走到办公桌前敲代码，全程浏览器开箱即用，无需安装、无需密钥。

---

## English Introduction

This project is a browser-native, tablet-first immersive 3D creation platform. Users enter a virtual studio as a first-person character, create customized AI agent teams, assign tasks, and observe intelligent agents working independently.

The platform supports up to 10 AI agents, each with an independent name, role and status logic. Agents stand by at their own workstations, walk to the target desk after receiving a task, stop automatically when encountering obstacles (no wall clipping), and return to their stations after completing work. Two dispatch modes are supported: **Broadcast** (all on-duty agents self-negotiate and claim only role-matching tasks) and **Private Chat** (the message reaches only the selected agent).

**Dual running modes:**

1. **Demo Mode (Default)**: Open and use instantly. Pre-set interaction logic, no model download, zero waiting.
2. **WebGPU Local Inference Mode (WebLLM)**: The lightweight Qwen3-1.7B model is downloaded into your browser. All reasoning runs locally on your device — no API key, no backend consumption, no extra software, offline available after caching.

An optional **Online API** (OpenAI-compatible) channel is also available for advanced users. A built-in C++ coding lab provides an editor, a run button and a console output — offline by default, with optional online real compilation.

**V2 features:** **Long-term memory** — every chat turn and agent reply is saved locally (localStorage) and the recent summary is auto-injected into the system prompt, so the AI keeps context across questions (viewable and clearable in the AI panel, two-click confirm). **PWA** — add to home screen for an app-like full-screen experience; the UI loads even on weak networks. **One-click launchers** — `启动.bat` (Windows) / `启动.sh` (macOS, Linux, Android Termux); Android users can simply use the GitHub Pages link. **Graceful WebGL degradation** — on devices without WebGL, the 3D scene hides itself while AI chat, memory, the C++ lab and file panel keep working.

**Model Info**: The agent uses Qwen3-1.7B for WebLLM browser-side local inference. This project **does NOT require WorkBuddy** — WorkBuddy is only a tool used by the developer for prompt testing.

---

## 项目简介

本项目是纯网页端、平板触屏优先适配的沉浸式 3D AI 创作沙盒平台。用户可化身第一人称虚拟角色进入 3D 工作室场景，创建多岗位 AI 智能体团队，下发工作任务并观察 AI 自主协作运行。

项目内置 C++ 编程实验室（代码编辑 + 运行 + 控制台输出 + 编码 AI 辅助改代码），兼顾 3D 创意创作、AI 逻辑启蒙、信息学编程练习三大功能，全程浏览器开箱即用，无需安装软件、无需配置密钥。

---

## 核心功能亮点

### 1. 沉浸式 3D 虚拟场景系统

- 完整室内工作室 3D 场景：地面、墙体、天花板、7 个办公工位（电脑桌 + 自发光显示器 + 座椅）+ 中央圆形会议区
- 第一人称自由行走、视角旋转、物理碰撞（禁止穿墙、穿模，可沿墙滑动）
- 电脑键鼠、平板触屏双适配（触屏方向按钮 + 拖拽转视角），移动端优先优化
- 纯前端 Web 3D 渲染，跨设备兼容，零部署成本

### 2. 智能 AI Agent 团队系统（核心创新）

- 全局最大支持 **10 个** AI 智能体同时在岗，每个 Agent 独立配备**名称、岗位、任务状态**
- **场景初始化默认仅加载 3 个智能体**，按需手动新增（最多至 10 个），不会一次性全部加载，兼顾性能与拓展性
- 四种实时状态：**空闲 / 思考中 / 执行任务 / 对话中**（头顶光环、3D 名称标签、右侧面板三处同步）
- 点击 3D 中的员工弹出深色详情面板：名称、岗位、工位、当前状态、当前任务、历史对话记录
- 多 Agent 协作：规划岗拆解需求后自动转派编码岗落地，全程流式日志可见

**Agent 行为规则：**

1. **绑定工位待命**：每个 Agent 绑定专属工位，无事时在自己工位原地待命（仅呼吸与状态动画，不离开工位）。
2. **任务移动闭环**：收到用户下发任务后，移动到目标办公桌位置执行；移动途中如果碰到障碍物就自动停下，禁止穿墙；任务执行完毕，自动回到自己的工位原地待命。
3. **数量与身份**：系统上限最多支持 10 个 Agent，场景初始化默认只加载 3 个，用户可手动新增至 10 个；每个 Agent 拥有独立名称、岗位、任务状态。
4. **两种指令下发模式**：**全体广播**（消息发送给所有在岗 Agent，各自协商认领匹配自身岗位的任务，不越权、不重复执行，其余留在工位待命）；**单独私聊**（侧边栏选中指定 Agent，消息仅送达该 Agent，其余员工保持待命）。执行中途可自由切换模式，忙碌 Agent 的新指令自动排队、不丢失。

### 3. 内置 C++ 编程实验室

- 独立编程面板：代码输入框 + 运行按钮 + 控制台输出窗口
- 默认**离线壳子模式**：本地结构检查（括号配对、main 函数、全角符号检测）+ 模拟运行，无需联网
- 可选"联网真实编译"：连接 Wandbox / Piston 在线编译器获得真实运行结果
- 编码专项 AI 智能体可读取、修改虚拟文件系统中的代码，"代码文件"面板实时查看修改记录

### 4. AI 双运行模式（演示 / 本地推理）

- **演示模式（默认）**：即时体验全部交互，无需下载模型——内置规则引擎模拟各岗位 Agent 的思考与协作，点开即用
- **WebLLM 本地推理模式**：加载 **Qwen3-1.7B** 轻量模型，AI 在你的设备本地运行，无费用、无密钥，首次需要下载模型文件（约 1.1GB），缓存后支持离线使用
- **在线 API（高级选项）**：OpenAI 兼容接口（DeepSeek / 通义千问 / 智谱 / Kimi / OpenAI），填写地址/密钥/模型名即用，保存后自动切换
- 每种模式均可"测试连接"验证；浏览器不支持 WebGPU 时会明确提示，并引导回退演示模式，体验不中断

---

## 技术栈

- **3D 渲染引擎**：Three.js（本地内置，importmap 引入，零构建）
- **运行载体**：全平台浏览器（Web 端）
- **开发语言**：原生 JavaScript ES Modules（12 个模块，全中文注释，分层清晰）
- **适配方案**：平板触屏优先，PC / 移动设备全兼容
- **项目架构**：模块化低耦合迭代开发

## 项目优势

- **零门槛**：无需下载安装，浏览器直接打开即可使用；默认演示模式无需下载任何模型
- **高创新**：融合 3D 沉浸式交互 + AI 智能体团队协作 + 编程实训
- **强实用**：适配科创竞赛、AI 启蒙、C++ 信息学入门学习
- **高拓展**：模块化设计，支持持续迭代新功能与新场景

## 应用场景

青少年信息技术科创展示、AI 思维实训、趣味编程教学、个性化虚拟场景创作

---

## 模型说明

智能体在 WebLLM 本地推理模式下使用 **Qwen3-1.7B**（MLC 量化权重，约 1.1GB）浏览器本地推理，可切换 Qwen3-4B（约 2.5GB）获得更强表现。
⚠️ 本项目**不强制依赖 WorkBuddy**，WorkBuddy 只是开发者调试提示词时使用的辅助工具，普通用户完全不需要。

## 注意事项

- WebLLM 模式需要 WebGPU 支持（Chrome / Edge 等新版浏览器）；首次加载模型建议在 WiFi 环境下进行
- WebGPU 性能取决于你的设备，平板 / 手机运行时会有轻微发热
- 直接双击 index.html 无法运行（ES Modules 需要 HTTP 服务）：Windows 双击 `启动.bat`，macOS/Linux/安卓 Termux 执行 `bash 启动.sh`，或直接使用在线入口
- 设备不支持 WebGL 时（老旧平板）3D 场景自动隐藏，AI 对话 / 记忆 / C++ 实验室仍可用（自动降级）
- 长期记忆保存在本机浏览器 localStorage，清除浏览器数据会一并清空

---

## 版本迭代体系（V1 → V5）

| 版本 | 状态 | 内容 |
| --- | --- | --- |
| **V1** | ✅ 已完成 | 基础 3D 场景搭建、第一人称漫游与碰撞、AI 智能体核心交互（四状态 / 详情面板 / 流式日志）、**Agent 移动行为规则**（前往目标办公桌 / 遇障停止 / 完工返回工位）、**两种指令下发模式**（全体广播认领 / 单独私聊 / 忙碌排队）、**AI 双运行模式**（演示模式默认 / WebLLM 本地推理，在线 API 高级选项）、C++ 编程实验室基础壳子 |
| **V2** | 🚧 进行中 | **AI 长期记忆**（对话持久化 + 上下文自动注入 + 可查可清）、**PWA 支持**（添加到主屏幕 / 弱网可用）、**一键启动脚本**（Windows .bat / macOS·Linux·安卓 .sh）、**WebGL 降级**（无 GPU 设备 AI 功能仍可用）、GitHub Pages 在线入口 |
| **V3** | 规划中 | 可视化拖拽式 3D 场景编辑器，自定义搭建专属工作室、摆放工位与 Agent |
| **V3** | 规划中 | 多人联机漫游：点对点 P2P 联机参观（WebRTC，轻量信令服务握手） |
| **V4** | 规划中 | 社区功能：发布工作室、参观他人作品、点赞、热度排行榜（需轻量存储服务） |
| **V5** | 规划中 | 全局性能优化、设备适配打磨、新手引导与全套项目文档 |

---

## 运行方式 / How to run

> ⚠️ 本项目基于 ES Modules，**请勿直接双击 index.html**（浏览器会拦截本地模块请求）。
> Do NOT double-click index.html — use one of the entries below.

### 方式一：在线入口（推荐，零安装）/ Online entry (recommended, zero install)

- **GitHub Pages**：https://andy-hub-byte.github.io/immersive-ai-studio/
- 手机 / 平板浏览器直接打开即可；安卓用户还可在浏览器菜单选择**「添加到主屏幕」**，
  之后像原生 App 一样全屏打开（PWA 已支持，弱网环境可离线打开界面）。
- Android tip: open the link, then "Add to home screen" for a full-screen app-like experience (PWA).

### 方式二：一键启动脚本（本地）/ One-click launchers (local)

| 平台 | 操作 | 说明 |
| --- | --- | --- |
| **Windows** | 双击 `启动.bat` | 自动起本地服务器并打开浏览器；自动检测 Python / Node.js，端口占用自动顺延 |
| **macOS / Linux** | 终端执行 `bash 启动.sh` | 同上；自动用 `open` / `xdg-open` 打开浏览器 |
| **安卓平板** | ① 直接用上面的在线入口（最省事）；② 或安装 Termux 后 `pkg install python`，进入目录执行 `bash 启动.sh` | 不装 Termux 就用在线入口，零安装 |

### 方式三：手动（开发者）/ Manual

```bash
cd 项目目录
python3 -m http.server 8000     # 或 npx http-server -p 8000
# 浏览器访问 http://localhost:8000/index.html
```

---

## V2 新功能：AI 长期记忆 / Long-term memory

工作室 AI 与场景 Agent **现在有记忆了**：

- **自动记录**：AI 面板的每轮问答、场景 Agent 的每次任务回复，都会写入本机记忆（localStorage，刷新/重启不丢失，最多保留 50 条）
- **上下文注入**：每次调用大模型前，自动把最近 6 条记忆摘要注入 system prompt——换一种问法也能对应上之前聊过的内容（WebLLM / 在线 API 通道生效；演示模式规则引擎会记录并展示，但不参与推理）
- **随时可查可清**：AI 连接面板头部显示「🧠 记忆：N 条」，点「清除记忆」**二次点击确认**后清空（防误触）
- **隐私**：记忆只保存在本机浏览器，不上传任何服务器

**WebGL 降级 / Graceful degradation**：老旧平板/无 GPU 环境创建不出 WebGL 上下文时，3D 场景自动隐藏并显示提示，AI 对话、长期记忆、C++ 实验室、文件面板仍可正常使用。

---

## 操作说明

- **电脑**：`WASD`/方向键移动，鼠标转动视角（点击画面进入沉浸模式，`Esc` 释放），`Shift` 加速；点击 AI 小人查看详情；右侧面板选中员工后输入指令，点「私聊发送」单独下发，或点「全体广播」让所有在岗 Agent 自主认领
- **平板**：左下角方向按钮移动，单指拖拽转视角；轻点 AI 小人查看详情；指令下发同上
- **AI 模式切换**：点击顶部「AI连接」芯片打开设置面板——⚡演示模式即开即用；🧠WebLLM 本地推理需首次下载模型（按提示连接 WiFi），加载期间可随时切回演示模式
- **记忆管理**：AI 面板头部「🧠 记忆：N 条」实时显示记忆数量；「清除记忆」需点击两次确认

## 开源说明

本项目为个人原创开源创新项目，持续迭代优化，仅供学习交流使用，采用 MIT License。
配套训练工作流 `smolagent-lora-lab`（用自己的数据微调本地 Agent）见：https://github.com/Andy-hub-byte/smolagent-lora-lab
