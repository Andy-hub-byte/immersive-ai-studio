/**
 * agents.js — Agent 管理与行为核心（V1）
 * 包含：
 *  - 动态 Agent 系统：最多 10 个简约人形 AI 员工，自定义名称与岗位，
 *    占用场景中 10 个槽位之一；支持添加 / 删除 / 选中。
 *  - 4 种基础状态机：空闲 / 思考 / 执行任务 / 对话，头顶与面板实时展示。
 *  - 任务执行：选中 Agent → 下发任务指令 → 思考（流式）→ 执行（含代码修改）→ 空闲。
 *  - 多 Agent 协作：回复中的 [TO:名字] 指令会转派给对应 Agent，消息记入日志。
 *  - AI 连接：默认走 llm 服务的“离线本地引擎”；配置 WebLLM / 在线 API 后
 *    自动切换为真实大模型推理（见 llm.js）。
 * 说明：V1 不开发 NavMesh 寻路 / AI 自动走路 / 工位移动 / 聚集开会等逻辑，
 *       Agent 位置固定于各自槽位，仅做肢体与状态动画。
 */
import { AGENT_SLOTS, AGENT_COLORS, MAX_AGENTS, AgentState, StateMeta, AGENT_MOVE } from './config.js';
import * as THREE from 'three';
import { AgentAvatar } from './avatar.js';
import { vfs } from './vfs.js';

/** 依据岗位文本推断行为原型（用于离线引擎选择回复风格） */
function detectArchetype(role = '') {
  if (/编码|程序|开发|前端|后端|测试|工程|算法|码农|software|dev/i.test(role)) return 'coder';
  if (/规划|产品|经理|主管|策划|项目|运营|plan|pm/i.test(role)) return 'planner';
  if (/设计|创作|文案|美术|视觉|创意|UI|艺术|design|art/i.test(role)) return 'artist';
  return 'generic';
}

/** 各原型的系统提示词（真实大模型模式下使用） */
const SYSTEM_PROMPTS = {
  planner: '你是虚拟AI工作室的"规划"岗位员工，负责需求分析与任务拆解，回答结构化、简洁。需要他人落地实现时，在回复末尾另起一行输出 [TO:对方名字] 具体指令。',
  coder: '你是虚拟AI工作室的"编码"岗位员工，负责编写与修改代码，操作对象是虚拟文件系统。被要求修改代码时，先说明读取了哪个文件，然后用一个 ```cpp 代码块输出该文件的完整新内容。',
  artist: '你是虚拟AI工作室的"创作"岗位员工，负责文案、创意与内容设计，回答有创意、简洁。除非用户明确要求协作，不要输出 [TO:xxx] 指令。',
  generic: '你是虚拟AI工作室的一名 AI 员工，请根据岗位职责专业、简洁地完成任务。需要同事协作时，可输出 [TO:对方名字] 具体指令。'
};

let _idSeq = 0; // Agent 自增 ID

