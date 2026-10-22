/**
 * avatar.js — 简约人形 AI 小人（纯基础几何体搭建）
 * 组成：球体头部 + 胶囊躯干/四肢，非方块；头顶悬浮状态光环与状态珠，
 *      附带 CSS2D 名称标签 / 状态标签 / 对话气泡。
 * V1：头顶状态光环颜色随 4 种状态（空闲/思考/执行任务/对话）变化；
 *      支持“选中高亮”（被选中的 Agent 光环放大、标签描边）。
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { StateMeta } from './config.js';
import { pick } from './i18n.js';

export class AgentAvatar {
  /**
   * @param {object} agentConfig { id, name, role, color, position:{x,z}, facing }
   */
  constructor(agentConfig) {
    this.config = agentConfig;
    this.group = new THREE.Group();
    this.group.position.set(agentConfig.position.x, 0, agentConfig.position.z);
    this.group.rotation.y = agentConfig.facing;
    this.group.userData.agentId = agentConfig.id; // 供射线拾取识别
    this._buildBody();
    this._buildStatusRing();
    this._buildLabels();
    this.phase = Math.random() * Math.PI * 2; // 动画相位错开
  }

  /* ---------- 人形躯体：基础几何体 ---------- */
  _buildBody() {
    const main = new THREE.MeshStandardMaterial({
      color: this.config.color, flatShading: true, roughness: 0.6, metalness: 0.1
    });
    // 头部用略浅的同色，面罩用自发光
    const headMat = main.clone(); headMat.color.lerp(new THREE.Color(0xffffff), 0.35);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x0b1020, emissive: 0x9fd4ff, emissiveIntensity: 1.6, roughness: 0.3
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a2233, flatShading: true, roughness: 0.7
    });

    // 躯干（胶囊）
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.46, 4, 10), main);
    this.torso.position.y = 1.05;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // 胸前能量核心（小小自发光方块，点明“AI”身份）
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), visorMat);
    core.position.set(0, 1.1, 0.185);
    this.group.add(core);

    // 头部（球体，低面数）
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 10, 8), headMat);
    this.head.position.y = 1.56;
    this.head.castShadow = true;
    this.group.add(this.head);
    // 面罩（眼部自发光横条）
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.05), visorMat);
    visor.position.set(0, 1.58, 0.155);
    this.group.add(visor);

    // 双臂：肩部枢轴 + 上臂 + 肘部枢轴 + 前臂
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.27, 1.24, 0);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.24, 3, 8), main);
      upper.position.y = -0.17; upper.castShadow = true;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.36;
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 3, 8), main);
      fore.position.y = -0.15; fore.castShadow = true;
      elbow.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), headMat);
      hand.position.y = -0.3;
      elbow.add(hand);
      shoulder.add(elbow);
      this.group.add(shoulder);
      this.arms.push({ shoulder, elbow, side });
    }

    // 双腿：髋部枢轴 + 腿 + 脚
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11, 0.78, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 3, 8), darkMat);
      leg.position.y = -0.32; leg.castShadow = true;
      hip.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.24), darkMat);
      foot.position.set(0, -0.66, 0.04);
      hip.add(foot);
      this.group.add(hip);
      this.legs.push({ hip, side });
    }
  }

  /* ---------- 头顶状态光环 + 状态珠 ---------- */
  _buildStatusRing() {
    // 初始为“空闲”状态配色，后续由 setStateVisual 动态切换
    this.statusRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.018, 8, 28),
      new THREE.MeshBasicMaterial({ color: StateMeta.idle.color })
    );
    this.statusRing.rotation.x = Math.PI / 2;
    this.statusRing.position.y = 1.98;
    this.group.add(this.statusRing);

    // 悬浮状态珠：颜色与光环一致，上下浮动
    this.statusOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.07),
      new THREE.MeshBasicMaterial({ color: StateMeta.idle.color })
    );
    this.statusOrb.position.y = 1.86;
    this.group.add(this.statusOrb);
  }

  /* ---------- CSS2D 标签：名称 / 状态 / 气泡 ---------- */
  _buildLabels() {
    // 名称 + 状态标签
    const tag = document.createElement('div');
    tag.className = 'agent-tag';
    this.tagName = document.createElement('span');
    this.tagName.className = 'tag-name';
    this.tagName.textContent = this.config.name;
    this.tagState = document.createElement('span');
    this.tagState.className = 'tag-state state-idle';
    this.tagState.innerHTML = '<i class="dot"></i>空闲';
    tag.append(this.tagName, this.tagState);
    this.tagObj = new CSS2DObject(tag);
    this.tagObj.position.set(0, 2.25, 0);
    this.group.add(this.tagObj);

    // 对话气泡（默认隐藏）
    this.bubbleEl = document.createElement('div');
    this.bubbleEl.className = 'agent-bubble';
    this.bubbleEl.hidden = true;
    this.bubbleObj = new CSS2DObject(this.bubbleEl);
    this.bubbleObj.position.set(0.55, 1.62, 0.15);
    this.group.add(this.bubbleObj);
  }

  /** V1新增：切换状态光环 / 状态珠 / 标签颜色 */
  setStateVisual(state) {
    this._state = state;
    const meta = StateMeta[state] ?? StateMeta.idle;
    this.statusRing.material.color.setHex(meta.color);
    this.statusOrb.material.color.setHex(meta.color);
    this.tagState.className = `tag-state ${meta.css}`;
    this.tagState.innerHTML = `<i class="dot"></i>${pick(meta.label)}`;
  }

  /** 显示对话气泡（自动淡出隐藏） */
  showBubble(text, duration = 4200) {
    this.bubbleEl.textContent = text.length > 60 ? text.slice(0, 60) + '…' : text;
    this.bubbleEl.hidden = false;
    clearTimeout(this._bubbleTimer);
    this._bubbleTimer = setTimeout(() => { this.bubbleEl.hidden = true; }, duration);
  }

  /** 选中高亮：光环与外圈放大、名称标签高亮描边 */
  setSelected(on) {
    this._selected = on;
    this.tagName.style.borderColor = on ? '#4f8ff7' : '';
    this.tagName.style.color = on ? '#ffffff' : '';
    this.statusRing.scale.setScalar(on ? 1.35 : 1);
  }

  /**
   * 每帧动画（不做寻路移动，仅肢体微动）
   * @param {number} elapsed 运行总秒数
   * @param {string} state 当前状态
   * @param {boolean} moving 是否正在移动（走路时摆臂摆腿幅度加大）
   */
  update(elapsed, state, moving = false) {
    const p = this.phase;
    // 身体轻微呼吸起伏
    this.torso.position.y = 1.05 + Math.sin(elapsed * 1.4 + p) * 0.012;
    this.head.position.y = 1.56 + Math.sin(elapsed * 1.4 + p + 0.4) * 0.014;

    // 手臂摆动：走路时大幅前后摆，站立时自然微摆
    for (const a of this.arms) {
      if (moving) {
        a.shoulder.rotation.x = Math.sin(elapsed * 8 + p + (a.side > 0 ? 0.6 : 0)) * 0.5;
        a.shoulder.rotation.z = a.side * (0.06 + Math.sin(elapsed * 0.9 + p) * 0.03);
        a.elbow.rotation.x = -0.3 + Math.sin(elapsed * 8 + p) * 0.2;
      } else {
        a.shoulder.rotation.x = Math.sin(elapsed * 1.1 + p + (a.side > 0 ? 0.6 : 0)) * 0.06;
        a.shoulder.rotation.z = a.side * (0.06 + Math.sin(elapsed * 0.9 + p) * 0.03);
        a.elbow.rotation.x = 0;
      }
    }

    // 腿部摆动：走路时前后迈步，站立时归位
    for (const l of this.legs) {
      l.hip.rotation.x = moving
        ? Math.sin(elapsed * 8 + p + (l.side > 0 ? 0.6 : 0)) * 0.45
        : 0;
    }

    // 状态差异化动画：思考时光环加速旋转、执行时身体微前倾、对话时轻微点头
    if (moving) {
      // 走路：身体轻微前倾，光环减速旋转
      this.statusRing.rotation.z += 0.01;
      this.torso.rotation.x = 0.1;
      this.head.rotation.x = 0;
    } else if (state === 'thinking') {
      this.statusRing.rotation.z += 0.05;
      this.head.rotation.x = Math.sin(elapsed * 2.2) * 0.08; // 沉思微点头
      this.torso.rotation.x = 0;
    } else if (state === 'executing') {
      this.statusRing.rotation.z += 0.03;
      this.torso.rotation.x = 0.08 + Math.sin(elapsed * 3) * 0.02; // 前倾忙绿
      this.head.rotation.x = 0;
    } else if (state === 'talking') {
      this.statusRing.rotation.z += 0.02;
      this.head.rotation.x = Math.sin(elapsed * 5) * 0.06; // 说话点头
      this.torso.rotation.x = 0;
    } else {
      this.statusRing.rotation.z += 0.008;
      this.torso.rotation.x = 0;
      this.head.rotation.x = 0;
    }

    // 状态珠浮动 + 光环浮动
    this.statusOrb.position.y = 1.86 + Math.sin(elapsed * 2 + p) * 0.05;
    this.statusRing.position.y = 1.98 + Math.sin(elapsed * 1.5 + p) * 0.02;
  }
}
