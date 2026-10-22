/**
 * main.js — 平台入口：初始化场景、玩家、Agent、各面板与交互
 *
 * 页面布局（参考 the-delegation 的沉浸式布局）：
 *   中间主体 = 3D 低多边形工作室场景；页面右侧 = 固定深色控制台
 *   （AI 员工列表 + 添加员工 + 流式思考/消息日志 + 指令输入）。
 *
 * 功能划分：
 *   - 基础功能：玩家漫游与碰撞、Agent 系统、本地 AI 对话、C++ 实验室
 *   - V1 新增：Agent 四状态（空闲/思考/执行任务/对话）、右侧流式日志面板、
 *     Agent 详情弹窗（名称/岗位/状态/当前任务/历史对话）
 *   - V2 新增：AI 长期记忆（见 memory.js）、PWA（manifest + Service Worker）、
 *     WebGL 降级（3D 不可用时 AI 对话/记忆/C++实验室仍可用）、
 *     中英双语 + 首次语言选择弹窗（见 i18n.js）
 *
 * 性能约束（重要）：
 *   启动时默认只创建 3 个 Agent（规划/编码/创作），其余 7 个槽位空置，
 *   由用户在右侧面板手动点击"添加"逐步增加（上限 10），降低初始渲染开销。
 *
 * 启动流程：initLangPicker 先处理语言（首访弹选择，已选过直接进入），
 *           确定语言后才执行 boot()，保证所有动态文案以所选语言渲染。
 */
import { StudioScene } from './scene.js';
import { PlayerController } from './player.js';
import { LogPanel } from './logPanel.js';
import { DetailPanel } from './detailPanel.js';
import { AgentManager } from './agents.js';
import { llm } from './webllm.js';
import { memory, withMemory } from './memory.js';
import { ChatPanel, CodePanel, FilesPanel, FloatPanelHost } from './uiPanels.js';
import { t, getLang, setLang, initLangPicker, onLangChange } from './i18n.js';

/* ================= 应用启动（语言确定后执行） ================= */
function boot() {

/* ================= 1. 场景与玩家（基础功能，带 WebGL 降级） ================= */
const canvasWrap = document.getElementById('canvas-wrap');

/**
 * WebGL 降级：老旧平板/无 GPU 环境创建不出上下文时，
 * 隐藏 3D 视口并显示提示，但 AI 对话 / 长期记忆 / C++实验室 / 文件面板全部保持可用。
 * Graceful degradation: if WebGL is unavailable, AI features still work without 3D.
 */
let studio = null;
let player = null;
let agentManager = null;
let glOk = false;
try {
  studio = new StudioScene(canvasWrap);
  studio.resize();
  player = new PlayerController(studio.camera, studio.renderer.domElement, studio.colliders);
  glOk = true;
} catch (e) {
  console.warn('[降级] 3D 场景初始化失败（WebGL 不可用？），AI 功能继续可用：', e);
  const notice = document.getElementById('gl-notice');
  if (notice) notice.hidden = false;
  canvasWrap.style.display = 'none';
}

/* ================= 2. 右侧控制台（V1新增） ================= */
const sidePanel = document.getElementById('side-panel');

// 共享的 Agent 集合：AgentManager 填充，LogPanel / DetailPanel 读取
const agentsMap = new Map();

// 点击 3D 小人 → 打开详情弹窗
function openDetail(agentId) {
  const agent = agentsMap.get(agentId);
  if (agent) detailPanel.open(agent);
}

const logPanel = new LogPanel({
  root: sidePanel,
  agents: agentsMap,
  handlers: {
    // 选中 Agent（3D 点击 / 列表卡片）
    onSelect: (agent) => agentManager?.select(agent),
    // 打开详情弹窗
    onDetail: (agent) => openDetail(agent.id),
    // 移除 Agent
    onRemove: (agentId) => agentManager?.removeAgent(agentId),
    // 添加 Agent（返回 null 表示失败：超出上限或重名）
    onAdd: (name, role) => agentManager?.addAgent({ name, role }) ?? null,
    // 下发任务指令（私聊：仅送达选中的 Agent）
    onSend: (agentId, text) => {
      const agent = agentsMap.get(agentId);
      if (agent) agent.respond(text, { from: 'user', mode: 'task' });
    },
    // 全体广播：发送给所有在岗 Agent，各自认领匹配岗位的任务
    onBroadcast: (text) => agentManager?.broadcast(text)
  }
});

/* ================= 3. Agent 详情弹窗（V1新增） ================= */
const detailPanel = new DetailPanel(document.getElementById('detail-overlay'), agentsMap);
detailPanel.on({
  // 发起对话：选中该 Agent 并聚焦输入框
  talk: (agent) => {
    agentManager?.select(agent);
    logPanel.selectTarget(agent.id);
    logPanel.input.focus();
    agent.avatar.showBubble(t('bubble.here'), 2600);
  },
  // 定位视角：传送玩家到该 Agent 工位前
  locate: (agent) => agentManager?.locate(agent)
});

/* ================= 4. Agent 管理（基础功能 + V1状态） ================= */
if (glOk) {
  agentManager = new AgentManager({
    studio,
    agents: agentsMap,
    logPanel,
    llm,
    player,
    // Agent 增删后刷新右侧列表与指令下拉
    onAgentsChanged: () => {
      logPanel.refreshAgentCards();
      logPanel.refreshTargetOptions();
    }
  });
}

/**
 * 初始员工名单（性能约束：默认只加载 3 个，其余手动添加）
 * 岗位命名尽量贴合原型识别（规划/编码/创作），保证离线引擎转派链路可用。
 */
const INITIAL_AGENTS = [
  { name: '小规', role: '规划' },
  { name: '小码', role: '编码' },
  { name: '小创', role: '创作' }
];
if (glOk && agentManager) {
  for (const cfg of INITIAL_AGENTS) agentManager.addAgent(cfg);
  logPanel.addSystem(t('sys.initialAgents', { n: INITIAL_AGENTS.length }));
  logPanel.addSystem(t('sys.addHint'));
} else {
  logPanel.addSystem(t('sys.noWebgl'));
}
logPanel.refreshTargetOptions(); // 刷新指令下拉选项

/* ================= 5. 浮动功能面板（基础功能） ================= */
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

// V2 语言切换按钮：一键中英互换（按钮标签显示目标语言，由 applyStatic 维护）
document.getElementById('btn-lang').addEventListener('click', () => {
  setLang(getLang() === 'zh' ? 'en' : 'zh');
});

/* ================= 6. AI 连接状态芯片 ================= */
// 默认通道为「离线AI引擎」（无需联网即可用），芯片实时反映当前通道
const modelChip = document.getElementById('model-status');
const modelChipText = document.getElementById('model-status-text');
function refreshModelChip() {
  const state = llm.provider === 'offline' ? 'ready' : (llm.ready || llm.provider === 'api' && llm.api.apiKey) ? 'ready' : 'warn';
  modelChip.dataset.state = state;
  modelChip.className = `chip ${state === 'ready' ? 'chip-ok' : 'chip-warn'}`;
  modelChipText.textContent = llm.statusText();
}
llm.onStatus = refreshModelChip;
refreshModelChip();
// V2：语言切换后刷新状态芯片与详情弹窗（动态文案即时更新）
onLangChange(() => {
  refreshModelChip();
  if (detailPanel.isOpen) detailPanel.refresh();
});

/* ================= 7. 3D 交互：点击 / 悬停 Agent（仅 3D 可用时） ================= */
if (glOk && player && agentManager) {
  const canvas = studio.renderer.domElement;

  // 区分“点击”与“拖动视角”（按下与松开位移小且时间短才算点击）
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
      agentManager.select(agent); // 联动：选中为指令目标
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
}

/* ================= 8. 触屏方向按钮（平板：按钮移动 + 拖拽转视角） ================= */
// 复用 player.setJoystick 接口（x: 右为正, y: 前为正），不改动玩家核心逻辑
if (glOk && player && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
  const dpad = document.getElementById('touch-dpad');
  if (dpad) {
    dpad.hidden = false;
    const btns = dpad.querySelectorAll('.dpad-btn');
    btns.forEach((btn) => {
      const dir = btn.dataset.dir; // up/down/left/right
      const press = (e) => {
        e.preventDefault();
        btn.classList.add('active');
        // 按钮向量：与摇杆语义一致（y 向下为正 → 前方为 -y）
        if (dir === 'up') player.setJoystick(0, -1);
        else if (dir === 'down') player.setJoystick(0, 1);
        else if (dir === 'left') player.setJoystick(-1, 0);
        else if (dir === 'right') player.setJoystick(1, 0);
      };
      const release = () => {
        btn.classList.remove('active');
        player.setJoystick(0, 0); // 松开归零，停止移动
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    });
  }
}

/* ================= 9. 键盘快捷键 ================= */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && detailPanel.isOpen) detailPanel.close();
});

