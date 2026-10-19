/**
 * logPanel.js — 右侧深色控制台（V1新增）
 * 职责：
 *  1) 展示 3 个 Agent 的状态卡片（名称/岗位/状态/当前任务）
 *  2) 流式输出每个 Agent 的思考内容（打字机光标）
 *  3) 展示 Agent 互相发送的消息记录（发送方 → 接收方）
 *  4) 日志分类过滤（全部/思考/消息/系统）、自动滚动、清屏
 */

const MAX_ENTRIES = 400; // DOM 日志条数上限，防止长跑内存膨胀

export class LogPanel {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.root #side-panel
   * @param {Map<string, object>} opts.agents AgentManager.agents
   * @param {(agentId:string)=>void} opts.onAgentCardClick 点击状态卡片
   */
  constructor({ root, agents, onAgentCardClick }) {
    this.root = root;
    this.agents = agents;
    this.onAgentCardClick = onAgentCardClick;

    this.statusList = root.querySelector('#agent-status-list');
    this.stream = root.querySelector('#log-stream');
    this.filters = root.querySelector('#log-filters');
    this.clearBtn = root.querySelector('#btn-clear-log');
    this.targetSel = root.querySelector('#chat-target');
    this.input = root.querySelector('#chat-input');
    this.sendBtn = root.querySelector('#chat-send');

    this.filter = 'all';
    this.streams = new Map(); // streamId -> {entryEl, textEl, full}
    this.autoScroll = true;

    this._bind();
    this.renderAgentCards();
    this.addSystem('工作室已就绪：3 个基础 Agent 已上线（规划 / 编码 / 创作）。');
    this.addSystem('提示：点击 3D 场景中的 AI 小人可查看详情；未加载本地模型时自动使用演示模式。');
  }

  _bind() {
    // 过滤切换
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
  }

  /* ================= Agent 状态卡片 ================= */
  renderAgentCards() {
    this.statusList.innerHTML = '';
    for (const agent of this.agents.values()) {
      const card = document.createElement('div');
      card.className = 'agent-card';
      card.dataset.agent = agent.id;
      card.innerHTML = `
        <div class="avatar" style="background:${agent.config.cssColor}">${agent.config.initial}</div>
        <div class="meta">
          <div class="name">${agent.config.name}</div>
          <div class="task" title="${agent.config.role}">${agent.config.role}</div>
        </div>
        <span class="state-chip state-idle"><i class="dot"></i>空闲</span>`;
      card.addEventListener('click', () => this.onAgentCardClick(agent.id));
      this.statusList.appendChild(card);
      agent._cardEl = card;
    }
  }

  /** 状态变化时刷新对应卡片（V1新增） */
  updateAgentCard(agent) {
    const chip = agent._cardEl?.querySelector('.state-chip');
    if (!chip) return;
    chip.className = `state-chip ${agent.stateCss}`;
    chip.innerHTML = `<i class="dot"></i>${agent.stateLabel}`;
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
  addState(agent, stateLabel) {
    this.addEntry({ agentId: agent.id, type: 'state', text: `进入「${stateLabel}」状态` });
  }
  addAction(agent, text) { this.addEntry({ agentId: agent.id, type: 'action', text }); }

  /** Agent 间消息（V1新增：互相发送的消息记录）
   * @param {string} from 发送方显示名
   * @param {string} to 接收方显示名
   * @param {string} text 内容
   * @param {string|null} fromId 发送方 Agent id（用于写入历史）
   * @param {string|null} toId 接收方 Agent id（用于写入历史）
   */
  addMessage(from, to, text, fromId = null, toId = null) {
    this.addEntry({
      type: 'message',
      from,
      to,
      text
    });
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
    this.streams.set(id, { el, textEl, cursor, full: '' });
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
  _agentName(agentId) { return this.agents.get(agentId)?.config.name ?? agentId; }

  _applyFilter() {
    for (const el of this.stream.children) this._applyFilterTo(el);
  }
  _applyFilterTo(el) {
    if (this.filter === 'all') { el.hidden = false; return; }
    // 思考过滤同时显示状态与动作（同一 Agent 的工作脉络）
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

  /* ================= 指令输入（主输入框） ================= */
  onSend(handler) {
    const fire = () => {
      const text = this.input.value.trim();
      if (!text) return;
      const target = this.targetSel.value;
      if (!target) {
        this.addSystem('请先在下方选择要指令的 Agent（或点击 3D 小人 / 状态卡片）。');
        return;
      }
      this.input.value = '';
      handler(target, text);
    };
    this.sendBtn.addEventListener('click', fire);
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') fire(); });
  }

  /** 选中某个 Agent 作为指令目标（供点击小人联动） */
  selectTarget(agentId) { this.targetSel.value = agentId; }
}
