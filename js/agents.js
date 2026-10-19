/**
 * agents.js — Agent 管理与行为核心
 * 包含：
 *  - 原有功能：3 个基础 Agent（规划 / 编码 / 创作）的可视化与协作
 *  - 原有功能：编码Agent 读取 / 修改虚拟文件系统中的代码
 *  - V1新增：4 种基础状态机（空闲 / 思考 / 执行任务 / 对话）与状态切换
 *  - V1新增：Agent 思考内容与互相发送的消息（经 LogPanel 流式输出）
 * 说明：V1 明确不开发 NavMesh 寻路 / AI 自动走路 / 工位移移动 / 聚集开会等逻辑，
 *       Agent 位置固定于各自工位，仅做肢体与状态动画。
 */
import { AGENTS, AgentState, StateMeta } from './config.js';
import * as THREE from 'three';
import { AgentAvatar } from './avatar.js';
import { vfs } from './vfs.js';

/** 各 Agent 的系统提示词（本地大模型 / 演示模式共用） */
const SYSTEM_PROMPTS = {
  planner:
`你是虚拟AI工作室的"规划Agent"，负责需求分析与任务拆解。
回答需简洁、结构化（可用编号列表）。当需要其他Agent落地实现时，
在回复末尾另起一行输出协作指令，格式严格为：[TO:coder] 或 [TO:artist] 或 [TO:planner]，后接具体指令。
不要输出与协作无关的方括号指令。`,
  coder:
`你是虚拟AI工作室的"编码Agent"，负责编写与修改代码，操作对象是虚拟文件系统（VFS）。
当被要求修改代码时：先说明读取了哪个文件，然后用一个 \`\`\`cpp 代码块输出该文件的【完整新内容】。
当被要求普通对话时正常回答，不要输出代码块。`,
  artist:
`你是虚拟AI工作室的"创作Agent"，负责文案、创意与内容设计。
回答需有创意、简洁，可适当使用列表。除非用户明确要求协作，否则不要输出 [TO:xxx] 指令。`
};

export class Agent {
  /**
   * @param {object} config AGENTS 中的一项
   * @param {object} deps { avatar, logPanel, manager }
   */
  constructor(config, { avatar, logPanel, manager }) {
    this.config = config;
    this.avatar = avatar;
    this.logPanel = logPanel;
    this.manager = manager;

    this.state = AgentState.IDLE;
    this.currentTask = '';
    this.history = [];      // 历史对话记录（用户↔Agent、Agent↔Agent）
    this.busy = false;      // 防止同一 Agent 并发处理
  }

  get id() { return this.config.id; }
  get stateLabel() { return StateMeta[this.state].label; }
  get stateCss() { return StateMeta[this.state].css; }

