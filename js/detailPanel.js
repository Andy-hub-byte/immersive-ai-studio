/**
 * detailPanel.js — Agent 详情弹窗（V1）
 * 交互：点击 3D 场景中的 AI 员工（或列表卡片“详情”按钮）弹出深色详情面板，
 *       展示名称、岗位、当前状态、当前任务、历史对话记录。
 * 规范：深色自绘弹窗，禁止浏览器原生白色弹窗（alert/confirm/prompt）。
 */

import { StateMeta } from './config.js';
import { t, pick } from './i18n.js';

export class DetailPanel {
  /**
   * @param {HTMLElement} root #detail-overlay
   * @param {Map<string, object>} agents Agent 集合（用于解析历史记录中的名称）
   */
  constructor(root, agents) {
    this.root = root;
    this.agents = agents;
    this.overlay = root;
    this.avatar = root.querySelector('#detail-avatar');
    this.nameEl = root.querySelector('#detail-name');
    this.roleEl = root.querySelector('#detail-role');
    this.slotEl = root.querySelector('#detail-slot');
    this.stateChip = root.querySelector('#detail-state-chip');
    this.taskEl = root.querySelector('#detail-task');
    this.historyEl = root.querySelector('#detail-history');
    this.closeBtn = root.querySelector('#detail-close');
    this.talkBtn = root.querySelector('#detail-talk');
    this.gotoBtn = root.querySelector('#detail-goto');

    this.agent = null;
    this.handlers = { talk: () => {}, locate: () => {} };

    this.closeBtn.addEventListener('click', () => this.close());
    // 点击遮罩空白处关闭
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    this.talkBtn.addEventListener('click', () => {
      this.handlers.talk(this.agent);
      this.close();
    });
    this.gotoBtn.addEventListener('click', () => this.handlers.locate(this.agent));
  }

  /** 注册回调 */
  on({ talk, locate } = {}) {
    if (talk) this.handlers.talk = talk;
    if (locate) this.handlers.locate = locate;
  }

  /** 打开详情面板 */
  open(agent) {
    this.agent = agent;
    this.avatar.style.background = agent.cssColor;
    this.avatar.textContent = agent.name.slice(0, 1);
    this.nameEl.textContent = agent.name;
    this.roleEl.textContent = agent.role;
    this.slotEl.textContent = t('detail.stationOf', { label: pick(agent.slot.label) });
    this.refresh();
    this.root.hidden = false;
  }

  /** 刷新动态内容（状态 / 任务 / 历史），面板打开期间周期性调用 */
  refresh() {
    const a = this.agent;
    if (!a) return;
    const meta = StateMeta[a.state] ?? StateMeta.idle;
    this.stateChip.className = `detail-state state-chip ${meta.css}`;
    this.stateChip.innerHTML = `<i class="dot"></i>${pick(meta.label)}`;
    this.taskEl.textContent = a.currentTask || t('detail.noTask');

    // 历史对话记录（用户 ↔ Agent、Agent ↔ Agent）
    const history = a.getHistory();
    if (history.length === 0) {
      this.historyEl.innerHTML = `<div class="history-empty">${t('detail.noHistory')}</div>`;
      return;
    }
    this.historyEl.innerHTML = '';
    for (const h of history) {
      const item = document.createElement('div');
      item.className = 'history-item';
      const fromName = h.from === 'user' ? t('you') : this._name(h.from);
      const toName = h.to === 'user' ? t('you') : this._name(h.to);
      const t = new Date(h.time);
      const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      item.innerHTML = `<div class="h-head"><span class="h-from">${fromName} → ${toName}</span><span>${hm}</span></div><div class="h-text"></div>`;
      item.querySelector('.h-text').textContent = h.text;
      this.historyEl.appendChild(item);
    }
    this.historyEl.scrollTop = this.historyEl.scrollHeight;
  }

  close() {
    this.root.hidden = true;
    this.agent = null;
  }

  get isOpen() { return !this.root.hidden; }

  _name(id) {
    return this.agents.get(id)?.name ?? id;
  }
}
