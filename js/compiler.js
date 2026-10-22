/**
 * compiler.js — C++ 编程实验室（V1）
 * 默认离线“壳子”模式（满足单机不联网硬约束）：
 *   - 本地静态检查：括号配对、分号、引号、main 函数、include 等基础结构检查；
 *   - 本地模拟运行：生成确定性的模拟控制台输出，并明确标注“模拟”。
 * 可选联网真实编译（用户在界面勾选后生效，需要网络）：
 *   - 主端点 Wandbox；备用端点 Piston。
 * V2：检查与输出文案中英双语（t()）。
 */
import { t } from './i18n.js';

/* ---------------- 离线：基础结构检查 ---------------- */

/**
 * 对 C++ 源码做基础静态检查
 * @returns {{ok:boolean, issues:string[]}}
 */
export function checkCppSyntax(code) {
  const issues = [];
  if (!code || !code.trim()) {
    return { ok: false, issues: [t('cpp.empty')] };
  }
  // 去字符串与注释后的括号配对检查
  let stripped = code
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 块注释
    .replace(/\/\/[^\n]*/g, '')          // 行注释
    .replace(/"(?:[^"\\]|\\.)*"/g, '""') // 字符串字面量
    .replace(/'(?:[^'\\]|\\.)*'/g, "''"); // 字符字面量
  for (const [open, close, nameKey] of [['{', '}', 'cpp.brace'], ['(', ')', 'cpp.paren'], ['[', ']', 'cpp.bracket']]) {
    const o = (stripped.match(new RegExp(`\\${open}`, 'g')) || []).length;
    const c = (stripped.match(new RegExp(`\\${close}`, 'g')) || []).length;
    if (o !== c) issues.push(t('cpp.unpaired', { name: t(nameKey), open, o, close, c }));
  }
  // 常见结构提醒
  if (!/#include\s*<iostream>/.test(code) && /std::cout|std::cin/.test(code)) {
    issues.push(t('cpp.noIostream'));
  }
  if (!/int\s+main\s*\(/.test(code)) {
    issues.push(t('cpp.noMain'));
  }
  // 非 ASCII 全角符号误用
  if (/[；（）｛｝]/.test(code)) {
    issues.push(t('cpp.fullwidth'));
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
      output: t('cpp.checkFail') + '\n' + check.issues.map((i) => `  ✗ ${i}`).join('\n') +
        '\n' + t('cpp.fixHint')
    };
  }
  const lines = code.split('\n').length;
  const coutCount = (code.match(/std::cout|printf/g) || []).length;
  const hasLoop = /\b(for|while)\s*\(/.test(code);
  const out = [
    t('cpp.simTitle'),
    t('cpp.simOk', { lines, cout: coutCount, loop: hasLoop ? t('cpp.simLoop') : '' }),
    t('cpp.simMain'),
    t('cpp.simTip')
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
  return { ok: true, simulated: false, output: (data.program_output || '').trim() || t('cpp.noOutput') };
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
  return { ok: true, simulated: false, output: (run.stdout || '').trim() || t('cpp.noOutput') };
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
      return { ok: false, simulated: false, output: t('cpp.onlineFail') };
    }
  }
}
