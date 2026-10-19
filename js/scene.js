/**
 * scene.js — 低多边形 3D 办公室场景（V1）
 * 风格：全部使用基础几何体（立方体/圆柱/球体/圆环等）搭建，
 *       不加载任何图片与外部模型；柔和光照 + 软阴影 + 屏幕自发光 + 轻微雾化。
 * 布局：后墙 3 工位 + 左右墙各 2 工位（共 7 个工位）+ 中央圆形会议桌，
 *       对应 10 个 Agent 槽位（详见 config.AGENT_SLOTS）。
 * 同时负责：向玩家控制器注册碰撞体（AABB / 圆形）。
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

/** 生成“代码屏幕”贴图（Canvas 程序化生成，非外部图片资源） */
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

/** 生成“白板涂鸦”贴图（Canvas 程序化生成） */
function makeBoardTexture() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 300;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4f7fc';
  ctx.fillRect(0, 0, 512, 300);
  ctx.strokeStyle = '#3b6fd4'; ctx.lineWidth = 4;
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

/** 生成“装饰画”贴图（抽象色块，程序化生成） */
function makeArtTexture(kind) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 320;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#eef2fa';
  ctx.fillRect(0, 0, 256, 320);
  if (kind === 0) {
    // 山峦几何
    ctx.fillStyle = '#4f8ff7';
    ctx.beginPath(); ctx.moveTo(0, 320); ctx.lineTo(90, 130); ctx.lineTo(170, 320); ctx.fill();
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath(); ctx.moveTo(110, 320); ctx.lineTo(200, 90); ctx.lineTo(256, 320); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(190, 70, 26, 0, Math.PI * 2); ctx.fill();
  } else {
    // 圆点矩阵
    const cols = ['#34d399', '#4f8ff7', '#f87171', '#fbbf24', '#a78bfa'];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
      ctx.fillStyle = cols[(r * 4 + c) % cols.length];
      ctx.beginPath(); ctx.arc(48 + c * 54, 56 + r * 54, 20, 0, Math.PI * 2); ctx.fill();
    }
  }
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
    this.screenMats = [];         // 需要脉冲的屏幕材质
    this.raycastTargets = [];     // 可供点击的 Agent 组（由 agents.js 注册）

    this._initRenderer();
    this._initSceneAndCamera();
    this._initLights();
    this.buildEnvironment();
    this.buildWorkstations();   // 7 个工位
    this.buildMeetingArea();    // 会议桌 + 会议区
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

  /* ============================================================
   * 基础环境：地面 / 天花板 / 墙体 / 踢脚线 / 门窗 / 墙面装饰
   * ============================================================ */
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

    // 四面墙
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
    mkWall(W, H, 0, H / 2, -D / 2, 0);                    // 后墙
    mkWall(0.3, H, -W / 2, H / 2, 0, Math.PI / 2);        // 左墙
    mkWall(0.3, H, W / 2, H / 2, 0, Math.PI / 2);         // 右墙
    mkWall(W, H, 0, H / 2, D / 2, 0);                     // 前墙

    // 墙体碰撞（四面）
    this.addBoxCollider(-W / 2 - 0.5, W / 2 + 0.5, -D / 2 - 0.5, -D / 2 + 0.1, '后墙');
    this.addBoxCollider(-W / 2 - 0.5, W / 2 + 0.5, D / 2 - 0.1, D / 2 + 0.5, '前墙');
    this.addBoxCollider(-W / 2 - 0.5, -W / 2 + 0.1, -D / 2, D / 2, '左墙');
    this.addBoxCollider(W / 2 - 0.1, W / 2 + 0.5, -D / 2, D / 2, '右墙');

    // 踢脚线（沿四面墙根部，增加细节）
    const skirtMat = lowPolyMat(0x2b3552, { roughness: 0.7 });
    const mkSkirt = (w, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.04), skirtMat);
      m.position.set(x, 0.06, z);
      m.rotation.y = ry;
      this.scene.add(m);
    };
    mkSkirt(W - 0.6, 0, -D / 2 + 0.16, 0);
    mkSkirt(W - 0.6, 0, D / 2 - 0.16, 0);
    mkSkirt(D - 0.6, -W / 2 + 0.16, 0, Math.PI / 2);
    mkSkirt(D - 0.6, W / 2 - 0.16, 0, Math.PI / 2);

    // ---- 后墙装饰窗（窗框 + 淡淡自发光窗面 + 窗台）----
    const frameMat = skirtMat;
    for (let i = -1; i <= 1; i++) {
      const wx = i * 5.2;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.15),
        new THREE.MeshBasicMaterial({ color: 0x9cc4ff, transparent: true, opacity: 0.55 })); // 淡淡柔光
      pane.position.set(wx, 2.15, -D / 2 + 0.17);
      this.scene.add(pane);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.5, 0.06), frameMat);
      frame.position.set(wx, 2.15, -D / 2 + 0.14);
      this.scene.add(frame);
      // 窗台
      const sill = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.06, 0.22), frameMat);
      sill.position.set(wx, 1.38, -D / 2 + 0.28);
      this.scene.add(sill);
    }

    // ---- 前墙装饰门框 + EXIT 指示牌 + 门把手 ----
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.08), frameMat);
    doorFrame.position.set(0, 1.2, D / 2 - 0.2);
    this.scene.add(doorFrame);
    const exitSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.24, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x2fae6e })
    );
    exitSign.position.set(0, 2.65, D / 2 - 0.22);
    this.scene.add(exitSign);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), lowPolyMat(0xd9e2f2, { metalness: 0.5, roughness: 0.3 }));
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.45, 1.05, D / 2 - 0.24);
    this.scene.add(handle);

    // ---- 前墙装饰画（两幅，程序化贴图）----
    for (let i = 0; i < 2; i++) {
      const art = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 1.3, 1.0),
        new THREE.MeshBasicMaterial({ map: makeArtTexture(i) })
      );
      art.position.set(-4.5 + i * 9, 2.0, D / 2 - 0.22);
      this.scene.add(art);
      const artFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.45, 1.15), lowPolyMat(0x2b3552, { roughness: 0.6 }));
      artFrame.position.set(-4.5 + i * 9, 2.0, D / 2 - 0.26);
      this.scene.add(artFrame);
    }

    // ---- 天花板灯板（自发光，无实际光源，保证性能）----
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xdfe9ff });
    for (const lx of [-5.5, 5.5]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, 1.1), lampMat);
      lamp.position.set(lx, H - 0.06, 0);
      this.scene.add(lamp);
    }

    // ---- 左墙：白板 + 笔托盘 ----
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 2.6), lowPolyMat(0xf4f7fc, { roughness: 0.6 }));
    board.position.set(-W / 2 + 0.22, 1.55, -2.0);
    board.rotation.y = Math.PI / 2;
    this.scene.add(board);
    const boardFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.3),
      new THREE.MeshBasicMaterial({ map: makeBoardTexture() })
    );
    boardFace.position.set(-W / 2 + 0.26, 1.55, -2.0);
    boardFace.rotation.y = Math.PI / 2;
    this.scene.add(boardFace);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.0), lowPolyMat(0x8d99b8, { roughness: 0.6 }));
    tray.position.set(-W / 2 + 0.28, 0.78, -2.0);
    this.scene.add(tray);
    // 白板上的三支笔
    const penColors = [0xf87171, 0x34d399, 0x2b3552];
    penColors.forEach((c, i) => {
      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), lowPolyMat(c, { roughness: 0.5 }));
      pen.rotation.z = Math.PI / 2;
      pen.position.set(-W / 2 + 0.32, 0.82, -2.5 + i * 0.5);
      this.scene.add(pen);
    });
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

    // ---- 左后角：储物柜 / 服务器机柜（带自发光指示灯）----
    const cabinet = new THREE.Group();
    const cabBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 1.4), lowPolyMat(0x2e3a5c, { roughness: 0.6, metalness: 0.2 }));
    cabBody.position.y = 1.0; cabBody.castShadow = true;
    cabinet.add(cabBody);
    // 机柜散热槽 + 指示灯
    for (let i = 0; i < 4; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0x0a0f1d }));
      slot.position.set(0, 1.55 - i * 0.12, 0.71);
      cabinet.add(slot);
    }
    const led1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x34d399 }));
    led1.position.set(-0.3, 1.3, 0.71);
    const led2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    led2.position.set(-0.2, 1.3, 0.71);
    cabinet.add(led1, led2);
    cabinet.position.set(-9.6, 0, -7.4);
    this.scene.add(cabinet);
    this.addBoxCollider(-10.1, -9.1, -8.2, -6.6, '储物柜');

    // ---- 右后角：咖啡机 ----
    const coffee = new THREE.Group();
    const cmBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.45), lowPolyMat(0x3a4668, { roughness: 0.5, metalness: 0.25 }));
    cmBody.position.y = 0.35; cmBody.castShadow = true;
    const cmTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.35), lowPolyMat(0x222c47, { roughness: 0.5 }));
    cmTop.position.y = 0.75;
    const cmLed = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x4f8ff7 }));
    cmLed.position.set(0, 0.55, 0.23);
    const cmPot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.12, 8), lowPolyMat(0xd9e2f2, { metalness: 0.4, roughness: 0.3 }));
    cmPot.position.set(0, 0.82, 0.1);
    coffee.add(cmBody, cmTop, cmLed, cmPot);
    coffee.position.set(9.4, 0, -7.2);
    this.scene.add(coffee);
    this.addCircleCollider(9.4, -7.2, 0.5, '咖啡机');

    // ---- 垃圾桶（后墙中间工位旁）----
    const bin = new THREE.Group();
    const binBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.5, 10), lowPolyMat(0x51608a, { roughness: 0.7 }));
    binBody.position.y = 0.25; binBody.castShadow = true;
    const binRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 16), lowPolyMat(0x2b3552, { roughness: 0.6 }));
    binRim.rotation.x = Math.PI / 2;
    binRim.position.y = 0.5;
    bin.add(binBody, binRim);
    bin.position.set(-1.5, 0, -5.2);
    this.scene.add(bin);
    this.addCircleCollider(-1.5, -5.2, 0.32, '垃圾桶');

    // ---- 角落绿植（3 盆）----
    const mkPlant = (x, z, scale = 1) => {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.34, 8), lowPolyMat(0xb0603f, { roughness: 0.9 }));
      pot.position.y = 0.17; pot.castShadow = true;
      g.add(pot);
      const greens = [0x3f9d63, 0x4cb377, 0x35855a];
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((0.26 + i * 0.05) * scale, 0), lowPolyMat(greens[i], { roughness: 0.9 }));
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
    mkPlant(9.6, 6.2);
    mkPlant(-9.2, -3.4, 0.85);

    // ---- 饮水机 ----
    const cooler = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.95, 0.42), lowPolyMat(0xdfe6f2, { roughness: 0.6 }));
    body.position.y = 0.48; body.castShadow = true;
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10), lowPolyMat(0x9fd4f5, { roughness: 0.3 }));
    bottle.position.y = 1.2;
    cooler.add(body, bottle);
    cooler.position.set(6.6, 0, 7.4);
    this.scene.add(cooler);
    this.addCircleCollider(6.6, 7.4, 0.45, '饮水机');

    // ---- 挂钟（左墙前部）----
    const clock = new THREE.Group();
    const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20), lowPolyMat(0x2b3552, { roughness: 0.5 }));
    clockRim.rotation.x = Math.PI / 2;
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.09, 20), lowPolyMat(0xf4f7fc, { roughness: 0.5 }));
    clockFace.rotation.x = Math.PI / 2;
    const handH = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.01), lowPolyMat(0x1a2233, { roughness: 0.5 }));
    handH.position.set(0, 0.05, 0.055);
    const handM = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.26, 0.01), lowPolyMat(0x1a2233, { roughness: 0.5 }));
    handM.position.set(0.05, 0, 0.06);
    clock.add(clockRim, clockFace, handH, handM);
    clock.position.set(-W / 2 + 0.2, 2.5, 6.5);
    clock.rotation.y = Math.PI / 2;
    this.scene.add(clock);

    // ---- 中央地毯 ----
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.9, 24), lowPolyMat(0x41527e, { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.012, 0.6);
    rug.receiveShadow = true;
    this.scene.add(rug);
  }

  /* ============================================================
   * 工位区：7 个工位（后墙 3 + 左墙 2 + 右墙 2）
   * 每个工位：桌 + 显示器（自发光屏）+ 键盘 + 椅子 + 台灯/绿植/杯子
   * ============================================================ */
  buildWorkstations() {
    const deskMat = lowPolyMat(0x8d99b8, { roughness: 0.75, metalness: 0.15 });
    const darkMat = lowPolyMat(0x232c47, { roughness: 0.6 });
    const chairMat = lowPolyMat(0x2e3a5c, { roughness: 0.85 });

    /** 搭建一个工位（alongAxis: 'z' 桌长边沿 Z，'x' 桌长边沿 X） */
    const mkDesk = (x, z, ry, alongAxis) => {
      const g = new THREE.Group();
      // 桌面（按朝向旋转）
      const top = new THREE.Mesh(
        alongAxis === 'x' ? new THREE.BoxGeometry(1.9, 0.07, 0.75) : new THREE.BoxGeometry(0.75, 0.07, 1.9),
        deskMat
      );
      top.position.y = 0.76; top.castShadow = true; top.receiveShadow = true;
      g.add(top);
      // 桌腿侧板
      const legGeo = alongAxis === 'x'
        ? [new THREE.BoxGeometry(1.7, 0.72, 0.07), new THREE.BoxGeometry(1.7, 0.72, 0.07)]
        : [new THREE.BoxGeometry(0.07, 0.72, 1.7), new THREE.BoxGeometry(0.07, 0.72, 1.7)];
      const legPos = alongAxis === 'x' ? [[0, 0.37, -0.3], [0, 0.37, 0.3]] : [[-0.3, 0.37, 0], [0.3, 0.37, 0]];
      legGeo.forEach((geo, i) => {
        const leg = new THREE.Mesh(geo, darkMat);
        leg.position.set(...legPos[i]);
        leg.castShadow = true;
        g.add(leg);
      });
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
        new THREE.MeshBasicMaterial({ map: makeScreenTexture(Math.floor(Math.random() * 99) + 1) })
      );
      face.position.set(0, 1.24, -0.196);
      face.rotation.x = -0.1;
      g.add(face);
      this.screenMats.push({ mat: face.material, base: face.material.color.clone(), phase: Math.random() * 6 });
      // 键盘 + 鼠标
      const kb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.17), darkMat);
      kb.position.set(0, 0.8, 0.14);
      g.add(kb);
      // 咖啡杯
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), lowPolyMat(0xe8eefc, { roughness: 0.5 }));
      mug.position.set(0.62, 0.84, 0.1);
      g.add(mug);
      // 桌面小绿植
      const dpot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.09, 6), lowPolyMat(0xb0603f, { roughness: 0.9 }));
      dpot.position.set(-0.62, 0.82, 0.05);
      const dleaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), lowPolyMat(0x4cb377, { roughness: 0.9 }));
      dleaf.position.set(-0.62, 0.9, 0.05);
      g.add(dpot, dleaf);
      // 台灯（底座 + 支杆 + 自发光灯头）
      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 10), darkMat);
      lampBase.position.set(-0.78, 0.79, -0.1);
      const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.34, 6), darkMat);
      lampArm.position.set(-0.78, 0.95, -0.1);
      lampArm.rotation.z = 0.25;
      const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
      lampHead.position.set(-0.68, 1.1, -0.1);
      lampHead.rotation.z = -0.5;
      g.add(lampBase, lampArm, lampHead);

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
      g.rotation.y = ry;
      this.scene.add(g);

      // 桌子整体碰撞（按朝向扩展 AABB）
      if (alongAxis === 'x') this.addBoxCollider(x - 0.95, x + 0.95, z - 0.4, z + 0.4, '工位');
      else this.addBoxCollider(x - 0.4, x + 0.4, z - 0.95, z + 0.95, '工位');
    };

    // 后墙 3 工位（桌长边沿 X，面朝房间内）
    mkDesk(-4.5, -7.2, 0, 'x');
    mkDesk(0, -7.2, 0, 'x');
    mkDesk(4.5, -7.2, 0, 'x');
    // 左墙 2 工位（桌长边沿 Z，面朝右）
    mkDesk(-8.6, -2.5, Math.PI / 2, 'z');
    mkDesk(-8.6, 2.5, Math.PI / 2, 'z');
    // 右墙 2 工位（桌长边沿 Z，面朝左）
    mkDesk(8.6, -2.5, -Math.PI / 2, 'z');
    mkDesk(8.6, 2.5, -Math.PI / 2, 'z');
  }

  /* ============================================================
   * 会议区：圆形会议桌 + 4 椅 + 桌上一台笔记本电脑 + 陈设
   * ============================================================ */
  buildMeetingArea() {
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

    // 笔记本电脑（底座 + 自发光屏幕）
    const lapBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), lowPolyMat(0xb8c2d9, { roughness: 0.4, metalness: 0.3 }));
    lapBase.position.set(-0.45, 0.79, -0.35);
    lapBase.rotation.y = 0.4;
    const lapScreen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.02), lowPolyMat(0x222c47, { roughness: 0.5 }));
    lapScreen.position.set(-0.36, 0.93, -0.28);
    lapScreen.rotation.set(-0.25, 0.4, 0);
    const lapFace = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.22), new THREE.MeshBasicMaterial({ map: makeScreenTexture(7) }));
    lapFace.position.set(-0.355, 0.935, -0.272);
    lapFace.rotation.set(-0.25, 0.4, 0);
    g.add(lapBase, lapScreen, lapFace);
    this.screenMats.push({ mat: lapFace.material, base: lapFace.material.color.clone(), phase: 3.1 });

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
