/**
 * compiler.js — C++ 在线编译器（原有功能）
 * 通过公共执行 API 编译运行 C++ 代码，无需自建后端。
 * 主端点：Wandbox（无需鉴权）；备用端点：Piston。
 * 说明：需要网络访问；全部失败时返回友好错误信息，不影响其他功能。
 */

const WANDBOX_ENDPOINT = 'https://wandbox.org/api/compile.json';
const PISTON_ENDPOINT = 'https://emkc.org/api/v2/piston/execute';

/** 主端点：Wandbox */
async function runViaWandbox(code, stdin) {
  const resp = await fetch(WANDBOX_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compiler: 'gcc-13.2.0', // 支持 C++20
      code,
      stdin,
      options: '',
      'compiler-option-raw': '-O2'
    })
  });
  if (!resp.ok) throw new Error(`Wandbox HTTP ${resp.status}`);
  const data = await resp.json();
  // 编译错误
  if (data.compiler_error) return { ok: false, isError: true, output: data.compiler_error };
  // 运行错误
  if (data.program_error) return { ok: false, isError: true, output: data.program_error };
  const out = (data.program_output || '').trim();
  return { ok: true, isError: false, output: out || '（程序无输出）' };
}

/** 备用端点：Piston */
async function runViaPiston(code, stdin) {
  const resp = await fetch(PISTON_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'cpp',
      version: '10.2.0', // GCC 10.2，支持 C++17
      files: [{ name: 'main.cpp', content: code }],
      stdin,
      compile_timeout: 10000,
      run_timeout: 10000
    })
  });
  if (!resp.ok) throw new Error(`Piston HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.compile && data.compile.stderr) return { ok: false, isError: true, output: data.compile.stderr };
  const run = data.run || {};
  if (run.stderr) return { ok: false, isError: true, output: run.stderr };
  const out = (run.stdout || '').trim();
  return { ok: true, isError: false, output: out || '（程序无输出）' };
}

/**
 * 编译并运行 C++ 代码（主端点失败自动切换备用端点）
 * @param {string} code 源代码
 * @param {string} stdin 标准输入（可选）
 * @returns {Promise<{ok:boolean, output:string, isError:boolean}>}
 */
export async function runCpp(code, stdin = '') {
  try {
    return await runViaWandbox(code, stdin);
  } catch (e1) {
    try {
      return await runViaPiston(code, stdin);
    } catch {
      return { ok: false, isError: true, output: '网络错误：编译服务暂不可用，请检查网络后重试。' };
    }
  }
}
