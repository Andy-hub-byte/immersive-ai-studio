/**
 * config.js — 全局配置常量
 * 包含：Agent 定义、状态枚举、场景尺寸、性能参数
 * （V1 版本：仅保留 3 个基础 Agent，不做自定义新增 Agent）
 */

/** Agent 的 4 种基础状态（V1新增：状态机） */
export const AgentState = Object.freeze({
  IDLE: 'idle',           // 空闲
  THINKING: 'thinking',   // 思考
  EXECUTING: 'executing', // 执行任务
  TALKING: 'talking'      // 对话
});

/** 状态对应的中文名与配色（与 CSS 中 .state-* 保持一致） */
export const StateMeta = Object.freeze({
  idle:     { label: '空闲',     color: 0x64748b, css: 'state-idle' },
  thinking: { label: '思考中',   color: 0xfbbf24, css: 'state-thinking' },
  executing:{ label: '执行任务', color: 0x4f8ff7, css: 'state-executing' },
  talking:  { label: '对话中',   color: 0xa78bfa, css: 'state-talking' }
});

/** 3 个基础 Agent 定义（原有功能） */
export const AGENTS = Object.freeze([
  Object.freeze({
    id: 'planner',
    name: '规划Agent',
    role: '项目规划 · 任务拆解',
    short: '规划',
    color: 0x4f8ff7,            // 3D 主体颜色（蓝）
    cssColor: '#4f8ff7',
    initial: '规',
    position: { x: -4.5, z: -4.0 },  // 位于房间左后侧工位
    facing: Math.PI * 0.25,
    deskIndex: 0
  }),
  Object.freeze({
    id: 'coder',
    name: '编码Agent',
    role: '编码实现 · 代码修改',
    short: '编码',
    color: 0x34d399,            // 3D 主体颜色（绿）
    cssColor: '#34d399',
    initial: '码',
    position: { x: 0, z: -4.6 },    // 位于房间中后侧工位
    facing: 0,
    deskIndex: 1
  }),
  Object.freeze({
    id: 'artist',
    name: '创作Agent',
    role: '内容创作 · 文案设计',
    short: '创作',
    color: 0xfbbf24,            // 3D 主体颜色（琥珀）
    cssColor: '#fbbf24',
    initial: '创',
    position: { x: 4.5, z: -4.0 },  // 位于房间右后侧工位
    facing: -Math.PI * 0.25,
    deskIndex: 2
  })
]);

/** 场景尺寸（低多边形办公室） */
export const OFFICE = Object.freeze({
  width: 22,      // 房间宽（X 方向）
  depth: 18,      // 房间深（Z 方向）
  wallHeight: 4,  // 墙高
  fogColor: 0x0b1020,
  fogDensity: 0.016  // 轻微雾化
});

/** 玩家移动参数（原有功能：漫游） */
export const PLAYER = Object.freeze({
  eyeHeight: 1.62,   // 视点高度
  radius: 0.38,      // 碰撞胶囊半径
  walkSpeed: 3.2,    // 步行速度 m/s
  runSpeed: 5.6,     // 加速速度 m/s
  mouseSensitivity: 0.0023
});

/** WebLLM 可选模型列表（原有功能：本地大模型） */
export const LLM_MODELS = Object.freeze([
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'Qwen2.5-3B-Instruct-q4f16_1-MLC',
  'Llama-3.2-1B-Instruct-q4f32_1-MLC'
]);

/** 默认模型（轻量，适合平板浏览器） */
export const DEFAULT_MODEL = LLM_MODELS[0];
