/**
 * uiPanels.js — 浮动功能面板控制器
 * 包含三个基础功能面板：
 *  1) AI 连接面板：离线引擎（默认）/ WebLLM 本地大模型 / 在线API 三通道，
 *     支持保存配置与"测试连接"，保证 AI 一定能连接上；
 *  2) C++ 编程实验室：代码输入 + 运行 + 控制台输出（默认离线壳子，可勾选联网真实编译）；
 *  3) 代码文件面板（虚拟文件系统，编码Agent的修改会实时同步）。
 */
import { runCpp } from './compiler.js';
import { vfs } from './vfs.js';
import { llm } from './webllm.js';
import { LLM_PROVIDERS, API_PRESETS } from './config.js';

/** 浮动面板容器管理：一次只打开一个面板 */
class FloatPanelHost {
  constructor(root) {
    this.root = root; // #floating-panels
    this.panels = {
      chat: root.querySelector('#panel-chat'),
      code: root.querySelector('#panel-code'),
      files: root.querySelector('#panel-files')
    };
    // 关闭按钮
    for (const p of Object.values(this.panels)) {
      p.querySelector('.panel-close').addEventListener('click', () => this.hide(p));
    }
  }
  show(key) {
    const target = this.panels[key];
    const wasHidden = target.hidden;
    // 互斥显示
    for (const p of Object.values(this.panels)) p.hidden = p !== target;
    this.root.hidden = false;
    return wasHidden; // 返回“此前是否隐藏”（用于按钮切换逻辑）
  }
  hide(panel) {
    panel.hidden = true;
    if (Object.values(this.panels).every((p) => p.hidden)) this.root.hidden = true;
  }
}

/* =--------------- AI 连接面板（三通道） --------------- */
export class ChatPanel {
  constructor(host) {
    this.panel = host.panels.chat;
    this.messages = this.panel.querySelector('#chat-messages');
    this.input = this.panel.querySelector('#chat-llm-input');
    this.sendBtn = this.panel.querySelector('#chat-llm-send');

    // 通道切换单选
    this.radios = [...this.panel.querySelectorAll('input[name="ai-provider"]')];
    // WebLLM 模型加载
    this.loadBtn = this.panel.querySelector('#btn-load-model');
    this.modelSelect = this.panel.querySelector('#model-select');
    this.progress = this.panel.querySelector('#model-progress');
    this.progressBar = this.panel.querySelector('#model-progress-bar');
    // 在线 API 配置
    this.apiBox = this.panel.querySelector('#api-config');
    this.apiPreset = this.panel.querySelector('#api-preset');
    this.apiBase = this.panel.querySelector('#api-base');
    this.apiKey = this.panel.querySelector('#api-key');
    this.apiModel = this.panel.querySelector('#api-model');
    this.saveApiBtn = this.panel.querySelector('#btn-save-api');
    this.testApiBtn = this.panel.querySelector('#btn-test-api');

    this._bind();
    this._syncProviderUI();
  }

  _bind() {
    // 通道切换
    this.radios.forEach((r) => r.addEventListener('change', () => {
      if (!r.checked) return;
      llm.setProvider(r.value);
      this._syncProviderUI();
      this.addMsg('ai', `已切换 AI 通道：${llm.statusText()}`);
    }));
    // WebLLM 加载
    this.loadBtn.addEventListener('click', () => this.loadModel());
    // API 预设填充
    this.apiPreset.addEventListener('change', () => {
      const p = API_PRESETS.find((x) => x.name === this.apiPreset.value);
      if (p && p.baseUrl) {
        this.apiBase.value = p.baseUrl;
        this.apiModel.value = p.model;
      }
    });
    // 保存 / 测试连接
    this.saveApiBtn.addEventListener('click', () => this.saveApi());
    this.testApiBtn.addEventListener('click', () => this.testConnection());
    // 直接对话
    this.sendBtn.addEventListener('click', () => this.send());
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.send(); });
  }

  /** 按当前通道显示/隐藏对应配置区 */
  _syncProviderUI() {
    const p = llm.provider;
    this.radios.forEach((r) => { r.checked = r.value === p; });
    this.panel.querySelector('#webllm-bar').hidden = p !== LLM_PROVIDERS.WEBLLM;
    this.apiBox.hidden = p !== LLM_PROVIDERS.API;
    // 回显已保存的 API 配置
    if (p === LLM_PROVIDERS.API) {
      this.apiBase.value = llm.api.baseUrl;
      this.apiKey.value = llm.api.apiKey;
      this.apiModel.value = llm.api.model;
    }
  }

  addMsg(role, text) {
    const el = document.createElement('div');
    el.className = `chat-msg ${role}`;
    if (role === 'ai') {
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = llm.statusText();
      el.appendChild(who);
    }
    const body = document.createElement('span');
    body.textContent = text;
    el.appendChild(body);
    this.messages.appendChild(el);
    this.messages.scrollTop = this.messages.scrollHeight;
    return body;
  }

  async send() {
    const text = this.input.value.trim();
    if (!text) return;
    this.addMsg('user', text);
    this.input.value = '';

    if (llm.provider === LLM_PROVIDERS.WEBLLM && !llm.ready) {
      this.addMsg('ai', '本地模型尚未加载。请点击「加载模型」下载并启动（需要支持 WebGPU 的浏览器，如 Chrome 113+）。未加载时 Agent 会自动使用离线AI引擎。');
      return;
    }
    const body = this.addMsg('ai', '…');
    try {
      await llm.chat(
        [
          { role: 'system', content: '你是虚拟AI工作室搭载的 AI 助手，回答简洁、友好，使用中文。' },
          { role: 'user', content: text }
        ],
        (_delta, full) => { body.textContent = full; this.messages.scrollTop = this.messages.scrollHeight; }
      );
    } catch (e) {
      body.textContent = '调用失败：' + (e?.message || e) + '。请检查配置或切换回离线AI引擎。';
    }
  }

  async loadModel() {
    const model = this.modelSelect.value;
    this.loadBtn.disabled = true;
    this.progress.hidden = false;
    this.progressBar.style.width = '0%';
    try {
      await llm.loadWebLLM(model, (p, text) => {
        this.progressBar.style.width = Math.round(p * 100) + '%';
        this.loadBtn.textContent = text;
      });
      this.addMsg('ai', `模型 ${model} 已就绪，工作室 Agent 将自动改用它推理。`);
    } catch (e) {
      this.addMsg('ai', '加载失败：' + (e?.message || e) + '。可继续使用离线AI引擎体验平台功能。');
    } finally {
      this.loadBtn.disabled = false;
      this.loadBtn.textContent = '加载模型';
      setTimeout(() => { this.progress.hidden = true; }, 900);
    }
  }

  /** 保存在线 API 配置（仅存本机浏览器 localStorage，不涉及场景存档） */
  saveApi() {
    llm.saveApi({
      baseUrl: this.apiBase.value,
      apiKey: this.apiKey.value,
      model: this.apiModel.value
    });
    this.addMsg('ai', llm.api.apiKey
      ? `在线 API 配置已保存：${llm.api.model}。可点击「测试连接」验证。`
      : '配置已保存，但 API Key 为空，请填写后再测试。');
  }

  /** 测试当前 AI 通道连接 */
  async testConnection() {
    this.testApiBtn.disabled = true;
    this.testApiBtn.textContent = '测试中…';
    try {
      const r = await llm.testConnection();
      this.addMsg('ai', `${r.ok ? '✓' : '✗'} ${r.message}（耗时 ${r.ms}ms）`);
    } finally {
      this.testApiBtn.disabled = false;
      this.testApiBtn.textContent = '测试连接';
    }
  }
}

