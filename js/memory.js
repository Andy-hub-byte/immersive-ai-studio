/**
 * memory.js — AI 长期记忆模块（V2 新增 / V2 new）
 *
 * 让工作室 AI 与项目 Agent "记得"之前聊过什么：
 *  - 对话记录持久化到 localStorage（刷新页面、重启浏览器均不丢失）；
 *  - 每次调用大模型前，自动把最近的记忆摘要注入 system prompt（见 webllm.js）；
 *  - AI 连接面板实时显示记忆条数，支持一键清除（二次点击确认，防误触）。
 *
 * 设计原则：记忆只保存在本机浏览器，不经过任何服务器；用户可随时查看与清空。
 * Memory stays in the user's browser only — never uploaded, always clearable.
 */
import { llm } from './webllm.js';

const LS_KEY = 'ai-studio-memory-v1';
const MAX_RECORDS = 50;   // 最多保留条数（超出丢弃最旧，防止无限增长）
const MAX_TEXT = 300;     // 单条记录最大字符（超出截断，控制注入体积）

export class MemoryStore {
  constructor() {
    /** @type {{time:number, role:'user'|'ai'|'agent', name:string, text:string}[]} */
    this.records = [];
    /** 记忆变化回调（供 UI 芯片刷新）/ change listener for the UI chip */
    this.onChange = () => {};
    this._load();
  }

  /* ---------- 持久化（localStorage，静默容错） ---------- */
  _load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.records = arr.filter((r) => r && typeof r.text === 'string');
      }
    } catch { /* 存储不可用或数据损坏 → 从空白开始 */ }
  }
  _save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.records));
    } catch { /* 隐私模式等场景下存储被禁 → 内存中仍然有效 */ }
  }

  /** 当前记忆条数 / current record count */
  get count() { return this.records.length; }

  /**
   * 追加一条记忆。
   * @param {'user'|'ai'|'agent'} role 消息来源：用户 / AI面板 / 场景Agent
   * @param {string} text 内容（自动截断）
   * @param {string} [name] Agent 名字（role='agent' 时展示）
   */
  add(role, text, name = '') {
    const t = String(text ?? '').trim();
    if (!t) return;
    this.records.push({
      time: Date.now(),
      role,
      name: name || (role === 'user' ? '你' : role === 'agent' ? 'Agent' : 'AI'),
      text: t.length > MAX_TEXT ? t.slice(0, MAX_TEXT) + '…' : t
    });
    if (this.records.length > MAX_RECORDS) this.records.splice(0, this.records.length - MAX_RECORDS);
    this._save();
    this.onChange();
  }

  /** 便捷方法：记录一轮"用户问 → AI答" / record one user→AI turn */
  addTurn(userText, aiText, name = '') {
    this.add('user', userText);
    this.add(name ? 'agent' : 'ai', aiText, name);
  }

  /**
   * 生成可注入 system prompt 的记忆摘要（中英双语）。
   * @param {number} n 取最近 n 条
   * @returns {string} 无记忆时返回空串
   */
  summary(n = 6) {
    const recs = this.records.slice(-n);
    if (!recs.length) return '';
    const lines = recs.map((r) => {
      const t = new Date(r.time);
      const hh = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      return `- [${hh}] ${r.name}: ${r.text.replace(/\s+/g, ' ').slice(0, 120)}`;
    });
    return [
      '【历史记忆 / Memory】以下是本机浏览器中保存的近期对话（供你保持上下文连贯，' +
      '即使用户换了一种问法也能对应上；没有相关信息时忽略即可）：',
      ...lines
    ].join('\n');
  }

  /** 清空全部记忆 / clear all memory */
  clear() {
    this.records = [];
    this._save();
    this.onChange();
  }
}

/** 全站单例 / app-wide singleton */
export const memory = new MemoryStore();

/**
 * 把记忆摘要注入消息列表（不改原数组）。
 * 策略：若首条是 system 消息则附加到其末尾（避免多 system 消息的兼容性问题），
 * 否则在头部插入一条 system。无记忆时原样返回。
 * Inject the memory summary into a message list (non-mutating).
 */
export function withMemory(messages) {
  const s = memory.summary();
  if (!s || !Array.isArray(messages) || !messages.length) return messages;
  const out = messages.slice();
  if (out[0] && out[0].role === 'system') {
    out[0] = { ...out[0], content: `${out[0].content}\n\n${s}` };
  } else {
    out.unshift({ role: 'system', content: s });
  }
  return out;
}

/** 记忆芯片的人类可读状态 / human-readable chip label */
export function memoryChipText() {
  const n = memory.count;
  return n === 0 ? '🧠 记忆：空' : `🧠 记忆：${n} 条`;
}

export { LS_KEY as MEMORY_LS_KEY };
