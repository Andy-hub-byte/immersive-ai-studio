/**
 * vfs.js — 浏览器虚拟文件系统（原有功能）
 * 用途：编码Agent“读取、修改代码”的操作对象。
 * 存储：localStorage 持久化；带修改标记（供代码文件面板展示角标）。
 */

const STORAGE_KEY = 'ai-studio-vfs-v1';

/** 初始种子文件 */
function seedFiles() {
  return [
    {
      name: 'main.cpp',
      updatedBy: 'system',
      updatedAt: Date.now(),
      content:
`#include <iostream>
#include <vector>
#include <string>

// 虚拟AI工作室 · 示例程序
// 编码Agent可以读取并修改本文件

int main() {
    std::vector<std::string> agents = {"planner", "coder", "artist"};
    std::cout << "Studio agents online: " << agents.size() << std::endl;
    for (const auto& a : agents) {
        std::cout << " - " << a << std::endl;
    }
    return 0;
}
`
    },
    {
      name: 'planner_notes.md',
      updatedBy: 'planner',
      updatedAt: Date.now(),
      content:
`# 项目规划笔记（规划Agent维护）

## V1 目标
- [x] 3D 工作室场景与 Agent 可视化
- [x] 右侧流式日志面板
- [ ] 多Agent协作链路稳定化

## 风险
- 本地大模型首次加载需要下载模型权重
`
    },
    {
      name: 'creative_brief.md',
      updatedBy: 'artist',
      updatedAt: Date.now(),
      content:
`# 创作简报（创作Agent维护）

## 品牌调性
简约、低多边形、深色科技面板。

## 文案示例
"让三个AI Agent在虚拟办公室里替你打工。"
`
    }
  ];
}

export class VirtualFS {
  constructor() {
    this.listeners = new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.files = raw ? JSON.parse(raw) : seedFiles();
    } catch {
      this.files = seedFiles();
    }
    if (!Array.isArray(this.files) || this.files.length === 0) this.files = seedFiles();
  }

  _persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.files)); } catch { /* 存储满时静默 */ }
    this.listeners.forEach((cb) => cb());
  }

  /** 订阅变更（代码文件面板刷新用） */
  subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }

  list() { return this.files.map((f) => ({ ...f })); }

  get(name) { return this.files.find((f) => f.name === name) || null; }

  read(name) {
    const f = this.get(name);
    if (!f) throw new Error(`文件不存在: ${name}`);
    return f.content;
  }

  /** 写入/新建文件；author 标记修改方（如 coder） */
  write(name, content, author = 'user') {
    let f = this.get(name);
    if (!f) {
      f = { name, content, updatedBy: author, updatedAt: Date.now() };
      this.files.push(f);
    } else {
      f.content = content;
      f.updatedBy = author;
      f.updatedAt = Date.now();
    }
    this._persist();
    return { ...f };
  }
}

export const vfs = new VirtualFS();