  /* ---------- V1新增：状态机 ---------- */
  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.avatar.setStateVisual(state);
    this.logPanel.updateAgentCard(this);
    this.logPanel.addState(this, this.stateLabel);
    // 状态对应的任务描述（展示在状态卡片与详情面板）
    if (state === AgentState.THINKING) this.currentTask = this._pendingTask || '正在思考…';
    else if (state === AgentState.EXECUTING) this.currentTask = this._pendingTask || '正在执行任务…';
    else if (state === AgentState.TALKING) this.currentTask = this._pendingTask || '对话中';
    else this.currentTask = '';
  }

  /* ---------- 历史记录 ---------- */
  pushHistory(rec) {
    this.history.push(rec);
    if (this.history.length > 100) this.history.shift();
  }
  getHistory() { return [...this.history].sort((a, b) => a.time - b.time); }

  /* ---------- 主流程：响应输入（用户指令 / 其他Agent消息） ---------- */
  /**
   * @param {string} text 输入内容
   * @param {object} opts { from:'user'|agentId, mode:'task'|'chat', depth }
   */
  async respond(text, { from = 'user', mode = 'task', depth = 0 } = {}) {
    if (this.busy) {
      this.logPanel.addSystem(`${this.config.name} 正忙，已忽略本次输入。`);
      return;
    }
    this.busy = true;
    try {
      // 1. 记录输入
      const rec = { from, to: this.id, text, time: Date.now() };
      this.pushHistory(rec);
      if (from === 'user') {
        this.logPanel.addMessage('你', this.config.name, text, 'user', this.id);
      }

      // 2. 进入思考 / 对话状态
      this._pendingTask = text.length > 40 ? text.slice(0, 40) + '…' : text;
      this.setState(mode === 'chat' ? AgentState.TALKING : AgentState.THINKING);

      // 3. 调用本地大模型（或演示模式），流式输出“思考内容”
      const messages = this._buildMessages(text, from);
      const streamId = this.logPanel.streamStart({ agentId: this.id, type: 'thought' });
      // 演示模式需要知道当前 Agent 身份
      this.manager.llm.demoResponder = () => this._demoReply(text, from);
      const reply = await this.manager.llm.chat(messages, (delta) => {
        this.logPanel.streamChunk(streamId, delta);
      });
      this.logPanel.streamEnd(streamId);

      // 4. 记录回复
      const replyRec = { from: this.id, to: 'user', text: reply, time: Date.now() };
      this.pushHistory(replyRec);
      if (mode === 'chat') this.avatar.showBubble(reply); // 对话状态显示气泡

      // 5. 解析回复中的协作与代码动作
      await this._processActions(reply, text, depth);

      // 6. 完成，回到空闲
      this.setState(AgentState.IDLE);
    } finally {
      this.busy = false;
      this._pendingTask = '';
    }
  }

  /** 构造发送给大模型的消息列表 */
  _buildMessages(text, from) {
    const msgs = [{ role: 'system', content: SYSTEM_PROMPTS[this.id] }];
    // 附带虚拟文件系统概况（编码Agent 需要知道有哪些文件可操作）
    if (this.id === 'coder') {
      const files = vfs.list().map((f) => `${f.name}（${f.content.split('\n').length}行，最近修改：${f.updatedBy}）`).join('；');
      msgs.push({ role: 'system', content: `虚拟文件系统当前文件：${files || '（空）'}` });
    }
    // 最近几轮对话作为上下文
    for (const h of this.getHistory().slice(-6)) {
      if (h.from === this.id) msgs.push({ role: 'assistant', content: h.text });
      else msgs.push({ role: 'user', content: (h.from === 'user' ? '用户' : this.manager.get(h.from)?.config.name || h.from) + '：' + h.text });
    }
    if (from === 'user') msgs.push({ role: 'user', content: text });
    else msgs.push({ role: 'user', content: `（来自 ${this.manager.get(from)?.config.name || from} 的协作消息）${text}` });
    return msgs;
  }

  /* ---------- 动作解析：协作指令 / 代码修改 ---------- */
  async _processActions(reply, originText, depth) {
    // a. 协作指令 [TO:xxx] ...
    const delegations = [...reply.matchAll(/\[TO:\s*(planner|coder|artist)\]\s*([^\n]+)/g)];
    for (const [, targetId, cmd] of delegations) {
      if (depth >= 3) { this.logPanel.addSystem('协作深度已达上限，停止继续转派。'); break; }
      this.manager.routeMessage(this, targetId, cmd.trim(), depth + 1);
    }
    // b. 代码块 → 编码Agent 写入虚拟文件系统
    const codeBlock = reply.match(/```(?:cpp|c\+\+)?\s*\n([\s\S]*?)```/);
    if (codeBlock && this.id === 'coder') {
      await this.executeCodeTask(codeBlock[1], originText);
    }
  }

  /**
   * 原有功能：编码Agent 读取并修改代码文件
   * @param {string} newContent 文件完整新内容
   * @param {string} instruction 触发指令
   */
  async executeCodeTask(newContent, instruction) {
    // 从指令中解析目标文件名，缺省 main.cpp
    const m = instruction.match(/([\w.-]+\.(?:cpp|h|hpp|md|txt))/);
    const fileName = m ? m[1] : 'main.cpp';

    this.setState(AgentState.EXECUTING);
    this._pendingTask = `修改 ${fileName}`;

    // 读取原文件（不存在则视为新建）
    let oldContent = '';
    try { oldContent = vfs.read(fileName); } catch { /* 新文件 */ }
    this.logPanel.addAction(this, `读取文件 ${fileName}（${oldContent ? oldContent.split('\n').length + ' 行' : '新文件'}）`);

    // 模拟执行耗时，让“执行任务”状态可见
    await new Promise((r) => setTimeout(r, 600));

    // 写入虚拟文件系统
    vfs.write(fileName, newContent.endsWith('\n') ? newContent : newContent + '\n', 'coder');

    const oldLines = oldContent ? oldContent.split('\n').length : 0;
    const newLines = newContent.split('\n').length;
    const diff = newLines - oldLines;
    this.logPanel.addAction(this, `已${oldContent ? '修改' : '新建'} ${fileName}（${diff >= 0 ? '+' : ''}${diff} 行，共 ${newLines} 行）`);
    this.avatar.showBubble(`已更新 ${fileName}`, 3200);
  }

  /* ---------- 演示模式回复（未加载本地大模型时的兜底） ---------- */
  _demoReply(text, from) {
    const t = text.toLowerCase();
    if (this.id === 'planner') {
      const needCode = /(实现|开发|做一|写个|写一个|功能|程序|代码|修改|上线)/.test(text);
      const plan =
`收到需求：「${text}」
我的拆解方案：
1. 明确目标与验收标准；
2. 划分模块：核心逻辑 → 数据结构 → 交互层；
3. 排期：设计 0.5 天 / 实现 1 天 / 联调 0.5 天；
4. 风险：本地模型加载耗时需提前预热。`;
      return needCode ? plan + '\n[TO:coder] 请按上述方案实现核心功能，并更新 main.cpp。' : plan;
    }
    if (this.id === 'coder') {
      // 真实执行一次“读取 + 修改”：基于关键词生成针对性代码改动
      const fileName = (text.match(/([\w.-]+\.(?:cpp|h|md|txt))/) || [])[1] || 'main.cpp';
      let oldContent = '';
      try { oldContent = vfs.read(fileName); } catch { /* 新文件 */ }
      const snippet = this._demoCodeSnippet(text, oldContent);
      return `已读取 ${fileName}（${oldContent ? oldContent.split('\n').length + ' 行' : '新文件'}），按需求修改如下：
\`\`\`cpp
${snippet}
\`\`\``;
    }
    // artist
    return `为「${text}」准备了三版创意方向：
1. 《把重复交给 Agent，把创造留给自己》——理性共鸣向；
2. 《三个 AI 打工人，一间不会熄灯的办公室》——故事向；
3. 《你的团队，24 小时在线》——效率向。
建议搭配低多边形办公室视觉，强化"沉浸式"体感。`;
  }

  /** 演示模式：生成一段针对需求的代码（基于原文件内容做真实追加修改） */
  _demoCodeSnippet(text, oldContent) {
    let fn = '';
    if (/排序|sort/i.test(text)) {
      fn =
`
// ===== 由编码Agent 追加：冒泡排序 =====
void bubbleSort(std::vector<int>& a) {
    for (size_t i = 0; i + 1 < a.size(); ++i)
        for (size_t j = 0; j + 1 < a.size() - i; ++j)
            if (a[j] > a[j + 1]) std::swap(a[j], a[j + 1]);
}
`;
    } else if (/斐波那契|fib/i.test(text)) {
      fn =
`
// ===== 由编码Agent 追加：斐波那契 =====
long long fib(int n) {
    if (n <= 1) return n;
    long long a = 0, b = 1;
    for (int i = 2; i <= n; ++i) { long long c = a + b; a = b; b = c; }
    return b;
}
`;
    } else {
      fn =
`
// ===== 由编码Agent 追加：工作室状态打印 =====
void printStudioStatus() {
    std::cout << "[studio] agents: planner/coder/artist all idle" << std::endl;
}
`;
    }
    // 在 main() 的 return 0; 前插入调用，实现“真实修改”
    let content = oldContent || '#include <iostream>\n\nint main() {\n    return 0;\n}\n';
    const call = fn.match(/(\w+)\s*\(/)?.[1];
    if (call) {
      content = content.replace(/\n(\s*)return 0;/, `\n$1    ${call}();\n$1return 0;`);
    }
    return content.replace(/\s+$/, '') + '\n' + fn;
  }
}

