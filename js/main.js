/**
 * main.js — 平台入口：初始化场景、玩家、Agent、各面板与交互
 *
 * 页面布局（严格参考 the-delegation 截图）：
 *   中间主体 = 3D 低多边形工作室场景；页面右侧 = 固定深色控制台
 *   （Agent 状态卡片 + 流式思考/消息日志 + 指令输入）。
 *
 * 功能划分：
 *   - 原有功能：玩家漫游与碰撞、3 个基础 Agent、WebLLM 对话、C++ 编译器、
 *               编码Agent 读取/修改代码（均未改动核心逻辑）
 *   - V1新增：Agent 四状态、右侧流式日志面板、Agent 详情弹窗
 */
import { StudioScene } from './scene.js';
import { PlayerController } from './player.js';
import { LogPanel } from './logPanel.js';
import { DetailPanel } from './detailPanel.js';
import { AgentManager } from './agents.js';
import { llm } from './webllm.js';
import { ChatPanel, CodePanel, FilesPanel, FloatPanelHost } from './uiPanels.js';

/* ================= 1. 场景与玩家（原有功能） ================= */
const viewport = document.getElementById('viewport');
const canvasWrap = document.getElementById('canvas-wrap');
const studio = new StudioScene(canvasWrap);
studio.resize();

const player = new PlayerController(studio.camera, studio.renderer.domElement, studio.colliders);

/* ================= 2. 右侧控制台（V1新增） ================= */
const sidePanel = document.getElementById('side-panel');

// 共享的 Agent 集合：AgentManager 填充，LogPanel / DetailPanel 读取
const agentsMap = new Map();

const logPanel = new LogPanel({
  root: sidePanel,
  agents: agentsMap,
  onAgentCardClick: (agentId) => openDetail(agentId)
});

// 点击 3D 小人 → 打开详情弹窗
function openDetail(agentId) {
  const agent = agentsMap.get(agentId);
  if (agent) detailPanel.open(agent);
}

/* ================= 3. Agent 详情弹窗（V1新增） ================= */
const detailPanel = new DetailPanel(document.getElementById('detail-overlay'), agentsMap);
detailPanel.on({
  // 发起对话：选中该 Agent 并聚焦输入框（对话状态）
  talk: (agent) => {
    logPanel.selectTarget(agent.id);
    logPanel.input.focus();
    agent.avatar.showBubble('我在，请说。', 2600);
  },
  // 定位视角：传送玩家到该 Agent 工位前
  locate: (agent) => agentManager.locate(agent)
});

/* ================= 4. Agent 管理（原有功能 + V1状态） ================= */
const agentManager = new AgentManager({
  studio,
  agents: agentsMap,
  logPanel,
  llm,
  player,
  onPick: openDetail
});
agentManager.build();
logPanel.renderAgentCards(); // Agent 构建完成后渲染状态卡片

/* ================= 5. 指令输入：下发给 Agent ================= */
logPanel.onSend((agentId, text) => {
  const agent = agentsMap.get(agentId);
  if (agent) agent.respond(text, { from: 'user', mode: 'task' });
});

/* ================= 6. 浮动功能面板（原有功能） ================= */
const host = new FloatPanelHost(document.getElementById('floating-panels'));
const chatPanel = new ChatPanel(host);
const codePanel = new CodePanel(host);
const filesPanel = new FilesPanel(host);

// HUD 按钮：切换面板
const bindHud = (btnId, key) => {
  document.getElementById(btnId).addEventListener('click', () => host.show(key));
};
bindHud('btn-open-chat', 'chat');
bindHud('btn-open-code', 'code');
bindHud('btn-open-files', 'files');

