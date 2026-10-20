/**
 * logPanel.js — 右侧深色控制台（V1）
 * 职责：
 *  1) Agent 列表：动态展示所有 AI 员工（名称/岗位/状态/当前任务），
 *     支持点击选中、打开详情、删除；顶部提供“添加员工”表单（上限10个）。
 *  2) 流式日志：流式输出每个 Agent 的思考内容（打字机光标）、
 *     Agent 互相发送的消息记录（发送方 → 接收方）、状态与执行动作；
 *     支持 全部/思考/消息/系统 分类过滤、自动滚动、清屏。
 *  3) 指令输入：选择目标 Agent 后输入指令，Enter 私聊发送；
 *     或点击「全体广播」发送给所有在岗 Agent，由各 Agent 自主认领匹配岗位的任务。
 */

const MAX_ENTRIES = 400; // DOM 日志条数上限，防止长跑内存膨胀

export class LogPanel {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.root #side-panel
   * @param {Map<string, object>} opts.agents Agent 集合（动态）
   * @param {object} opts.handlers { onSelect, onDetail, onRemove, onAdd, onSend }
   */
  constructor({ root, agents, handlers }) {
    this.root = root;
    this.agents = agents;
    this.handlers = handlers;

    this.statusList = root.querySelector('#agent-status-list');
    this.addForm = root.querySelector('#agent-add-form');
    this.addName = root.querySelector('#agent-add-name');
    this.addRole = root.querySelector('#agent-add-role');
    this.addBtn = root.querySelector('#agent-add-btn');
    this.addHint = root.querySelector('#agent-add-hint');
    this.stream = root.querySelector('#log-stream');
    this.filters = root.querySelector('#log-filters');
    this.clearBtn = root.querySelector('#btn-clear-log');
    this.targetSel = root.querySelector('#chat-target');
    this.input = root.querySelector('#chat-input');
    this.sendBtn = root.querySelector('#chat-send');
    this.broadcastBtn = root.querySelector('#chat-broadcast');

    this.filter = 'all';
    this.streams = new Map(); // streamId -> {textEl, cursor, full}
    this.autoScroll = true;

    this._bind();
    this.renderAgentCards();
    this.addSystem('工作室已就绪。默认使用「离线AI引擎」，无需联网即可体验全部功能。');
    this.addSystem('点击 3D 场景中的 AI 员工或左侧列表可选中；选中后即可下发任务指令。');
  }

