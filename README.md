# Immersive 3D AI Studio Creation Platform
# 网页沉浸式虚拟AI公司创作平台

> 3D虚拟AI智能体工作室 · 在线C++编程实训平台
>
> **一句话简介**：一个打开网页就能"走进去"的 3D 虚拟 AI 工作室——你化身第一人称角色在低多边形办公室里自由漫游，创建最多 10 个 AI 员工团队，下发任务、观看他们实时思考、互相协作、自己走到办公桌前敲代码，全程浏览器开箱即用，无需安装、无需密钥。

---

## English Introduction

This project is a browser-native, tablet-first immersive 3D creation platform. Users enter a virtual studio as a first-person character, create customized AI agent teams, assign tasks, and observe intelligent agents working independently.

The platform supports up to 10 AI agents, each with an independent name, role and status logic. Agents stand by at their own workstations, walk to the target desk after receiving a task, stop automatically when encountering obstacles (no wall clipping), and return to their stations after completing work.

A built-in C++ coding lab provides an editor, a run button and a console output — offline by default, with optional online real compilation. The whole project runs purely on the web, no installation, no API key required, accessible on all devices.

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

### 3. 内置 C++ 编程实验室

- 独立编程面板：代码输入框 + 运行按钮 + 控制台输出窗口
- 默认**离线壳子模式**：本地结构检查（括号配对、main 函数、全角符号检测）+ 模拟运行，无需联网
- 可选"联网真实编译"：连接 Wandbox / Piston 在线编译器获得真实运行结果
- 编码专项 AI 智能体可读取、修改虚拟文件系统中的代码，"代码文件"面板实时查看修改记录

### 4. AI 三通道连接（保证一定能连上）

- **离线AI引擎（默认）**：内置规则引擎，无需联网、开箱即用
- **本地大模型 WebLLM**：浏览器内 WebGPU 推理（Qwen2.5 / Llama-3.2）
- **在线 API**：OpenAI 兼容接口（DeepSeek / 通义千问 / 智谱 / Kimi / OpenAI）
- 每种通道均可"测试连接"验证，异常自动回退离线引擎，演示不中断

---

## 技术栈

- **3D 渲染引擎**：Three.js（本地内置，importmap 引入，零构建）
- **运行载体**：全平台浏览器（Web 端）
- **开发语言**：原生 JavaScript ES Modules（12 个模块，全中文注释，分层清晰）
- **适配方案**：平板触屏优先，PC / 移动设备全兼容
- **项目架构**：模块化低耦合迭代开发

## 项目优势

- **零门槛**：无需下载安装，浏览器直接打开即可使用
- **高创新**：融合 3D 沉浸式交互 + AI 智能体团队协作 + 编程实训
- **强实用**：适配科创竞赛、AI 启蒙、C++ 信息学入门学习
- **高拓展**：模块化设计，支持持续迭代新功能与新场景

## 应用场景

青少年信息技术科创展示、AI 思维实训、趣味编程教学、个性化虚拟场景创作

---

## 版本迭代体系（V1 → V5）

| 版本 | 状态 | 内容 |
| --- | --- | --- |
| **V1** | ✅ 已完成 | 基础 3D 场景搭建、第一人称漫游与碰撞、AI 智能体核心交互（四状态 / 详情面板 / 流式日志）、**Agent 移动行为规则**（前往目标办公桌 / 遇障停止 / 完工返回工位）、C++ 编程实验室基础壳子、AI 三通道连接 |
| **V2** | 规划中 | 完整编程实验室落地、C++ 在线编译完善、编码 AI 辅助排查 BUG 增强 |
| **V3** | 规划中 | 可视化拖拽式 3D 场景编辑器，自定义搭建专属工作室 |
| **V4** | 规划中 | 社区串门系统、作品发布、点赞机制、热度排行榜 |
| **V5** | 规划中 | 全局性能优化、设备适配打磨、新手引导与全套项目文档 |

---

## 运行方式

1. **本地运行**：下载源码，直接打开 `index.html`（或 `python3 -m http.server` 后访问 localhost）
2. **在线预览**：支持 GitHub Pages / Gitee Pages 云端部署访问

## 操作说明

- **电脑**：`WASD`/方向键移动，鼠标转动视角（点击画面进入沉浸模式，`Esc` 释放），`Shift` 加速；点击 AI 小人查看详情；右侧面板选中员工后输入指令下发任务
- **平板**：左下角方向按钮移动，单指拖拽转视角；轻点 AI 小人查看详情

## 开源说明

本项目为个人原创开源创新项目，持续迭代优化，仅供学习交流使用，采用 MIT License。
