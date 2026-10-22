/**
 * uiPanels.js — 浮动功能面板控制器
 * 包含三个基础功能面板：
 *  1) AI 连接面板：演示模式（默认，离线规则引擎）/ WebLLM 本地大模型（WebGPU）/
 *     在线 API（OpenAI 兼容，高级选项折叠收纳），支持保存配置与"测试连接"；
 *  2) C++ 编程实验室：代码输入 + 运行 + 控制台输出（默认离线壳子，可勾选联网真实编译）；
 *  3) 代码文件面板（虚拟文件系统，编码Agent的修改会实时同步）。
 */
import { runCpp } from './compiler.js';
import { vfs } from './vfs.js';
import { llm } from './webllm.js';
import { memory, memoryChipText } from './memory.js';
import { LLM_PROVIDERS, API_PRESETS } from './config.js';
import { t, onLangChange } from './i18n.js';

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

/* =--------------- AI 连接面板（演示模式 / WebLLM / 在线API） --------------- */
export class ChatPanel {
  constructor(host) {
    this.panel = host.panels.chat;
    this.messages = this.panel.querySelector('#chat-messages');
    this.input = this.panel.querySelector('#chat-llm-input');
    this.sendBtn = this.panel.querySelector('#chat-llm-send');

    // 运行模式卡片（演示 / WebLLM）
    this.cards = [...this.panel.querySelectorAll('.ai-mode-card')];
    // WebLLM 情境提示条
    this.tip = this.panel.querySelector('#ai-mode-tip');
    // WebLLM 模型加载
    this.loadBtn = this.panel.querySelector('#btn-load-model');
    this.modelSelect = this.panel.querySelector('#model-select');
    this.progress = this.panel.querySelector('#model-progress');
    this.progressBar = this.panel.querySelector('#model-progress-bar');
    // 在线 API 配置（高级选项折叠区）
    this.apiBox = this.panel.querySelector('#api-config');
    this.apiCurrent = this.panel.querySelector('#api-current');
    this.apiPreset = this.panel.querySelector('#api-preset');
    this.apiBase = this.panel.querySelector('#api-base');
    this.apiKey = this.panel.querySelector('#api-key');
    this.apiModel = this.panel.querySelector('#api-model');
    this.saveApiBtn = this.panel.querySelector('#btn-save-api');
    this.useApiBtn = this.panel.querySelector('#btn-use-api');
    this.testApiBtn = this.panel.querySelector('#btn-test-api');
    // V2 长期记忆芯片 + 清除按钮
    this.memoryChip = this.panel.querySelector('#memory-chip');
    this.memoryClearBtn = this.panel.querySelector('#btn-memory-clear');
    this._memoryArmed = false; // 二次点击确认（防误触清空）
    this._memoryArmTimer = null;

    this._bind();
    this._syncProviderUI();
    this._refreshMemoryChip();
    // 记忆变化（含场景 Agent 的对话）时刷新芯片
    memory.onChange = () => this._refreshMemoryChip();
    // V2：语言切换后刷新记忆芯片
    onLangChange(() => this._refreshMemoryChip());
  }

  /** 刷新记忆芯片文案 / refresh memory chip label */
  _refreshMemoryChip() {
    if (this.memoryChip) this.memoryChip.textContent = memoryChipText();
  }

  /** 记忆清除按钮文案（按钮内含 span，避免 textContent 抹掉结构） */
  _memBtnText(s) {
    const span = this.memoryClearBtn.querySelector('span');
    if (span) span.textContent = s; else this.memoryClearBtn.textContent = s;
  }

  /** 清除记忆：第一次点击进入确认态，3 秒内再点才真正清空 / two-click confirm */
  _onMemoryClear() {
    if (!this._memoryArmed) {
      this._memoryArmed = true;
      this._memBtnText(t('ui.memConfirm'));
      this.memoryClearBtn.classList.add('danger');
      this._memoryArmTimer = setTimeout(() => {
        this._memoryArmed = false;
        this._memBtnText(t('ui.memClear'));
        this.memoryClearBtn.classList.remove('danger');
      }, 3000);
      return;
    }
    clearTimeout(this._memoryArmTimer);
    this._memoryArmed = false;
    this._memBtnText(t('ui.memClear'));
    this.memoryClearBtn.classList.remove('danger');
    memory.clear();
    this.addMsg('ai', t('ui.memCleared'));
  }

