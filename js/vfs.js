/**
 * vfs.js — 浏览器虚拟文件系统（V1，纯内存）
 * 用途：编码岗位 Agent“读取、修改代码”的操作对象。
 * 约束：遵循“不做本地保存”，文件仅存于内存，刷新页面后重置；
 *       带修改标记（供代码文件面板展示角标）。
 */

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
// 编码岗位的同事可以读取并修改本文件

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
      updatedBy: 'system',
      updatedAt: Date.now(),
      content:
`# 项目规划笔记

## V1 目标
- [x] 3D 工作室场景与 Agent 可视化
- [x] 右侧流式日志面板
- [ ] 多Agent协作链路稳定化

## 风险
- 本地大模型首次加载需要下载模型权重（可选通道）
`
    },
    {
      name: 'creative_brief.md',
      updatedBy: 'system',
      updatedAt: Date.now(),
      content:
`# 创作简报

## 品牌调性
简约、低多边形、深色科技面板。

## 文案示例
"让一群 AI 同事在虚拟办公室里替你打工。"
`
    }
  ];
}

export class VirtualFS {
  constructor() {
    this.listeners = new Set();
    this.files = seedFiles();
  }

  /** 订阅变更（代码文件面板刷新用） */
  subscribe(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }

  _notify() { this.listeners.forEach((cb) => cb()); }

  list() { return this.files.map((f) => ({ ...f })); }

  get(name) { return this.files.find((f) => f.name === name) || null; }

  read(name) {
    const f = this.get(name);
    if (!f) throw new Error(`文件不存在: ${name}`);
    return f.content;
  }

  /** 写入/新建文件；author 标记修改方（员工姓名或 user） */
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
    this._notify();
    return { ...f };
  }
}

export const vfs = new VirtualFS();