/* ============================================================ */

export class AgentManager {
  /**
   * @param {object} deps
   * @param {StudioScene} deps.studio 场景实例
   * @param {Map<string, Agent>} deps.agents Agent 集合（外部注入，供日志/详情面板共享）
   * @param {LogPanel} deps.logPanel 右侧日志面板
   * @param {LLMService} deps.llm 本地大模型服务
   * @param {PlayerController} deps.player 玩家控制器（定位视角用）
   * @param {(agentId:string)=>void} deps.onPick 点击 Agent 回调
   */
  constructor({ studio, agents, logPanel, llm, player, onPick }) {
    this.studio = studio;
    this.agents = agents || new Map();
    this.logPanel = logPanel;
    this.llm = llm;
    this.player = player;
    this.onPick = onPick;
    this.hovered = null;
  }

  /** 构建 3 个基础 Agent（原有功能） */
  build() {
    for (const cfg of AGENTS) {
      const avatar = new AgentAvatar(cfg);
      this.studio.scene.add(avatar.group);
      const agent = new Agent(cfg, { avatar, logPanel: this.logPanel, manager: this });
      this.agents.set(cfg.id, agent);
      // 注册射线拾取目标
      this.studio.raycastTargets.push(avatar.group);
    }
  }

  get(id) { return this.agents.get(id); }