  _bind() {
    // 模式卡片切换
    this.cards.forEach((c) => c.addEventListener('click', () => {
      llm.setProvider(c.dataset.provider);
      this._syncProviderUI();
      this.addMsg('ai', t('ui.switched', { status: llm.statusText() }));
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
    this.useApiBtn.addEventListener('click', () => this.switchToApi());
    this.testApiBtn.addEventListener('click', () => this.testConnection());
    // 长期记忆：一键清除（二次点击确认）
    this.memoryClearBtn.addEventListener('click', () => this._onMemoryClear());
    // 直接对话
    this.sendBtn.addEventListener('click', () => this.send());
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.send(); });
  }

  /** 按当前模式同步 UI：卡片选中态 / 提示条 / 模型区 / 高级选项展开态 */
  _syncProviderUI() {
    const p = llm.provider;
    this.cards.forEach((c) => c.classList.toggle('active', c.dataset.provider === p));
    // WebLLM 模式：显示情境提示 + 模型加载区；否则隐藏
    const webllm = p === LLM_PROVIDERS.WEBLLM;
    this.tip.hidden = !webllm;
    this.panel.querySelector('#webllm-bar').hidden = !webllm;
    // 高级选项：切到在线 API 时自动展开，方便直接填写
    this.apiBox.open = p === LLM_PROVIDERS.API;
    this.apiCurrent.hidden = p !== LLM_PROVIDERS.API;
    if (p === LLM_PROVIDERS.API) {
      this.apiBase.value = llm.api.baseUrl;
      this.apiKey.value = llm.api.apiKey;
      this.apiModel.value = llm.api.model;
    }
    // 浏览器不支持 WebGPU 时，提示条变红预警
    this.tip.classList.toggle('warn', webllm && !llm.webgpuSupported);
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
      this.addMsg('ai', t('ui.modelNotLoaded'));
      return;
    }
    const body = this.addMsg('ai', '…');
    try {
      const reply = await llm.chat(
        [
          { role: 'system', content: t('ui.chatSys') },
          { role: 'user', content: text }
        ],
        (_delta, full) => { body.textContent = full; this.messages.scrollTop = this.messages.scrollHeight; }
      );
      // V2 长期记忆：这一轮问答写入本机记忆，下次对话自动带上上下文
      memory.addTurn(text, reply);
    } catch (e) {
      body.textContent = t('ui.chatFail', { err: e?.message || e });
    }
  }

  async loadModel() {
    const model = this.modelSelect.value;
    // 点进来加载模型时，先显示提示文字（WebGPU / 发热 / WiFi）
    this.addMsg('ai', t('ui.webllmTip'));
    if (!llm.webgpuSupported) {
      this.addMsg('ai', t('ui.noWebgpu'));
      return;
    }
    this.loadBtn.disabled = true;
    this.progress.hidden = false;
    this.progressBar.style.width = '0%';
    try {
      await llm.loadWebLLM(model, (p, text) => {
        this.progressBar.style.width = Math.round(p * 100) + '%';
        this.loadBtn.querySelector('span').textContent = text;
      });
      this.addMsg('ai', t('ui.modelReady', { id: model }));
    } catch (e) {
      this.addMsg('ai', t('ui.modelFail', { err: e?.message || e }));
    } finally {
      this.loadBtn.disabled = false;
      this.loadBtn.querySelector('span').textContent = t('chat.loadModel');
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
      ? t('ui.apiSaved', { model: llm.api.model })
      : t('ui.apiNoKey'));
    // 配置完整即自动切换，省去用户再找入口
    if (llm.api.apiKey && llm.api.baseUrl && llm.api.model) this.switchToApi();
  }

  /** 显式切换到在线 API 模式 */
  switchToApi() {
    llm.setProvider(LLM_PROVIDERS.API);
    this._syncProviderUI();
    this.addMsg('ai', t('ui.switched', { status: llm.statusText() }));
  }

  /** 测试当前 AI 通道连接 */
  async testConnection() {
    this.testApiBtn.disabled = true;
    this.testApiBtn.querySelector('span').textContent = t('ui.testing');
    try {
      const r = await llm.testConnection();
      this.addMsg('ai', `${r.ok ? '✓' : '✗'} ${r.message}${t('ui.testResult', { ms: r.ms })}`);
    } finally {
      this.testApiBtn.disabled = false;
      this.testApiBtn.querySelector('span').textContent = t('chat.test');
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
    this.output.textContent = this.onlineChk.checked ? t('ui.cppConnecting') : t('ui.cppLocal');
    this.output.className = 'cpp-output';
    // 默认离线壳子；勾选后才联网真实编译（满足单机不联网硬约束）
    const res = await runCpp(code, { online: this.onlineChk.checked });
    this.output.textContent = res.output;
    this.output.className = `cpp-output ${res.ok ? 'ok' : 'err'}`;
  }

  save() {
    const name = this.currentFile || 'main.cpp';
    vfs.write(name, this.editor.value, 'user');
    this.output.textContent = t('ui.cppSaved', { name });
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
        b.title = t('ui.fileBadge', { name: f.updatedBy });
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
    const t_ = new Date(f.updatedAt);
    const locale = document.documentElement.lang === 'en' ? 'en-US' : 'zh-CN';
    this.meta.textContent = t('ui.fileMeta', {
      name: f.name,
      lines: t('unit.lines', { n: lines }),
      by: f.updatedBy,
      time: t_.toLocaleString(locale, { hour12: false })
    });
    this.content.textContent = f.content;
  }
}

export { FloatPanelHost };