/* =--------------- C++ 编程实验室 --------------- */
export class CodePanel {
  constructor(host) {
    this.panel = host.panels.code;
    this.editor = this.panel.querySelector('#cpp-editor');
    this.output = this.panel.querySelector('#cpp-output');
    this.runBtn = this.panel.querySelector('#btn-run-cpp');
    this.saveBtn = this.panel.querySelector('#btn-save-cpp');
    this.onlineChk = this.panel.querySelector('#cpp-online');

    // 默认加载虚拟文件系统中的 main.cpp
    this.loadFromVfs('main.cpp');
    this.runBtn.addEventListener('click', () => this.run());
    this.saveBtn.addEventListener('click', () => this.save());
  }

  loadFromVfs(name) {
    try { this.editor.value = vfs.read(name); this.currentFile = name; } catch { /* 忽略 */ }
  }

  async run() {
    const code = this.editor.value;
    this.output.textContent = this.onlineChk.checked ? '正在连接在线编译器…' : '本地检查并模拟运行中…';
    this.output.className = 'cpp-output';
    // 默认离线壳子；勾选后才联网真实编译（满足单机不联网硬约束）
    const res = await runCpp(code, { online: this.onlineChk.checked });
    this.output.textContent = res.output;
    this.output.className = `cpp-output ${res.ok ? 'ok' : 'err'}`;
  }

  save() {
    const name = this.currentFile || 'main.cpp';
    vfs.write(name, this.editor.value, 'user');
    this.output.textContent = `已保存到虚拟文件系统：${name}`;
    this.output.className = 'cpp-output ok';
  }
}

/* =--------------- 代码文件面板 --------------- */
export class FilesPanel {
  constructor(host) {
    this.panel = host.panels.files;
    this.tree = this.panel.querySelector('#file-tree');
    this.meta = this.panel.querySelector('#file-meta');
    this.content = this.panel.querySelector('#file-content');
    this.current = null;

    this.render();
    // 订阅虚拟文件系统变更（编码Agent 修改后实时刷新）
    vfs.subscribe(() => this.render());
  }

  render() {
    const files = vfs.list();
    this.tree.innerHTML = '';
    for (const f of files) {
      const li = document.createElement('li');
      li.textContent = f.name;
      // 被 Agent 修改过的文件显示琥珀色角标
      if (f.updatedBy !== 'system' && f.updatedBy !== 'user') {
        const b = document.createElement('span');
        b.className = 'badge';
        b.title = `${f.updatedBy} 修改过`;
        li.appendChild(b);
      }
      if (this.current === f.name) li.classList.add('active');
      li.addEventListener('click', () => this.open(f.name));
      this.tree.appendChild(li);
    }
    // 若正在查看的文件被修改，刷新内容
    if (this.current) this.open(this.current, true);
  }

  open(name, silent = false) {
    this.current = name;
    const f = vfs.get(name);
    if (!f) return;
    if (!silent) this.render();
    const lines = f.content.split('\n').length;
    const t = new Date(f.updatedAt);
    this.meta.textContent =
      `${f.name} · ${lines} 行 · 最近修改：${f.updatedBy} · ${t.toLocaleString('zh-CN', { hour12: false })}`;
    this.content.textContent = f.content;
  }
}

export { FloatPanelHost };