/** 角度插值（处理 -π/π 环绕，用于移动转向平滑） */
function _approachAngle(current, target, maxStep) {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

export class Agent {
  /**
   * @param {object} cfg { name, role, color, slot }
   * @param {object} deps { avatar, logPanel, manager }
   */
  constructor(cfg, { avatar, logPanel, manager }) {
    this.id = `agent_${++_idSeq}`;
    this.name = cfg.name;
    this.role = cfg.role;
    this.archetype = detectArchetype(cfg.role);
    this.slot = cfg.slot;                 // 占用的槽位（含坐标与标签）
    this.color = cfg.color;
    this.avatar = avatar;
    this.logPanel = logPanel;
    this.manager = manager;

    this.state = AgentState.IDLE;
    this.currentTask = '';
    this.history = [];      // 历史对话记录
    this.busy = false;      // 防止同一 Agent 并发处理
    this.slotIndex = cfg.slotIndex; // 占用的槽位索引

    // —— V1 行为规则：移动相关状态 ——
    this.moveTarget = null;   // 当前移动目标 {x, z}，null 表示未在移动
    this._moveResolve = null; // 移动完成Promise的resolve（由帧更新触发）
  }

  get stateLabel() { return StateMeta[this.state].label; }
  get stateCss() { return StateMeta[this.state].css; }

  /* ---------- 状态机 ---------- */
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

  /* ---------- 主流程：响应用户指令 / 其他Agent消息 ---------- */
  async respond(text, { from = 'user', mode = 'task', depth = 0 } = {}) {
    if (this.busy) {
      this.logPanel.addSystem(`${this.name} 正忙，已忽略本次输入。`);
      return;
    }
    this.busy = true;
    try {
      // 1. 记录输入
      this.pushHistory({ from, to: this.id, text, time: Date.now() });
      if (from === 'user') {
        this.logPanel.addMessage('你', this.name, text, 'user', this.id);
      }

      this._pendingTask = text.length > 40 ? text.slice(0, 40) + '…' : text;

      // 2.【V1行为规则】收到任务后移动到目标办公桌位置（移动中遇障自动停止，禁止穿墙）
      if (this._needMove()) {
        this.setState(AgentState.EXECUTING);
        this._pendingTask = `前往${this.slot.label}的目标位置`;
        const arrived = await this._moveTo(this.slot.work);
        if (!arrived) {
          this.logPanel.addAction(this, '移动途中碰到障碍物，已停止移动（禁止穿墙），在原地继续执行任务。');
        } else {
          this.logPanel.addAction(this, `已到达${this.slot.label}的目标办公桌位置。`);
        }
      }

      // 3. 进入思考 / 对话状态
      this.setState(mode === 'chat' ? AgentState.TALKING : AgentState.THINKING);

      // 4. 调用 AI（离线引擎 / WebLLM / 在线API），流式输出“思考内容”
      const messages = this._buildMessages(text, from);
      const streamId = this.logPanel.streamStart({ agentId: this.id, type: 'thought' });
      // 离线引擎需要知道当前 Agent（岗位原型）
      this.manager.llm.demoResponder = () => this._offlineReply(text, from);
      const reply = await this.manager.llm.chat(messages, (delta) => {
        this.logPanel.streamChunk(streamId, delta);
      });
      this.logPanel.streamEnd(streamId);

      // 5. 记录回复
      this.pushHistory({ from: this.id, to: 'user', text: reply, time: Date.now() });
      if (mode === 'chat') this.avatar.showBubble(reply); // 对话状态显示气泡

      // 6. 解析回复中的协作与代码动作
      await this._processActions(reply, text, depth);

      // 7.【V1行为规则】任务执行完毕，自动返回工位原地待命
      if (this._needMove()) {
        this._pendingTask = '任务完成，返回工位';
        const back = await this._moveTo(this.slot);
        if (back) this.logPanel.addAction(this, '已返回工位，原地待命。');
        else this.logPanel.addAction(this, '返回工位途中被障碍物阻挡，已停止移动。');
      }

      // 8. 完成，回到空闲
      this.setState(AgentState.IDLE);
    } finally {
      this.busy = false;
      this._pendingTask = '';
    }
  }

  /* ---------- V1行为规则：移动系统 ---------- */

  /** 该槽位是否配置了移动行为（工位待命点与目标办公桌位置不同才需要移动） */
  _needMove() {
    const w = this.slot.work;
    if (!w) return false;
    return Math.hypot(w.x - this.slot.x, w.z - this.slot.z) > AGENT_MOVE.arriveDist + 0.05;
  }

  /**
   * 移动到目标点（返回 Promise：true=到达 / false=途中受阻停止）
   * 移动推进由 AgentManager 每帧调用 _tickMove 完成
   */
  _moveTo(target) {
    const g = this.avatar.group.position;
    // 已在目标附近，直接完成
    if (Math.hypot(target.x - g.x, target.z - g.z) <= AGENT_MOVE.arriveDist) {
      this.moveTarget = null;
      return Promise.resolve(true);
    }
    this.moveTarget = { x: target.x, z: target.z };
    return new Promise((resolve) => { this._moveResolve = resolve; });
  }

  /** 每帧移动推进（由 AgentManager.update 调用）：直线移动 + 圆形碰撞检测 */
  _tickMove(dt) {
    if (!this.moveTarget || !this._moveResolve) return;
    const g = this.avatar.group.position;
    const dx = this.moveTarget.x - g.x;
    const dz = this.moveTarget.z - g.z;
    const dist = Math.hypot(dx, dz);

    // 到达目标点
    if (dist <= AGENT_MOVE.arriveDist) {
      this.moveTarget = null;
      const resolve = this._moveResolve;
      this._moveResolve = null;
      resolve(true);
      return;
    }

    // 计算下一步位置
    const step = AGENT_MOVE.speed * dt;
    const nx = g.x + (dx / dist) * step;
    const nz = g.z + (dz / dist) * step;

    // 移动途中碰到障碍物 → 立即停止（禁止穿墙）
    if (this.manager.collidesAt(nx, nz, AGENT_MOVE.radius)) {
      this.moveTarget = null;
      const resolve = this._moveResolve;
      this._moveResolve = null;
      resolve(false);
      return;
    }

    // 前进并平滑转向移动方向
    g.x = nx;
    g.z = nz;
    const targetYaw = Math.atan2(dx, dz);
    this.avatar.group.rotation.y = _approachAngle(this.avatar.group.rotation.y, targetYaw, dt * 8);
  }

  /** 构造发送给大模型的消息列表 */
  _buildMessages(text, from) {
    const msgs = [{ role: 'system', content: SYSTEM_PROMPTS[this.archetype] }];
    // 附带虚拟文件系统概况（编码岗位需要知道有哪些文件可操作）
    if (this.archetype === 'coder') {
      const files = vfs.list().map((f) => `${f.name}（${f.content.split('\n').length}行）`).join('；');
      msgs.push({ role: 'system', content: `虚拟文件系统当前文件：${files || '（空）'}` });
    }
    // 最近几轮对话作为上下文
    for (const h of this.getHistory().slice(-6)) {
      if (h.from === this.id) msgs.push({ role: 'assistant', content: h.text });
      else msgs.push({ role: 'user', content: (h.from === 'user' ? '用户' : this.manager.get(h.from)?.name || h.from) + '：' + h.text });
    }
    if (from === 'user') msgs.push({ role: 'user', content: text });
    else msgs.push({ role: 'user', content: `（来自 ${this.manager.get(from)?.name || from} 的协作消息）${text}` });
    return msgs;
  }

  /* ---------- 动作解析：协作指令 / 代码修改 ---------- */
  async _processActions(reply, originText, depth) {
    // a. 协作指令 [TO:名字] …
    const delegations = [...reply.matchAll(/\[TO:([^\]\n]+)\]/g)];
    for (const [, targetName] of delegations) {
      if (depth >= 3) { this.logPanel.addSystem('协作深度已达上限，停止继续转派。'); break; }
      const target = this.manager.findByName(targetName.trim());
      // 提取该指令后的内容（同指令行的剩余部分）
      const idx = reply.indexOf(`[TO:${targetName}]`);
      const cmd = reply.slice(idx + `[TO:${targetName}]`.length).split('\n')[0].trim();
      if (target && cmd) this.manager.routeMessage(this, target, cmd, depth + 1);
      else if (!target) this.logPanel.addSystem(`未找到名为「${targetName.trim()}」的同事，转派取消。`);
    }
    // b. 代码块 → 编码岗位员工写入虚拟文件系统
    const codeBlock = reply.match(/```(?:cpp|c\+\+)?\s*\n([\s\S]*?)```/);
    if (codeBlock && this.archetype === 'coder') {
      await this.executeCodeTask(codeBlock[1], originText);
    }
  }

  /**
   * 执行“代码修改”任务：读取虚拟文件 → 写入新内容 → 记录日志
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

    // 分步执行日志，让“执行任务”状态过程可见
    await new Promise((r) => setTimeout(r, 500));
    this.logPanel.addAction(this, `分析修改点并生成新版本…`);
    await new Promise((r) => setTimeout(r, 500));

    // 写入虚拟文件系统（纯内存）
    vfs.write(fileName, newContent.endsWith('\n') ? newContent : newContent + '\n', this.name);

    const oldLines = oldContent ? oldContent.split('\n').length : 0;
    const newLines = newContent.split('\n').length;
    const diff = newLines - oldLines;
    this.logPanel.addAction(this, `已${oldContent ? '修改' : '新建'} ${fileName}（${diff >= 0 ? '+' : ''}${diff} 行，共 ${newLines} 行）`);
    this.avatar.showBubble(`已更新 ${fileName}`, 3200);
  }

  /* ---------- 离线本地引擎回复（默认 AI，无需联网） ---------- */
  _offlineReply(text, from) {
    if (this.archetype === 'planner') {
      // 规划岗：输出拆解方案；涉及实现时转派给第一位编码岗同事
      const coder = this.manager.findByArchetype('coder');
      const needCode = /(实现|开发|做一|写个|写一个|功能|程序|代码|修改|上线|排序|计算)/.test(text);
      const plan =
`收到需求：「${text}」
我的拆解方案：
1. 明确目标与验收标准；
2. 划分模块：核心逻辑 → 数据结构 → 交互层；
3. 排期：设计 0.5 天 / 实现 1 天 / 联调 0.5 天；
4. 风险：本地资源与性能需提前验证。`;
      return (needCode && coder) ? plan + `\n[TO:${coder.name}] 请按上述方案实现核心功能，并更新 main.cpp。` : plan;
    }
    if (this.archetype === 'coder') {
      // 编码岗：真实执行一次“读取 + 修改”
      const fileName = (text.match(/([\w.-]+\.(?:cpp|h|md|txt))/) || [])[1] || 'main.cpp';
      let oldContent = '';
      try { oldContent = vfs.read(fileName); } catch { /* 新文件 */ }
      const snippet = this._offlineCodeSnippet(text, oldContent);
      return `已读取 ${fileName}（${oldContent ? oldContent.split('\n').length + ' 行' : '新文件'}），按需求修改如下：
\`\`\`cpp
${snippet}
\`\`\``;
    }
    if (this.archetype === 'artist') {
      return `为「${text}」准备了三版创意方向：
1. 《把重复交给 AI，把创造留给自己》——理性共鸣向；
2. 《一群不会下班的 AI 打工人》——故事向；
3. 《你的团队，24 小时在线》——效率向。
建议搭配低多边形办公室视觉，强化"沉浸式"体感。`;
    }
    // 通用岗
    return `（${this.role}）已接获任务：「${text}」
执行思路：
1. 明确交付物与验收标准；
2. 拆解为可并行的子任务；
3. 按时序推进并同步风险。
如需其他岗位协作，可在指令中 @对应同事。`;
  }

  /** 离线引擎：基于关键词生成针对性代码（对原文件做真实追加修改） */
  _offlineCodeSnippet(text, oldContent) {
    let fn = '';
    if (/排序|sort/i.test(text)) {
      fn =
`
// ===== 由 ${this.name} 追加：冒泡排序 =====
void bubbleSort(std::vector<int>& a) {
    for (size_t i = 0; i + 1 < a.size(); ++i)
        for (size_t j = 0; j + 1 < a.size() - i; ++j)
            if (a[j] > a[j + 1]) std::swap(a[j], a[j + 1]);
}
`;
    } else if (/斐波那契|fib/i.test(text)) {
      fn =
`
// ===== 由 ${this.name} 追加：斐波那契 =====
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
// ===== 由 ${this.name} 追加：工作室状态打印 =====
void printStudioStatus() {
    std::cout << "[studio] all agents online" << std::endl;
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

/* ============================================================
 * AgentManager：动态增删、选中、拾取、协作路由
 * ============================================================ */
export class AgentManager {
  /**
   * @param {object} deps
   * @param {StudioScene} deps.studio 场景实例
   * @param {Map<string, Agent>} deps.agents Agent 集合（外部注入共享）
   * @param {LogPanel} deps.logPanel 右侧日志面板
   * @param {LLMService} deps.llm AI 服务
   * @param {PlayerController} deps.player 玩家控制器（定位视角用）
   * @param {(agent:Agent)=>void} deps.onSelect 选中变化回调
   * @param {()=>void} deps.onAgentsChanged 增删回调（刷新 UI）
   */
  constructor({ studio, agents, logPanel, llm, player, onSelect, onAgentsChanged }) {
    this.studio = studio;
    this.agents = agents || new Map();
    this.logPanel = logPanel;
    this.llm = llm;
    this.player = player;
    this.onSelect = onSelect || (() => {});
    this.onAgentsChanged = onAgentsChanged || (() => {});
    this.hovered = null;
    this.selected = null;
    this._usedSlots = new Set(); // 已被占用的槽位索引
    this._tmpScale = new THREE.Vector3(); // 帧更新复用的临时向量
  }

  /** 添加 Agent（分配空闲槽位与配色）；达到上限返回 null */
  addAgent({ name, role }) {
    if (this.agents.size >= MAX_AGENTS) return null;
    // 名称查重
    if (this.findByName(name)) return null;
    // 找空闲槽位
    let slotIdx = -1;
    for (let i = 0; i < AGENT_SLOTS.length; i++) {
      if (!this._usedSlots.has(i)) { slotIdx = i; break; }
    }
    if (slotIdx < 0) return null;
    const slot = AGENT_SLOTS[slotIdx];
    const color = AGENT_COLORS[this.agents.size % AGENT_COLORS.length];

    const cfg = {
      id: `agent_${Date.now()}_${slotIdx}`,
      name: name.trim(),
      role: (role || 'AI员工').trim(),
      color,
      cssColor: '#' + color.toString(16).padStart(6, '0'),
      initial: name.trim().slice(0, 1),
      position: { x: slot.x, z: slot.z },
      facing: slot.yaw,
      slot,          // 槽位对象（含 label 工位名，供详情面板展示）
      slotIndex: slotIdx
    };
    const avatar = new AgentAvatar(cfg);
    this.studio.scene.add(avatar.group);
    this.studio.raycastTargets.push(avatar.group);

    const agent = new Agent(cfg, { avatar, logPanel: this.logPanel, manager: this });
    this.agents.set(agent.id, agent);
    this._usedSlots.add(slotIdx);

    this.logPanel.addSystem(`新员工「${agent.name}」（${agent.role}）入职，工位：${slot.label}。`);
    this.onAgentsChanged();
    return agent;
  }

  /** 删除 Agent（释放槽位与 3D 形象） */
  removeAgent(id) {
    const agent = this.agents.get(id);
    if (!agent) return;
    this.studio.scene.remove(agent.avatar.group);
    const i = this.studio.raycastTargets.indexOf(agent.avatar.group);
    if (i >= 0) this.studio.raycastTargets.splice(i, 1);
    this.agents.delete(id);
    this._usedSlots.delete(agent.slotIndex);
    if (this.selected === agent) this.select(null);
    if (this.hovered === agent) this.hovered = null;
    this.logPanel.addSystem(`员工「${agent.name}」已离职。`);
    this.onAgentsChanged();
  }

  _slotIndexOf(agent) {
    return AGENT_SLOTS.findIndex((s) => s.x === agent.slot.x && s.z === agent.slot.z);
  }

  get(id) { return this.agents.get(id); }

  /** 按名称查找 Agent（用于 [TO:名字] 转派） */
  findByName(name) {
    const n = name.trim();
    for (const a of this.agents.values()) if (a.name === n) return a;
    return null;
  }

  /** 按行为原型查找（如找第一位编码岗同事） */
  findByArchetype(type) {
    for (const a of this.agents.values()) if (a.archetype === type) return a;
    return null;
  }

  /** 选中 Agent（3D 高亮 + 面板联动） */
  select(agent) {
    if (this.selected === agent) return;
    if (this.selected) this.selected.avatar.setSelected(false);
    this.selected = agent || null;
    if (this.selected) this.selected.avatar.setSelected(true);
    this.onSelect(this.selected);
  }

  /** Agent 间消息路由（互相发送的消息记录） */
  routeMessage(fromAgent, toAgent, text, depth = 0) {
    this.logPanel.addMessage(fromAgent.name, toAgent.name, text, fromAgent.id, toAgent.id);
    // 接收方进入处理流程（转派来的消息按任务处理）
    toAgent.respond(text, { from: fromAgent.id, mode: 'task', depth });
  }

  /* ---------- 射线拾取（点击 / 悬停 Agent） ---------- */
  pick(clientX, clientY) {
    // 必须基于画布矩形计算 NDC（画布宽度小于窗口宽度）
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
  pickCenter() { return this.pick(window.innerWidth / 2, window.innerHeight / 2); }

  /* ---------- 每帧更新 ---------- */
  update(dt, elapsed) {
    for (const agent of this.agents.values()) {
      agent._tickMove(dt); // 推进移动（遇障自动停止）
      agent.avatar.update(elapsed, agent.state, !!agent.moveTarget);
      // 光环缩放目标：选中 1.35 > 悬停 1.18 > 常态 1.0（平滑过渡）
      let target = 1;
      if (agent === this.selected) target = 1.35;
      else if (agent === this.hovered) target = 1.18;
      this._tmpScale.setScalar(target);
      agent.avatar.statusRing.scale.lerp(this._tmpScale, 0.2);
    }
  }

  /**
   * 圆形碰撞检测（Agent 移动避障用，与玩家碰撞逻辑一致）
   * @param {number} x 目标点 X
   * @param {number} z 目标点 Z
   * @param {number} r 圆形半径
   * @returns {boolean} 是否与任意碰撞体相交
   */
  collidesAt(x, z, r) {
    for (const c of this.studio.colliders) {
      if (c.type === 'box') {
        // 圆 vs AABB：求最近点
        const cx = Math.max(c.minX, Math.min(x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz < r * r) return true;
      } else if (c.type === 'circle') {
        const dx = x - c.x, dz = z - c.z;
        const rr = r + c.r;
        if (dx * dx + dz * dz < rr * rr) return true;
      }
    }
    return false;
  }

  /** 定位视角：把玩家传送到 Agent 面前并面向他 */
  locate(agent) {
    const p = agent.avatar.group.position;
    const px = p.x, pz = p.z + 2.4;
    const dx = p.x - px, dz = p.z - pz;
    const yaw = Math.atan2(-dx, -dz);
    this.player.teleport(px, pz, yaw);
    this.logPanel.addSystem(`视角已定位到 ${agent.name} 的工位（${agent.slot.label}）。`);
  }
}
