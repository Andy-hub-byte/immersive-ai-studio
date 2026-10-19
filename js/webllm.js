/**
 * llm.js — AI 模型连接服务（V1）
 * 三条通道，保证“AI 一定能连接上”：
 *  1) offline —— 离线本地引擎（默认）：内置规则引擎，无需联网、开箱即用；
 *  2) webllm  —— 本地 WebLLM 大模型：浏览器内 WebGPU 推理，首次需下载模型权重；
 *  3) api     —— 在线 API（OpenAI 兼容）：用户填写 BaseUrl + Key + 模型名即用。
 * 任意通道异常时自动回退到离线引擎，平台功能不受影响。
 */
import { LLM_PROVIDERS } from './config.js';

/** WebLLM CDN 地址（依次尝试，任一可用即可） */
const WEBLLM_URLS = [
  'https://esm.run/@mlc-ai/web-llm',
  'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm'
];

const LS_KEY = 'ai-studio-llm-settings-v1';

export class LLMService {
  constructor() {
    this.provider = LLM_PROVIDERS.OFFLINE; // 默认离线引擎（无需联网）
    this.engine = null;                    // WebLLM 引擎实例
    this.modelId = null;
    this.loading = false;
    this.api = { baseUrl: '', apiKey: '', model: '' }; // 在线 API 配置
    /** 状态变化回调（供 HUD 状态芯片刷新） */
    this.onStatus = () => {};
    /** 离线引擎回复器：由 Agent 注入，签名为 () => string */
    this.demoResponder = null;
    this._loadSettings();
  }

