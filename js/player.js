/**
 * player.js — 玩家漫游控制器（原有功能，禁止改动其核心逻辑）
 * 能力：第一人称自由移动（WASD/方向键/Shift 加速）、指针锁定视角、
 *       触屏摇杆 + 拖动视角、AABB / 圆形碰撞检测与滑动解算。
 * 说明：本模块只负责“玩家”，Agent 的移动在 V1 中明确不开发。
 */
import * as THREE from 'three';
import { PLAYER } from './config.js';

export class PlayerController {
  /**
   * @param {THREE.PerspectiveCamera} camera 场景相机
   * @param {HTMLElement} domElement 监听事件的 DOM（画布）
   * @param {Array<object>} colliders 场景碰撞体列表
   */
  constructor(camera, domElement, colliders) {
    this.camera = camera;
    this.dom = domElement;
    this.colliders = colliders;

    // 朝向：偏航 + 俯仰（相机默认视线为 -Z，yaw=0 即面朝房间内部）
    this.yaw = 0;         // 出生时面朝房间内（-Z）
    this.pitch = 0;
    // 位置（与相机共享，脚底为 y=0）
    this.position = new THREE.Vector3(0, 0, 7.5);

    this.keys = new Set();
    this.locked = false;
    this.touchMove = { x: 0, y: 0, active: false }; // 摇杆向量
    this.enabled = true;

    this._bindEvents();
    this._syncCamera();
  }

  /* ---------- 事件绑定 ---------- */
  _bindEvents() {
    // 键盘
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      // 防止空格/方向键滚动页面
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // 指针锁定：由 main.js 统一决策（点中 Agent 时只开详情、不锁定）
    // 此处仅提供 requestLock / exitLock 能力，不在 click 中自动锁定

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      document.getElementById('crosshair').hidden = !this.locked;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * PLAYER.mouseSensitivity;
      this.pitch -= e.movementY * PLAYER.mouseSensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });

    // 触屏：单指拖动 = 视角；左下摇杆 = 移动（由 main.js 注入摇杆 DOM）
    let lastTouch = null;
    this.dom.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      // 摇杆区域内的触摸不旋转视角
      const joy = document.getElementById('touch-joystick');
      if (joy && !joy.hidden) {
        const r = joy.getBoundingClientRect();
        if (t.clientX >= r.left - 20 && t.clientX <= r.right + 20 &&
            t.clientY >= r.top - 20 && t.clientY <= r.bottom + 20) return;
      }
      lastTouch = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    this.dom.addEventListener('touchmove', (e) => {
      if (!lastTouch) return;
      const t = e.changedTouches[0];
      this.yaw -= (t.clientX - lastTouch.x) * 0.005;
      this.pitch -= (t.clientY - lastTouch.y) * 0.005;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
      lastTouch = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    this.dom.addEventListener('touchend', () => { lastTouch = null; }, { passive: true });
  }

  /** 请求进入指针锁定（沉浸漫游模式） */
  requestLock() {
    if (!this.locked && this.enabled) this.dom.requestPointerLock?.();
  }

  /** 退出指针锁定 */
  exitLock() {
    if (this.locked) document.exitPointerLock?.();
  }

  /** 供触屏摇杆调用的移动向量（x: 右为正, y: 前为正） */
  setJoystick(x, y) {
    this.touchMove.x = x;
    this.touchMove.y = y;
    this.touchMove.active = true;
  }

  /* ---------- 碰撞检测：圆形玩家 vs 盒体/圆柱 ---------- */
  _collides(nx, nz) {
    const r = PLAYER.radius;
    for (const c of this.colliders) {
      if (c.type === 'box') {
        // 圆 vs AABB：求最近点
        const cx = Math.max(c.minX, Math.min(nx, c.maxX));
        const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
        const dx = nx - cx, dz = nz - cz;
        if (dx * dx + dz * dz < r * r) return true;
      } else if (c.type === 'circle') {
        const dx = nx - c.x, dz = nz - c.z;
        const rr = r + c.r;
        if (dx * dx + dz * dz < rr * rr) return true;
      }
    }
    return false;
  }

  /* ---------- 每帧更新 ---------- */
  update(dt) {
    if (!this.enabled) return;

    // 1. 计算输入方向（相机坐标系）
    let fwd = 0, right = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) right -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right += 1;
    // 触屏摇杆
    if (this.touchMove.active) { fwd += -this.touchMove.y; right += this.touchMove.x; }

    const len = Math.hypot(fwd, right);
    if (len > 0) {
      fwd /= Math.max(len, 1); right /= Math.max(len, 1); // 归一化，斜向不加速
      const speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))
        ? PLAYER.runSpeed : PLAYER.walkSpeed;

      // 依据偏航角将输入旋转到世界坐标
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // 前方向（-Z 为前）
      const dirX = -sin * fwd + cos * right;
      const dirZ = -cos * fwd - sin * right;

      // 2. 分轴解算：先 X 后 Z，碰撞时沿墙滑动
      const stepX = dirX * speed * dt;
      const stepZ = dirZ * speed * dt;
      if (!this._collides(this.position.x + stepX, this.position.z)) this.position.x += stepX;
      if (!this._collides(this.position.x, this.position.z + stepZ)) this.position.z += stepZ;
    }

    this._syncCamera();
  }

  _syncCamera() {
    this.camera.position.set(this.position.x, PLAYER.eyeHeight, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  /** 传送玩家到指定位置（用于详情弹窗“定位视角”） */
  teleport(x, z, faceYaw) {
    this.position.set(x, 0, z);
    if (typeof faceYaw === 'number') this.yaw = faceYaw;
    this._syncCamera();
  }
}