  /** Agent 间消息路由（V1新增：互相发送的消息记录） */
  routeMessage(fromAgent, toId, text, depth = 0) {
    const to = this.agents.get(toId);
    if (!to) { this.logPanel.addSystem(`协作目标不存在：${toId}`); return; }
    this.logPanel.addMessage(fromAgent.config.name, to.config.name, text, fromAgent.id, to.id);
    // 接收方进入处理流程（转派来的消息按任务处理）
    to.respond(text, { from: fromAgent.id, mode: 'task', depth });
  }

  /* ---------- 射线拾取（点击 / 悬停 Agent） ---------- */
  pick(clientX, clientY) {
    // 注意：必须基于画布自身的矩形计算 NDC（画布宽度小于窗口宽度时，
    // 直接用窗口尺寸会导致偏离画布中心的 Agent 点击偏移）
    const rect = this.studio.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.studio.camera);
    const hits = raycaster.intersectObjects(this.studio.raycastTargets, true);
    for (const h of hits) {
      let o = h.object;
      while (o) {
        if (o.userData?.agentId && this.agents.has(o.userData.agentId)) return this.agents.get(o.userData.agentId);
        o = o.parent;
      }
    }
    return null;
  }

  /** 准星中心拾取（指针锁定沉浸模式） */
  pickCenter() {
    return this.pick(window.innerWidth / 2, window.innerHeight / 2);
  }

  /* ---------- 每帧更新 ---------- */
  update(dt, elapsed) {
    for (const agent of this.agents.values()) {
      agent.avatar.update(elapsed, agent.state);
    }
    // 悬停高亮：光环轻微放大
    if (this.hovered) {
      const ring = this.hovered.avatar.statusRing;
      ring.scale.lerp(new THREE.Vector3(1.18, 1.18, 1.18), 0.2);
    }
    for (const agent of this.agents.values()) {
      if (agent !== this.hovered) agent.avatar.statusRing.scale.lerp(new THREE.Vector3(1, 1, 1), 0.2);
    }
  }

  /** 定位视角：把玩家传送到 Agent 面前并面向他 */
  locate(agent) {
    const p = agent.avatar.group.position;
    const px = p.x, pz = p.z + 2.4;
    // 计算面向 Agent 的偏航角
    const dx = p.x - px, dz = p.z - pz;
    const yaw = Math.atan2(-dx, -dz);
    this.player.teleport(px, pz, yaw);
    this.logPanel.addSystem(`视角已定位到 ${agent.config.name} 的工位。`);
  }
}
