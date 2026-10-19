/**
 * uiPanels.js — 浮动功能面板控制器
 * 包含三个原有功能面板：
 *  1) 本地大模型对话面板（WebLLM）
 *  2) C++ 在线编译器面板
 *  3) 代码文件面板（虚拟文件系统，编码Agent的修改会实时同步）
 */

import { runCpp } from './compiler.js';
import { vfs } from './vfs.js';
import { llm } from './webllm.js';

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

/* =--------------- 本地大模型对话面板（原有功能） --------------- */
export class ChatPanel {
  constructor(host) {
    this.panel = host.panels.chat;
    this.messages = this.panel.querySelector('#chat-messages');
    this.input = this.panel.querySelector('#chat-llm-input');
    this.sendBtn = this.panel.querySelector('#chat-llm-send');
    this.loadBtn = this.panel.querySelector('#btn-load-model');
    this.modelSelect = this.panel.querySelector('#model-select');
    this.progress = this.panel.querySelector('#model-progress');
    this.progressBar = this.panel.querySelector('#model-progress-bar');

    this.sendBtn.addEventListener('click', () => this.send());
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.send(); });
    this.loadBtn.addEventListener('click', () => this.loadModel());
  }

  addMsg(role, text) {
    const el = document.createElement('div');
    el.className = `chat-msg ${role}`;
    if (role === 'ai') {
      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = '本地大模型';
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

    if (!llm.ready) {
      this.addMsg('ai', '本地模型尚未加载。请点击「加载模型」下载并启动（需要支持 WebGPU 的浏览器，如 Chrome 113+）。未加载时 Agent 会自动使用演示模式。');
      return;
    }
    const body = this.addMsg('ai', '…');
    try {
      await llm.chat(
        [
          { role: 'system', content: '你是虚拟AI工作室搭载的本地大模型助手，回答简洁、友好，使用中文。' },
          { role: 'user', content: text }
        ],
        (_delta, full) => { body.textContent = full; this.messages.scrollTop = this.messages.scrollHeight; }
      );
    } catch (e) {
      body.textContent = '推理出错：' + (e?.message || e);
    }
  }

  async loadModel() {
    const model = this.modelSelect.value;
    this.loadBtn.disabled = true;
    this.progress.hidden = false;
    this.progressBar.style.width = '0%';
    try {
      await llm.load(model, (p, text) => {
        this.progressBar.style.width = Math.round(p * 100) + '%';
        this.loadBtn.textContent = text;
      });
      this.addMsg('ai', `模型 ${model} 已就绪，开始对话吧。`);
    } catch (e) {
      this.addMsg('ai', '加载失败：' + (e?.message || e) + '。可继续使用演示模式体验平台功能。');
    } finally {
      this.loadBtn.disabled = false;
      this.loadBtn.textContent = '加载模型';
      setTimeout(() => { this.progress.hidden = true; }, 900);
    }
  }
}

/* =--------------- C++ 在线编译器面板（原有功能） --------------- */
export class CodePanel {
  constructor(host) {
    this.panel = host.panels.code;
    this.editor = this.panel.querySelector('#cpp-editor');
    this.output = this.panel.querySelector('#cpp-output');
    this.runBtn = this.panel.querySelector('#btn-run-cpp');
    this.saveBtn = this.panel.querySelector('#btn-save-cpp');

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
    this.output.textContent = '编译并运行中…';
    this.output.className = 'cpp-output';
    const res = await runCpp(code);
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

/* =--------------- 代码文件面板（原有功能） --------------- */
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
      // 编码Agent 修改过的文件显示琥珀色角标
      if (f.updatedBy === 'coder') {
        const b = document.createElement('span');
        b.className = 'badge';
        b.title = '编码Agent 修改过';
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
