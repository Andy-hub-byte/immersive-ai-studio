/**
 * compiler.js — C++ 编程实验室（V1）
 * 默认离线“壳子”模式（满足单机不联网硬约束）：
 *   - 本地静态检查：括号配对、分号、引号、main 函数、include 等基础结构检查；
 *   - 本地模拟运行：生成确定性的模拟控制台输出，并明确标注“模拟”。
 * 可选联网真实编译（用户在界面勾选后生效，需要网络）：
 *   - 主端点 Wandbox；备用端点 Piston。
 */

/* ---------------- 离线：基础结构检查 ---------------- */

/**
 * 对 C++ 源码做基础静态检查
 * @returns {{ok:boolean, issues:string[]}}
 */
export function checkCppSyntax(code) {
  const issues = [];
  if (!code || !code.trim()) {
    return { ok: false, issues: ['代码为空'] };
  }
  // 去字符串与注释后的括号配对检查
  let stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 块注释
    .replace(/\/\/[^\n]*/g, '')          // 行注释
    .replace(/"(?:[^"\\]|\\.)*"/g, '""') // 字符串字面量
    .replace(/'(?:[^'\\]|\\.)*'/g, "''"); // 字符字面量
  for (const [open, close, name] of [['{', '}', '花括号'], ['(', ')', '圆括号'], ['[', ']', '方括号']]) {
    const o = (stripped.match(new RegExp(`\\${open}`, 'g')) || []).length;
    const c = (stripped.match(new RegExp(`\\${close}`, 'g')) || []).length;
    if (o !== c) issues.push(`${name}不配对：${open} ${o} 个 / ${close} ${c} 个`);
  }
  // 常见结构提醒
  if (!/#include\s*<iostream>/.test(code) && /std::cout|std::cin/.test(code)) {
    issues.push('使用了 cout/cin 但未 #include <iostream>');
  }
  if (!/int\s+main\s*\(/.test(code)) {
    issues.push('未找到 main 函数入口（int main）');
  }
  // 非 ASCII 全角符号误用
  if (/[；（）｛｝]/.test(code)) {
    issues.push('检测到全角符号（；（）｛｝），C++ 需要半角符号');
  }
  return { ok: issues.length === 0, issues };
}

/**
 * 离线模拟运行：生成确定性输出（明确标注模拟，不冒充真实编译结果）
 * @returns {{ok:boolean, output:string, simulated:true}}
 */
export function simulateRun(code) {
  const check = checkCppSyntax(code);
  if (!check.ok) {
    return {
      ok: false,
      simulated: true,
      output: '[本地模拟运行·结构检查未通过]\n' + check.issues.map((i) => `  ✗ ${i}`).join('\n') +
        '\n请修正后再运行；也可勾选"联网真实编译"获得真实结果。'
    };
  }
  const lines = code.split('\n').length;
  const coutCount = (code.match(/std::cout|printf/g) || []).length;
  const hasLoop = /\b(for|while)\s*\(/.test(code);
  const out = [
    '[本地模拟运行]（V1 离线壳子，非真实编译输出）',
    `✓ 结构检查通过：${lines} 行，${coutCount} 处输出语句${hasLoop ? '，含循环结构' : ''}`,
    '✓ main 函数入口就绪',
    '提示：勾选右上角"联网真实编译"可连接在线编译器获得真实运行结果。'
  ].join('\n');
  return { ok: true, simulated: true, output: out };
}

/* ---------------- 可选：联网真实编译 ---------------- */

const WANDBOX_ENDPOINT = 'https://wandbox.org/api/compile.json';
const PISTON_ENDPOINT = 'https://emkc.org/api/v2/piston/execute';

async function runViaWandbox(code, stdin) {
  const resp = await fetch(WANDBOX_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ compiler: 'gcc-13.2.0', code, stdin, options: '', 'compiler-option-raw': '-O2' })
  });
  if (!resp.ok) throw new Error(`Wandbox HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.compiler_error) return { ok: false, simulated: false, output: data.compiler_error };
  if (data.program_error) return { ok: false, simulated: false, output: data.program_error };
  return { ok: true, simulated: false, output: (data.program_output || '').trim() || '（程序无输出）' };
}

async function runViaPiston(code, stdin) {
  const resp = await fetch(PISTON_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'cpp', version: '10.2.0',
      files: [{ name: 'main.cpp', content: code }],
      stdin, compile_timeout: 10000, run_timeout: 10000
    })
  });
  if (!resp.ok) throw new Error(`Piston HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.compile && data.compile.stderr) return { ok: false, simulated: false, output: data.compile.stderr };
  const run = data.run || {};
  if (run.stderr) return { ok: false, simulated: false, output: run.stderr };
  return { ok: true, simulated: false, output: (run.stdout || '').trim() || '（程序无输出）' };
}

/**
 * 运行 C++ 代码
 * @param {string} code 源代码
 * @param {object} opts { online:boolean } 是否联网真实编译
 * @returns {Promise<{ok:boolean, output:string, simulated:boolean}>}
 */
export async function runCpp(code, { online = false } = {}) {
  if (!online) return simulateRun(code);           // 默认离线壳子
  try {
    return await runViaWandbox(code, '');
  } catch {
    try {
      return await runViaPiston(code, '');
    } catch {
      return { ok: false, simulated: false, output: '联网编译失败：网络不可达。已保持离线模式可用，可取消勾选"联网真实编译"。' };
    }
  }
}