/* ================= 7. 模型状态芯片 ================= */
const modelChip = document.getElementById('model-status');
const modelChipText = document.getElementById('model-status-text');
function setModelChip(state, text) {
  modelChip.dataset.state = state;
  modelChip.className = `chip ${state === 'ready' ? 'chip-ok' : 'chip-warn'}`;
  modelChipText.textContent = text;
}
// 监听模型加载结果（ChatPanel 触发）
const origLoad = chatPanel.loadModel.bind(chatPanel);
chatPanel.loadModel = async () => {
  setModelChip('loading', '模型加载中…');
  await origLoad();
  setModelChip(llm.ready ? 'ready' : 'unloaded', llm.ready ? `本地模型就绪` : '本地模型未加载');
};

/* ================= 8. 3D 交互：点击 / 悬停 Agent ================= */
const canvas = studio.renderer.domElement;

// 区分“点击”与“拖动视角”
let downX = 0, downY = 0, downT = 0;
canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; downT = performance.now(); });
canvas.addEventListener('pointerup', (e) => {
  const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
  if (dist < 7 && performance.now() - downT < 450) handleWorldClick(e.clientX, e.clientY);
});

function handleWorldClick(x, y) {
  // 指针锁定（沉浸模式）下用准星中心拾取，否则用鼠标位置
  const agent = player.locked ? agentManager.pickCenter() : agentManager.pick(x, y);
  if (agent) {
    // 点中 Agent：打开详情弹窗，并退出指针锁定以便操作弹窗
    player.exitLock();
    openDetail(agent.id);
    logPanel.selectTarget(agent.id); // 联动：选中为指令目标
  } else if (!player.locked) {
    // 点空白处：进入沉浸漫游模式
    player.requestLock();
  }
}

// 悬停高亮（仅未锁定的自由鼠标模式）
canvas.addEventListener('pointermove', (e) => {
  if (player.locked || e.pointerType === 'touch') return;
  const agent = agentManager.pick(e.clientX, e.clientY);
  agentManager.hovered = agent;
  canvas.style.cursor = agent ? 'pointer' : 'default';
});

/* ================= 9. 触屏摇杆（原有功能：漫游） ================= */
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  const joy = document.getElementById('touch-joystick');
  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');
  joy.hidden = false;
  let joyId = null, cx = 0, cy = 0;
  const R = 44;

  const moveKnob = (e) => {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    player.setJoystick(dx / R, dy / R); // dy 向下为正 → 前方为 -y
  };
  base.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId;
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    base.setPointerCapture(e.pointerId);
    moveKnob(e);
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) moveKnob(e); });
  const release = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    knob.style.transform = '';
    player.setJoystick(0, 0);
  };
  base.addEventListener('pointerup', release);
  base.addEventListener('pointercancel', release);
}

/* ================= 10. 键盘快捷键 ================= */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && detailPanel.isOpen) detailPanel.close();
});

/* ================= 11. 窗口尺寸变化 ================= */
const resize = () => studio.resize();
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(canvasWrap);

/* ================= 12. 主循环 ================= */
let last = performance.now();
let detailRefreshTimer = 0;

function frame(now) {
  // 帧间隔上限 50ms，防止切后台后跳变
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const elapsed = now / 1000;

  player.update(dt);          // 原有功能：漫游 + 碰撞
  agentManager.update(dt, elapsed); // Agent 待机动画 / 悬停高亮
  studio.update(dt);          // 屏幕脉冲等环境动画
  studio.render();

  // 详情面板打开时周期性刷新状态与历史
  if (detailPanel.isOpen) {
    detailRefreshTimer += dt;
    if (detailRefreshTimer > 0.5) { detailRefreshTimer = 0; detailPanel.refresh(); }
  }

  requestAnimationFrame(frame);
}

// 首帧渲染后隐藏加载遮罩
requestAnimationFrame((t) => {
  frame(t);
  document.getElementById('loading-overlay').classList.add('done');
  setTimeout(() => document.getElementById('loading-overlay').remove(), 500);
});

// 调试钩子：便于自动化测试与问题定位（不影响正常功能）
window.__studio = { studio, player, agentManager, logPanel, detailPanel };