/* ================= 10. 窗口尺寸变化 ================= */
if (glOk) {
  const resize = () => studio.resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvasWrap);
}

/* ================= 11. 主循环（仅 3D 可用时） ================= */
if (glOk) {
  let last = performance.now();
  let detailRefreshTimer = 0;

  function frame(now) {
    // 帧间隔上限 50ms，防止切后台后跳变
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const elapsed = now / 1000;

    player.update(dt);               // 基础功能：漫游 + 碰撞
    agentManager.update(dt, elapsed); // Agent 待机动画 / 悬停高亮
    studio.update(dt);                // 屏幕脉冲等环境动画
    studio.render();

    // 详情面板打开时周期性刷新状态与历史
    if (detailPanel.isOpen) {
      detailRefreshTimer += dt;
      if (detailRefreshTimer > 0.5) { detailRefreshTimer = 0; detailPanel.refresh(); }
    }

    requestAnimationFrame(frame);
  }

  // 首帧渲染后隐藏加载遮罩
  requestAnimationFrame((t_) => {
    frame(t_);
    document.getElementById('loading-overlay').classList.add('done');
    setTimeout(() => document.getElementById('loading-overlay').remove(), 500);
  });
} else {
  // 降级模式：直接移除加载遮罩，AI 面板立即可用
  document.getElementById('loading-overlay')?.classList.add('done');
  setTimeout(() => document.getElementById('loading-overlay')?.remove(), 500);
}

// 调试钩子：便于自动化测试与问题定位（不影响正常功能）
window.__studio = { studio, player, agentManager, logPanel, detailPanel, memory, llm, withMemory };

} /* end boot */

// ============================================================
// PWA：注册 Service Worker（仅 http/https 环境；file:// 本地双击打开时跳过）
// 作用：弱网/断网时可继续打开页面；配合 manifest 可"添加到主屏幕"。
// ============================================================
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 注册失败不影响功能 */ });
  });
}

// ============================================================
// V2 启动门控：先确定语言（首访弹选择框），再启动应用
// 已选择过 → 直接 boot；首访 → 显示 #lang-overlay，用户点击后 boot
// ============================================================
initLangPicker(boot);
