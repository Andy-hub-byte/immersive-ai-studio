/**
 * webllm.js — WebLLM 本地大模型服务（原有功能）
 * 能力：在浏览器内本地运行开源大模型（WebGPU 推理，无需服务端），
 *       流式输出对话内容；模型权重首次加载后由浏览器缓存。
 * 兜底：未加载模型或环境不支持时，使用“演示模式”回复器，
 *       保证平台其余功能（状态/日志/协作链路）可完整体验。
 */

/** WebLLM CDN 地址（依次尝试，任一可用即可） */
const WEBLLM_URLS = [
  'https://esm.run/@mlc-ai/web-llm',
  'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm'
];

export class LLMService {
  constructor() {
    this.engine = null;
    this.modelId = null;
    this.loading = false;
    /** 演示模式回复器：由 agents.js 注入，签名为 (messages, agent) => string */
    this.demoResponder = null;
  }

  /** 当前浏览器是否支持 WebGPU（WebLLM 推理依赖） */
  get webgpuSupported() {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  }

  get ready() { return !!this.engine; }

  /**
   * 加载模型（幂等；重复加载同一模型直接复用）
   * @param {string} modelId 模型 ID
   * @param {(p:number, text:string)=>void} onProgress 进度回调
   */
  async load(modelId, onProgress = () => {}) {
    if (this.engine && this.modelId === modelId) return;
    if (this.loading) throw new Error('模型正在加载中，请稍候…');
    if (!this.webgpuSupported) {
      throw new Error('当前浏览器不支持 WebGPU。请使用 Chrome 113+ / Edge 最新版；或先使用演示模式体验。');
    }
    this.loading = true;
    try {
      onProgress(0.02, '正在获取推理引擎…');
      let webllm = null;
      let lastErr = null;
      for (const url of WEBLLM_URLS) {
        try { webllm = await import(/* @vite-ignore */ url); break; } catch (e) { lastErr = e; }
      }
      if (!webllm) throw lastErr || new Error('无法加载 WebLLM 引擎（CDN 不可达）');

      onProgress(0.08, '正在初始化引擎…');
      this.engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (p) => onProgress(Math.max(0.08, p), `下载/初始化模型 ${Math.round(p * 100)}%`)
      });
      this.modelId = modelId;
      onProgress(1, '模型就绪');
    } finally {
      this.loading = false;
    }
  }

  /**
   * 流式对话
   * @param {Array<{role:string, content:string}>} messages
   * @param {(delta:string, full:string)=>void} onChunk 增量回调
   * @returns {Promise<string>} 完整回复
   */
  async chat(messages, onChunk = () => {}) {
    if (this.engine) {
      // ---- 真实本地大模型 ----
      const chunks = await this.engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.7
      });
      let full = '';
      for await (const chunk of chunks) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) { full += delta; onChunk(delta, full); }
      }
      return full;
    }
    // ---- 演示模式（模型未加载时的兜底）----
    if (!this.demoResponder) throw new Error('本地模型未加载，且演示模式不可用。');
    const text = this.demoResponder(messages);
    return streamText(text, onChunk);
  }
}

/** 把整段文本按小块“流式”输出（演示模式模拟流式效果） */
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