  _bind() {
    // 日志过滤切换
    this.filters.addEventListener('click', (e) => {
      const btn = e.target.closest('.log-filter');
      if (!btn) return;
      this.filters.querySelectorAll('.log-filter').forEach((b) => b.classList.toggle('active', b === btn));
      this.filter = btn.dataset.filter;
      this._applyFilter();
    });
    // 清屏
    this.clearBtn.addEventListener('click', () => this.clear());
    // 用户手动上滚时暂停自动滚动，滚回底部恢复
    this.stream.addEventListener('scroll', () => {
      const gap = this.stream.scrollHeight - this.stream.scrollTop - this.stream.clientHeight;
      this.autoScroll = gap < 40;
    });
    // 添加员工表单
    this.addBtn.addEventListener('click', () => this._submitAdd());
    this.addName.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._submitAdd(); });
    this.addRole.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._submitAdd(); });
    // 指令发送（私聊：仅送达选中的 Agent）
    const fire = () => {
      const text = this.input.value.trim();
      if (!text) return;
      const target = this.targetSel.value;
      if (!target) { this.addSystem('请先选中一个 Agent（点击 3D 员工 / 列表卡片），或使用「全体广播」。'); return; }
      this.input.value = '';
      this.handlers.onSend(target, text);
    };
    this.sendBtn.addEventListener('click', fire);
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') fire(); });

    // 全体广播（发送给场景内所有在岗 Agent，各自认领匹配岗位的任务）
    const fireBroadcast = () => {
      const text = this.input.value.trim();
      if (!text) { this.addSystem('请输入广播内容后再发送。'); return; }
      this.input.value = '';
      this.handlers.onBroadcast(text);
    };
    this.broadcastBtn.addEventListener('click', fireBroadcast);
  }

  _submitAdd() {
    const name = this.addName.value.trim();
    const role = this.addRole.value.trim() || 'AI员工';
    if (!name) { this.addSystem('请输入员工名称后再添加。'); return; }
    if (name.length > 8) { this.addSystem('名称请控制在 8 个字符以内。'); return; }
    const agent = this.handlers.onAdd(name, role);
    if (!agent) {
      this.addSystem(`添加失败：员工数量已达上限（10人），或名称「${name}」已存在。`);
      return;
    }
    this.addName.value = '';
    this.addRole.value = '';
    this.handlers.onSelect(agent); // 添加后自动选中，方便立刻下发任务
  }

  /* ================= Agent 列表卡片 ================= */
  renderAgentCards() {
    this.statusList.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'agent-empty';
    empty.textContent = '暂无员工，请在下方添加（最多10人）';
    this.statusList.appendChild(empty);
    for (const agent of this.agents.values()) {
      const card = document.createElement('div');
      card.className = 'agent-card';
      card.dataset.agent = agent.id;
      card.innerHTML = `
        <div class="avatar" style="background:${agent.cssColor}">${agent.name.slice(0, 1)}</div>
        <div class="meta">
          <div class="name">${agent.name}</div>
          <div class="task" title="${agent.role}">${agent.role}</div>
        </div>
        <span class="state-chip state-idle"><i class="dot"></i>空闲</span>
        <div class="card-actions">
          <button class="mini-btn" data-act="detail" title="查看详情">详情</button>
          <button class="mini-btn danger" data-act="remove" title="移除该员工">移除</button>
        </div>`;
      // 点击卡片主体 = 选中
      card.addEventListener('click', (e) => {
        if (e.target.closest('.mini-btn')) return; // 按钮不触发选中
        this.handlers.onSelect(agent);
      });
      // 详情 / 移除
      card.querySelector('[data-act="detail"]').addEventListener('click', () => this.handlers.onDetail(agent));
      card.querySelector('[data-act="remove"]').addEventListener('click', () => this.handlers.onRemove(agent));
      this.statusList.appendChild(card);
      agent._cardEl = card;
      // 隐藏“暂无员工”提示
      if (this.agents.size > 0) empty.hidden = true;
    }
    this._refreshAddState();
  }

  /** 增删后刷新（保留展开状态，由调用方触发） */
  refreshAgentCards() { this.renderAgentCards(); }

  /** 刷新添加按钮可用状态与提示 */
  _refreshAddState() {
    const full = this.agents.size >= 10;
    this.addBtn.disabled = full;
    this.addBtn.textContent = full ? '已满10人' : '添加';
    this.addHint.textContent = full ? '员工数量已达上限' : `当前 ${this.agents.size}/10 人`;
    // 同步列表头部人数统计
    const count = this.root.querySelector('#agent-count');
    if (count) count.textContent = `${this.agents.size}/10`;
  }

  /** 状态变化时刷新对应卡片 */
  updateAgentCard(agent) {
    const chip = agent._cardEl?.querySelector('.state-chip');
    if (!chip) return;
    chip.className = `state-chip ${agent.stateCss}`;
    chip.innerHTML = `<i class="dot"></i>${agent.stateLabel}`;
    // 当前任务展示在岗位行（tooltip 保留岗位）
    const taskEl = agent._cardEl?.querySelector('.task');
    if (taskEl) {
      taskEl.textContent = agent.currentTask ? `${agent.role} · ${agent.currentTask}` : agent.role;
      taskEl.title = agent.role;
    }
  }

  /* ================= 日志输出 ================= */
  _time() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  /** 添加一条完整日志 */
  addEntry({ agentId = null, type = 'system', text = '', from = null, to = null }) {
    const el = document.createElement('div');
    el.className = `log-entry type-${type}`;
    el.dataset.type = type;

    const typeName = { thought: '思考', message: '消息', system: '系统', state: '状态', action: '动作' }[type] || type;
    let head = `<span class="log-type">[${typeName}]</span>`;
    if (from && to) head += `<span class="log-agent">${from}</span><span class="log-arrow">→</span><span class="log-agent">${to}</span>`;
    else if (agentId) head += `<span class="log-agent">${this._agentName(agentId)}</span>`;

    el.innerHTML = `<div class="log-head">${head}<span class="log-time">${this._time()}</span></div><div class="log-text"></div>`;
    el.querySelector('.log-text').textContent = text;
    this.stream.appendChild(el);

    // 超出上限时移除最早的条目
    while (this.stream.children.length > MAX_ENTRIES) this.stream.removeChild(this.stream.firstChild);
    this._applyFilterTo(el);
    this._scrollToBottom();
    return el;
  }

  addSystem(text) { this.addEntry({ type: 'system', text }); }
  addState(agent, stateLabel) { this.addEntry({ agentId: agent.id, type: 'state', text: `进入「${stateLabel}」状态` }); }
  addAction(agent, text) { this.addEntry({ agentId: agent.id, type: 'action', text }); }

  /** Agent 间消息（互相发送的消息记录） */
  addMessage(from, to, text, fromId = null, toId = null) {
    this.addEntry({ type: 'message', from, to, text });
    // 同步写入双方的对话历史（详情面板展示用）
    if (fromId && toId) {
      const rec = { from: fromId, to: toId, text, time: Date.now() };
      this.agents.get(fromId)?.pushHistory(rec);
      this.agents.get(toId)?.pushHistory(rec);
    }
  }

  /** 开始一段流式输出（思考/回复），返回 streamId */
  streamStart({ agentId, type = 'thought', from = null, to = null }) {
    const el = this.addEntry({ agentId, type, text: '', from, to });
    const textEl = el.querySelector('.log-text');
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    textEl.appendChild(cursor);
    const id = Math.random().toString(36).slice(2);
    this.streams.set(id, { textEl, cursor, full: '' });
    return id;
  }

  /** 流式追加内容 */
  streamChunk(streamId, delta) {
    const s = this.streams.get(streamId);
    if (!s) return;
    s.full += delta;
    s.textEl.textContent = s.full;
    s.textEl.appendChild(s.cursor); // 光标保持在末尾
    this._scrollToBottom();
  }

  /** 结束流式输出 */
  streamEnd(streamId) {
    const s = this.streams.get(streamId);
    if (!s) return;
    s.cursor.remove();
    this.streams.delete(streamId);
  }

  /* ================= 过滤 / 滚动 ================= */
  _agentName(agentId) { return this.agents.get(agentId)?.name ?? agentId; }

  _applyFilter() {
    for (const el of this.stream.children) this._applyFilterTo(el);
  }
  _applyFilterTo(el) {
    if (this.filter === 'all') { el.hidden = false; return; }
    // 思考过滤同时显示状态与动作（同一员工的工作脉络）
    const map = { thought: ['thought', 'state', 'action'], message: ['message'], system: ['system'] };
    el.hidden = !map[this.filter].includes(el.dataset.type);
  }

  _scrollToBottom() {
    if (!this.autoScroll) return;
    this.stream.scrollTop = this.stream.scrollHeight;
  }

  clear() {
    this.streams.clear();
    this.stream.innerHTML = '';
    this.addSystem('日志已清空。');
  }

  /* ================= 指令目标联动 ================= */
  /** 选中某个 Agent 作为指令目标（供点击 3D / 卡片联动） */
  selectTarget(agentId) { this.targetSel.value = agentId; }

  /** 刷新指令下拉选项（增删 Agent 后调用） */
  refreshTargetOptions() {
    const cur = this.targetSel.value;
    this.targetSel.innerHTML = '<option value="">选择员工…</option>';
    for (const a of this.agents.values()) {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.name}（${a.role}）`;
      this.targetSel.appendChild(opt);
    }
    // 尽量保留原选择
    if (cur && this.agents.has(cur)) this.targetSel.value = cur;
    else this.targetSel.value = '';
  }
}