  /* ---------- 配置持久化（仅保存连接设置，不涉及场景/存档） ---------- */
  _loadSettings() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.provider) this.provider = s.provider;
        if (s.api) this.api = { ...this.api, ...s.api };
        if (s.modelId) this.modelId = s.modelId;
      }
    } catch { /* 忽略损坏的配置 */ }
  }
  _saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ provider: this.provider, api: this.api, modelId: this.modelId }));
    } catch { /* 存储不可用时静默 */ }
  }

  /** 当前浏览器是否支持 WebGPU（WebLLM 推理依赖） */
  get webgpuSupported() { return typeof navigator !== 'undefined' && !!navigator.gpu; }
  get ready() { return !!this.engine; }

  /** 人类可读的当前通道状态 */
  statusText() {
    if (this.provider === LLM_PROVIDERS.WEBLLM) return this.engine ? `本地模型就绪（${this.modelId}）` : '本地模型未加载';
    if (this.provider === LLM_PROVIDERS.API) return this.api.apiKey ? `在线API：${this.api.model}` : '在线API未配置';
    return '离线AI引擎（默认）';
  }

  /** 切换通道 */
  setProvider(p) {
    this.provider = p;
    this._saveSettings();
    this.onStatus();
  }

  /** 保存在线 API 配置 */
  saveApi({ baseUrl, apiKey, model }) {
    this.api = { baseUrl: (baseUrl || '').trim(), apiKey: (apiKey || '').trim(), model: (model || '').trim() };
    this._saveSettings();
    this.onStatus();
  }

  /* ---------- 通道二：WebLLM 本地大模型 ---------- */
  async loadWebLLM(modelId, onProgress = () => {}) {
    if (this.engine && this.modelId === modelId) return;
    if (this.loading) throw new Error('模型正在加载中，请稍候…');
    if (!this.webgpuSupported) {
      throw new Error('当前浏览器不支持 WebGPU。请使用 Chrome 113+ / Edge 最新版；或改用在线API / 离线引擎。');
    }
    this.loading = true;
    try {
      onProgress(0.02, '正在获取推理引擎…');
      let webllm = null, lastErr = null;
      for (const url of WEBLLM_URLS) {
        try { webllm = await import(/* @vite-ignore */ url); break; } catch (e) { lastErr = e; }
      }
      if (!webllm) throw lastErr || new Error('无法加载 WebLLM 引擎（CDN 不可达）');
      onProgress(0.08, '正在初始化引擎…');
      this.engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (p) => onProgress(Math.max(0.08, p), `下载/初始化模型 ${Math.round(p * 100)}%`)
      });
      this.modelId = modelId;
      this._saveSettings();
      onProgress(1, '模型就绪');
      this.onStatus();
    } finally {
      this.loading = false;
    }
  }

  /* ---------- 通道三：在线 API（OpenAI 兼容，流式） ---------- */
  async chatViaApi(messages, onChunk) {
    const { baseUrl, apiKey, model } = this.api;
    if (!baseUrl || !apiKey || !model) throw new Error('在线API未配置完整（需要地址、密钥、模型名）');
    const resp = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, stream: true, temperature: 0.7 })
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`API 返回 HTTP ${resp.status}：${t.slice(0, 160)}`);
    }
    // 解析 SSE 流
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = '', buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? ''; // 最后一行可能不完整，留给下一轮
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) { full += delta; onChunk(delta, full); }
        } catch { /* 忽略无法解析的行 */ }
      }
    }
    return full;
  }

  /* ---------- 统一对话入口（按当前通道分发，异常自动回退离线引擎） ---------- */
  async chat(messages, onChunk = () => {}) {
    try {
      if (this.provider === LLM_PROVIDERS.WEBLLM && this.engine) {
        const chunks = await this.engine.chat.completions.create({ messages, stream: true, temperature: 0.7 });
        let full = '';
        for await (const chunk of chunks) {
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (delta) { full += delta; onChunk(delta, full); }
        }
        return full;
      }
      if (this.provider === LLM_PROVIDERS.API) {
        return await this.chatViaApi(messages, onChunk);
      }
    } catch (e) {
      // 真实模型通道失败 → 回退离线引擎，保证功能不断
      this.onStatus();
      throw new Error(`${e?.message || e}（已可切换回离线引擎继续使用）`);
    }
    // 离线引擎
    if (!this.demoResponder) return '（离线引擎未就绪）';
    const text = this.demoResponder();
    return streamText(text, onChunk);
  }

  /* ---------- 连接测试 ---------- */
  /**
   * 测试当前通道能否连通
   * @returns {Promise<{ok:boolean, message:string, ms:number}>}
   */
  async testConnection() {
    const t0 = performance.now();
    const probe = [{ role: 'user', content: '请回复：连接成功' }];
    try {
      if (this.provider === LLM_PROVIDERS.API) {
        const r = await this.chatViaApi(probe, () => {});
        return { ok: true, message: `在线API连接成功，模型回复：${r.slice(0, 40)}`, ms: Math.round(performance.now() - t0) };
      }
      if (this.provider === LLM_PROVIDERS.WEBLLM) {
        if (!this.engine) return { ok: false, message: '本地模型尚未加载，请先点击"加载模型"', ms: 0 };
        const r = await this.chat(probe, () => {});
        return { ok: true, message: `本地模型连接成功，回复：${r.slice(0, 40)}`, ms: Math.round(performance.now() - t0) };
      }
      // 离线引擎
      const r = this.demoResponder ? this.demoResponder() : '';
      return { ok: true, message: `离线引擎工作正常（内置规则引擎，无需联网）`, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { ok: false, message: e?.message || String(e), ms: Math.round(performance.now() - t0) };
    }
  }
}

/** 把整段文本按小块“流式”输出（离线引擎模拟流式效果） */
export function streamText(text, onChunk, chunkSize = 2, interval = 16) {
  return new Promise((resolve) => {
    let i = 0;
    const timer = setInterval(() => {
      const delta = text.slice(i, i + chunkSize);
      if (!delta) { clearInterval(timer); resolve(text); return; }
      i += chunkSize;
      onChunk(delta, text.slice(0, i));
    }, interval);
  });
}

export const llm = new LLMService();
