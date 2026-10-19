/**
 * scene.js — 低多边形 3D 办公室场景
 * 风格：基础几何体搭建、无复杂模型、无霓虹特效
 * 光照：柔和基础光照 + 软阴影；屏幕淡淡自发光；轻微雾化
 * 同时负责：向玩家控制器注册碰撞体（AABB / 圆形）
 */
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OFFICE, PLAYER } from './config.js';

/** 低多边形通用材质工厂：平面着色，干净的低面数观感 */
function lowPolyMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1
  });
}

/** 生成“代码屏幕”贴图：深色底 + 随机彩色代码行（淡淡自发光屏幕） */
function makeScreenTexture(seed = 1) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a0f1d';
  ctx.fillRect(0, 0, 256, 160);
  // 顶部标题栏
  ctx.fillStyle = '#141d33';
  ctx.fillRect(0, 0, 256, 14);
  ctx.fillStyle = '#f87171'; ctx.fillRect(8, 5, 6, 5);
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(18, 5, 6, 5);
  ctx.fillStyle = '#34d399'; ctx.fillRect(28, 5, 6, 5);
  // 伪代码行
  let rnd = seed * 9301;
  const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  const palette = ['#7fd4ff', '#9fb8ff', '#34d399', '#fbbf24', '#c7d2fe'];
  for (let i = 0; i < 13; i++) {
    const y = 24 + i * 10;
    let x = 10 + Math.floor(rand() * 3) * 12;
    const segs = 2 + Math.floor(rand() * 4);
    for (let s = 0; s < segs; s++) {
      ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
      ctx.globalAlpha = 0.5 + rand() * 0.4;
      const w = 18 + rand() * 60;
      ctx.fillRect(x, y, w, 4);
      x += w + 8 + rand() * 14;
      if (x > 240) break;
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 生成“白板涂鸦”贴图 */
function makeBoardTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 300;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4f7fc';
  ctx.fillRect(0, 0, 512, 300);
  ctx.strokeStyle = '#3b6fd4'; ctx.lineWidth = 4;
  // 简易流程框图
  const boxes = [[30, 60], [200, 60], [370, 60], [200, 180]];
  boxes.forEach(([x, y], i) => {
    ctx.strokeRect(x, y, 110, 60);
    ctx.fillStyle = '#33456e';
    ctx.font = '20px sans-serif';
    ctx.fillText(['需求', '设计', '开发', '测试'][i], x + 28, y + 38);
  });
  ctx.beginPath();
  ctx.moveTo(140, 90); ctx.lineTo(196, 90);
  ctx.moveTo(310, 90); ctx.lineTo(366, 90);
  ctx.moveTo(425, 122); ctx.lineTo(425, 176); ctx.lineTo(314, 176);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class StudioScene {
  /**
   * @param {HTMLElement} container 3D 视口容器（#canvas-wrap）
   */
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.colliders = [];          // 碰撞体列表：{type:'box'|'circle', ...}
    this.screenMats = [];         // 需要呼吸闪烁的屏幕材质
    this.raycastTargets = [];     // 可供点击的 Agent 组（由 agents.js 注册）

    this._initRenderer();
    this._initSceneAndCamera();
    this._initLights();
    this.buildEnvironment();
    this.buildWorkstations();
    this.buildMeetingArea();
  }

  /* ---------- 渲染器 / 相机 / 标签渲染器 ---------- */
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // 平板友好：限制像素比，避免高分屏过载
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 软阴影
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.id = 'studio-canvas';
    this.container.appendChild(this.renderer.domElement);

    // CSS2D 标签渲染器：用于 Agent 头顶名称 / 状态 / 气泡
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.labelRenderer.domElement);
  }

  _initSceneAndCamera() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(OFFICE.fogColor);
    // 轻微雾化，营造办公室纵深感
    this.scene.fog = new THREE.FogExp2(OFFICE.fogColor, OFFICE.fogDensity);

    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera = new THREE.PerspectiveCamera(58, w / Math.max(h, 1), 0.1, 120);
    this.camera.position.set(0, PLAYER.eyeHeight, 7.5); // 玩家出生点（面朝房间内）
    this.camera.rotation.order = 'YXZ';
  }

  _initLights() {
    // 柔和环境光 + 半球光（天空/地面双色）
    this.scene.add(new THREE.AmbientLight(0xbdd0ff, 0.35));
    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a3350, 0.55));

    // 主平行光：投射软阴影
    const key = new THREE.DirectionalLight(0xfff2dd, 1.5);
    key.position.set(9, 13, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -14; key.shadow.camera.right = 14;
    key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
    key.shadow.camera.near = 1; key.shadow.camera.far = 40;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    this.scene.add(key);

    // 补光：无阴影，柔和背侧
    const fill = new THREE.DirectionalLight(0x9fb8ff, 0.35);
    fill.position.set(-8, 6, -10);
    this.scene.add(fill);
  }

  /* ---------- 碰撞体注册接口（供玩家控制器使用） ---------- */
  addBoxCollider(minX, maxX, minZ, maxZ, label = '') {
    this.colliders.push({ type: 'box', minX, maxX, minZ, maxZ, label });
  }
  addCircleCollider(x, z, r, label = '') {
    this.colliders.push({ type: 'circle', x, z, r, label });
  }

  /* ---------- 场景搭建 ---------- */
  buildEnvironment() {
    const { width: W, depth: D, wallHeight: H } = OFFICE;

    // 地板
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      lowPolyMat(0x39456b, { roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 天花板（封闭空间感）
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      lowPolyMat(0x232c47, { roughness: 1 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    this.scene.add(ceil);

    // 四面墙（内表面朝向房间）
    const wallMat = lowPolyMat(0x4d5a85, { roughness: 0.9 });
    const mkWall = (w, h, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), wallMat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      m.castShadow = true;
      this.scene.add(m);
      return m;
    };
    // 后墙（带 3 扇装饰窗）
    mkWall(W, H, 0, H / 2, -D / 2, 0);
    // 左右墙
    mkWall(0.3, H, -W / 2, H / 2, 0, Math.PI / 2);
    mkWall(0.3, H, W / 2, H / 2, 0, Math.PI / 2);
    // 前墙（带装饰门框）
    mkWall(W, H, 0, H / 2, D / 2, 0);

    // 墙体碰撞（四面）
    this.addBoxCollider(-W / 2 - 0.5, W / 2 + 0.5, -D / 2 - 0.5, -D / 2 + 0.1, '后墙');
    this.addBoxCollider(-W / 2 - 0.5, W / 2 + 0.5, D / 2 - 0.1, D / 2 + 0.5, '前墙');
    this.addBoxCollider(-W / 2 - 0.5, -W / 2 + 0.1, -D / 2, D / 2, '左墙');
    this.addBoxCollider(W / 2 - 0.1, W / 2 + 0.5, -D / 2, D / 2, '右墙');

    // ---- 后墙装饰窗（窗框 + 淡淡自发光窗面）----
    const frameMat = lowPolyMat(0x2b3552, { roughness: 0.7 });
    for (let i = -1; i <= 1; i++) {
      const wx = i * 5.2;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.15),
        new THREE.MeshBasicMaterial({ color: 0x9cc4ff, transparent: true, opacity: 0.55 })); // 淡淡柔光，不刺眼
      pane.position.set(wx, 2.15, -D / 2 + 0.17);
      this.scene.add(pane);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.5, 0.06), frameMat);
      frame.position.set(wx, 2.15, -D / 2 + 0.14);
      this.scene.add(frame);
    }

    // ---- 前墙装饰门框 + EXIT 指示牌 ----
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.08), frameMat);
    doorFrame.position.set(0, 1.2, D / 2 - 0.2);
    this.scene.add(doorFrame);
    const exitSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.24, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x2fae6e })
    );
    exitSign.position.set(0, 2.65, D / 2 - 0.22);
    this.scene.add(exitSign);

    // ---- 天花板灯板（自发光，无实际光源，保证性能）----
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xdfe9ff });
    for (const lx of [-5.5, 5.5]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 1.1), lampMat);
      lamp.position.set(lx, H - 0.06, 0);
      this.scene.add(lamp);
    }

    // ---- 左墙：白板 ----
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.5, 2.6),
      lowPolyMat(0xf4f7fc, { roughness: 0.6 })
    );
    board.position.set(-W / 2 + 0.22, 1.55, -2.0);
    board.rotation.y = Math.PI / 2;
    this.scene.add(board);
    // 白板上的流程贴图
    const boardFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.3),
      new THREE.MeshBasicMaterial({ map: makeBoardTexture() })
    );
    boardFace.position.set(-W / 2 + 0.26, 1.55, -2.0);
    boardFace.rotation.y = Math.PI / 2;
    this.scene.add(boardFace);
    this.addBoxCollider(-W / 2, -W / 2 + 0.45, -3.4, -0.6, '白板');

    // ---- 右墙：书架 + 彩色图书 ----
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 4.2), lowPolyMat(0x6b5a43, { roughness: 0.9 }));
    shelf.position.set(W / 2 - 0.4, 0.95, -1.0);
    this.scene.add(shelf);
    const bookColors = [0xe0603f, 0x3f8fe0, 0x53b98a, 0xe0b53f, 0x8a6fd0, 0xd06a9a];
    for (let row = 0; row < 3; row++) {
      for (let b = 0; b < 9; b++) {
        const bh = 0.22 + Math.random() * 0.1;
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, bh, 0.05 + Math.random() * 0.14),
          lowPolyMat(bookColors[(row * 9 + b) % bookColors.length], { roughness: 0.8 })
        );
        book.position.set(W / 2 - 0.62, 0.42 + row * 0.58 + bh / 2, -2.9 + b * 0.42);
        book.castShadow = true;
        this.scene.add(book);
      }
    }
    this.addBoxCollider(W / 2 - 0.8, W / 2, -3.2, 1.2, '书架');

    // ---- 角落绿植（2 盆）----
    const mkPlant = (x, z) => {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.34, 8), lowPolyMat(0xb0603f, { roughness: 0.9 }));
      pot.position.y = 0.17; pot.castShadow = true;
      g.add(pot);
      const greens = [0x3f9d63, 0x4cb377, 0x35855a];
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 + i * 0.05, 0), lowPolyMat(greens[i], { roughness: 0.9 }));
        leaf.position.set((i - 1) * 0.14, 0.5 + i * 0.16, (i % 2) * 0.12 - 0.06);
        leaf.rotation.set(i, i * 1.3, i * 0.7);
        leaf.castShadow = true;
        g.add(leaf);
      }
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.addCircleCollider(x, z, 0.42, '绿植');
    };
    mkPlant(-9.4, 7.6);
    mkPlant(9.4, -6.6);

    // ---- 饮水机 ----
    const cooler = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.95, 0.42), lowPolyMat(0xdfe6f2, { roughness: 0.6 }));
    body.position.y = 0.48; body.castShadow = true;
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), lowPolyMat(0x9fd4f5, { roughness: 0.3 }));
    bottle.position.y = 1.2;
    cooler.add(body, bottle);
    cooler.position.set(8.6, 0, 6.4);
    this.scene.add(cooler);
    this.addCircleCollider(8.6, 6.4, 0.45, '饮水机');

    // ---- 中央地毯 ----
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.9, 24), lowPolyMat(0x41527e, { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.012, 0.6);
    rug.receiveShadow = true;
    this.scene.add(rug);
  }

  buildWorkstations() {
    // 沿后墙布置 3 个工位：桌 + 显示器（自发光屏幕）+ 键盘 + 椅子
    const deskMat = lowPolyMat(0x8d99b8, { roughness: 0.75, metalness: 0.15 });
    const darkMat = lowPolyMat(0x232c47, { roughness: 0.6 });
    const chairMat = lowPolyMat(0x2e3a5c, { roughness: 0.85 });

    this.deskPositions = [];
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 4.5;
      const z = -7.2;
      this.deskPositions.push({ x, z });

      const g = new THREE.Group();
      // 桌面
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.75), deskMat);
      top.position.y = 0.76; top.castShadow = true; top.receiveShadow = true;
      g.add(top);
      // 桌腿（侧板）
      for (const lx of [-0.85, 0.85]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.62), darkMat);
        leg.position.set(lx, 0.37, 0);
        leg.castShadow = true;
        g.add(leg);
      }
      // 显示器：支架 + 屏幕 + 自发光屏面
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 0.3, 8), darkMat);
      stand.position.set(0, 0.93, -0.2);
      g.add(stand);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.46, 0.04), darkMat);
      screen.position.set(0, 1.24, -0.22);
      screen.rotation.x = -0.1;
      screen.castShadow = true;
      g.add(screen);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.38),
        new THREE.MeshBasicMaterial({ map: makeScreenTexture(i + 1) })
      );
      face.position.set(0, 1.24, -0.196);
      face.rotation.x = -0.1;
      g.add(face);
      // 记录屏幕材质，用于轻微“刷新”脉冲（淡淡的自发光感）
      this.screenMats.push({ mat: face.material, base: face.material.color.clone(), phase: i * 1.7 });
      // 键盘 + 鼠标
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.17), darkMat);
      kb.position.set(0, 0.8, 0.14);
      g.add(kb);
      // 咖啡杯
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), lowPolyMat(0xe8eefc, { roughness: 0.5 }));
      mug.position.set(0.62, 0.84, 0.1);
      g.add(mug);
      // 椅子（拉出略角度，作为陈设）
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), chairMat);
      seat.position.y = 0.46; seat.castShadow = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.06), chairMat);
      back.position.set(0, 0.72, -0.2); back.castShadow = true;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), darkMat);
      pole.position.y = 0.24;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.03, 10), darkMat);
      base.position.y = 0.03;
      chair.add(seat, back, pole, base);
      chair.position.set(0.72, 0, 0.55);
      chair.rotation.y = -0.5;
      g.add(chair);

      g.position.set(x, 0, z);
      this.scene.add(g);
      // 桌子整体碰撞
      this.addBoxCollider(x - 0.95, x + 0.95, z - 0.4, z + 0.4, `工位${i + 1}`);
    }
  }

  buildMeetingArea() {
    // 圆形会议桌 + 4 把椅子 + 桌面小陈设（纸张、杯子）
    const tableMat = lowPolyMat(0x7c8bb0, { roughness: 0.7, metalness: 0.1 });
    const darkMat = lowPolyMat(0x232c47, { roughness: 0.6 });
    const chairMat = lowPolyMat(0x2e3a5c, { roughness: 0.85 });

    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 20), tableMat);
    top.position.y = 0.74; top.castShadow = true; top.receiveShadow = true;
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.7, 10), darkMat);
    pedestal.position.y = 0.37;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.05, 12), darkMat);
    foot.position.y = 0.03;
    g.add(top, pedestal, foot);

    // 桌面陈设：几页纸 + 两个杯子
    for (let i = 0; i < 3; i++) {
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.008, 0.32), lowPolyMat(0xf4f7fc, { roughness: 0.9 }));
      paper.position.set(-0.3 + i * 0.3, 0.79, -0.2 + (i % 2) * 0.3);
      paper.rotation.y = i * 0.8;
      paper.castShadow = true;
      g.add(paper);
    }
    for (const [cx, cz] of [[0.55, 0.35], [-0.6, 0.42]]) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 8), lowPolyMat(0xe8eefc, { roughness: 0.5 }));
      mug.position.set(cx, 0.83, cz);
      g.add(mug);
    }

    // 4 把椅子围桌
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), chairMat);
      seat.position.y = 0.46; seat.castShadow = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.06), chairMat);
      back.position.set(0, 0.72, -0.2); back.castShadow = true;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), darkMat);
      pole.position.y = 0.24;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.03, 10), darkMat);
      base.position.y = 0.03;
      chair.add(seat, back, pole, base);
      chair.position.set(Math.sin(a) * 1.75, 0, 0.6 + Math.cos(a) * 1.75);
      chair.rotation.y = -a + Math.PI;
      g.add(chair);
    }

    g.position.set(0, 0, 0);
    this.scene.add(g);
    // 圆桌碰撞（圆形碰撞体）
    this.addCircleCollider(0, 0.6, 1.25, '会议桌');
  }

  /* ---------- 帧更新 ---------- */
  update(dt) {
    const t = this.clock.getElapsedTime();
    // 屏幕颜色轻微脉冲，模拟代码刷新（不刺眼的淡淡自发光）
    for (const s of this.screenMats) {
      const k = 0.88 + 0.12 * Math.sin(t * 1.6 + s.phase);
      s.mat.color.copy(s.base).multiplyScalar(k);
    }
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}
