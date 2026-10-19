/**
 * config.js — 全局配置常量（V1）
 * 包含：状态枚举、Agent 槽位与配色、场景尺寸、玩家参数、LLM 提供方
 * 说明：Agent 为动态创建（最多10个），不再写死固定名单。
 */

/** Agent 的 4 种基础状态（V1：空闲/思考/执行任务/对话） */
export const AgentState = Object.freeze({
  IDLE: 'idle',           // 空闲
  THINKING: 'thinking',   // 思考
  EXECUTING: 'executing', // 执行任务
  TALKING: 'talking'      // 对话
});

/** 状态对应的中文名与配色（与 CSS 中 .state-* 保持一致） */
export const StateMeta = Object.freeze({
  idle:      { label: '空闲',     color: 0x94a3b8, css: 'state-idle' },
  thinking:  { label: '思考中',   color: 0xfbbf24, css: 'state-thinking' },
  executing: { label: '执行任务', color: 0x4f8ff7, css: 'state-executing' },
  talking:   { label: '对话中',   color: 0xa78bfa, css: 'state-talking' }
});

/** Agent 最多数量（V1 计划：最多 10 个） */
export const MAX_AGENTS = 10;

/**
 * 10 个 Agent 槽位（与场景中的 7 个工位 + 会议区 3 个站位一一对应）
 * 每个槽位包含：
 *  - home：待命点（无事时驻守的位置，保证不在任何碰撞体内）
 *  - work：目标办公桌位置（收到任务后移动到此执行）
 * 行为规则：Agent 绑定槽位待命 → 收到任务移动到 work → 任务完毕返回 home
 */
export const AGENT_SLOTS = Object.freeze([
  // —— 后墙工位排（桌子在 z=-7.2，人在桌前）——
  { x: -4.5, z: -5.5, yaw: Math.PI,         label: '后墙工位 1', work: { x: -4.5, z: -6.4 } },
  { x: 0,    z: -5.5, yaw: Math.PI,         label: '后墙工位 2', work: { x: 0,    z: -6.4 } },
  { x: 4.5,  z: -5.5, yaw: Math.PI,         label: '后墙工位 3', work: { x: 4.5,  z: -6.4 } },
  // —— 左墙工位（桌子在 x=-8.6，人在桌右侧房间内）——
  { x: -7.2, z: -2.5, yaw: -Math.PI / 2,    label: '左墙工位 1', work: { x: -7.85, z: -2.5 } },
  { x: -7.2, z: 2.5,  yaw: -Math.PI / 2,    label: '左墙工位 2', work: { x: -7.85, z: 2.5 } },
  // —— 右墙工位（桌子在 x=8.6，人在桌左侧房间内）——
  { x: 7.2,  z: -2.5, yaw: Math.PI / 2,     label: '右墙工位 1', work: { x: 7.85, z: -2.5 } },
  { x: 7.2,  z: 2.5,  yaw: Math.PI / 2,     label: '右墙工位 2', work: { x: 7.85, z: 2.5 } },
  // —— 会议区站位（目标位置 = 会议桌旁）——
  { x: -2.4, z: 3.4,  yaw: Math.PI * 0.75,  label: '会议区站位 1', work: { x: -1.75, z: 2.5 } },
  { x: 2.4,  z: 3.4,  yaw: -Math.PI * 0.75, label: '会议区站位 2', work: { x: 1.75,  z: 2.5 } },
  { x: 0,    z: 5.2,  yaw: Math.PI,         label: '会议区站位 3', work: { x: 0,     z: 2.9 } }
]);

/** 10 个 Agent 的低饱和度配色（避免霓虹感，轮流分配） */
export const AGENT_COLORS = Object.freeze([
  0x4f8ff7, 0x34d399, 0xfbbf24, 0xa78bfa, 0xf87171,
  0x22d3ee, 0xfb923c, 0xe879f9, 0x94a3b8, 0xfacc15
]);

/** 场景尺寸（低多边形办公室） */
export const OFFICE = Object.freeze({
  width: 22,      // 房间宽（X 方向）
  depth: 18,      // 房间深（Z 方向）
  wallHeight: 4,  // 墙高
  fogColor: 0x0b1020,
  fogDensity: 0.014  // 轻微雾化
});

/** 玩家移动参数（原有功能：漫游） */
export const PLAYER = Object.freeze({
  eyeHeight: 1.62,   // 视点高度
  radius: 0.38,      // 碰撞胶囊半径
  walkSpeed: 3.2,    // 步行速度 m/s
  runSpeed: 5.6,     // 加速速度 m/s
  mouseSensitivity: 0.0023
});

/** Agent 移动参数（V1 行为规则：前往目标办公桌 / 返回工位） */
export const AGENT_MOVE = Object.freeze({
  speed: 1.5,        // 移动速度 m/s（比玩家慢，显得稳重）
  radius: 0.32,      // Agent 圆形碰撞半径
  arriveDist: 0.12   // 到达目标点的判定距离
});

/** LLM 提供方（V1：默认离线引擎，保证无需联网即可用） */
export const LLM_PROVIDERS = Object.freeze({
  OFFLINE: 'offline', // 离线本地引擎（默认，无需联网）
  WEBLLM: 'webllm',   // 本地 WebLLM 模型（WebGPU，首次需下载模型）
  API: 'api'          // 在线 API（OpenAI 兼容，需用户配置密钥）
});

/** WebLLM 可选模型列表（原有功能：本地大模型） */
export const LLM_MODELS = Object.freeze([
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'Qwen2.5-3B-Instruct-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f32_1-MLC'
]);

/** 在线 API 预设（OpenAI 兼容接口，填 Key 即用） */
export const API_PRESETS = Object.freeze([
  { name: 'DeepSeek',    baseUrl: 'https://api.deepseek.com/v1',                  model: 'deepseek-chat' },
  { name: '通义千问 Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '智谱 GLM',    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',         model: 'glm-4-flash' },
  { name: 'Moonshot Kimi', baseUrl: 'https://api.moonshot.cn/v1',                 model: 'moonshot-v1-8k' },
  { name: 'OpenAI',      baseUrl: 'https://api.openai.com/v1',                    model: 'gpt-4o-mini' },
  { name: '自定义',       baseUrl: '',                                             model: '' }
]);
