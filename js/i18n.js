/**
 * i18n.js — 中英双语 / bilingual language module（V2 新增）
 *
 * 功能：
 *  - 全站文案中英词典（静态 HTML 用 data-i18n 属性，动态 JS 用 t() 函数）；
 *  - 首次进入弹出语言选择弹窗（中文 / English），选择记入 localStorage；
 *  - 之后可随时通过 HUD 右上角「🌐」按钮一键切换，切换后全界面即时刷新；
 *  - 切换时派发 window 'langchange' 事件，各模块监听后重渲染动态文本。
 *
 * 用法：
 *   import { t, getLang, setLang, pick, initLangPicker, onLangChange } from './i18n.js';
 *   t('hud.chat')                       // → 'AI连接' 或 'AI Connect'
 *   t('agent.hired', { name: '小码' })   // 变量插值 {name}
 *   pick(StateMeta[state].label)        // {zh,en} 对象按当前语言取值
 *   onLangChange(() => this.render())   // 语言切换后重渲染
 */

const LS_KEY = 'ai-studio-lang-v1';

/* ================= 词典 / dictionary ================= */
const DICT = {
  zh: {
    /* —— HUD / 侧栏 / 面板静态文本（与 index.html data-i18n 对应） —— */
    'html.lang': 'zh-CN',
    'hud.brand': '虚拟AI工作室',
    'hud.brandSub': 'Immersive AI Studio · V1',
    'hud.chat': 'AI连接',
    'hud.code': 'C++实验室',
    'hud.files': '代码文件',
    'hud.langBtn': '🌐 EN',
    'hud.langTitle': '切换语言 / Switch language',
    'dpad.ariaUp': '前进', 'dpad.ariaLeft': '左移', 'dpad.ariaRight': '右移', 'dpad.ariaDown': '后退',
    'hints.move': '移动', 'hints.sprint': '加速',
    'hints.clickAgent': '点击AI小人 · 查看详情',
    'hints.touch': '触屏：方向键移动 · 拖动转视角',
    'side.title': '工作室控制台',
    'side.subtitle': 'Agent 状态 · 流式日志',
    'side.clear': '清屏',
    'side.clearTitle': '清空日志',
    'side.agents': 'AI 员工',
    'side.addNamePh': '新员工名称（≤8字）',
    'side.addRolePh': '岗位（如：测试）',
    'side.addBtn': '添加',
    'side.addHint': '默认 3 人，可添加至 10 人',
    'log.filterAll': '全部', 'log.filterThought': '思考', 'log.filterMessage': '消息', 'log.filterSystem': '系统',
    'side.targetPh': '选择 Agent…',
    'side.inputPh': '输入指令，Enter 发送',
    'side.send': '私聊发送',
    'side.broadcast': '全体广播',
    'side.broadcastTitle': '发送给场景内所有在岗Agent，各自认领匹配岗位的任务',
    'chat.title': 'AI 连接设置',
    'chat.close': '关闭',
    'chat.modeDemo': '演示模式', 'chat.modeDemoBadge': '推荐初次体验',
    'chat.modeDemoSub': '即时体验全部交互，无需下载模型',
    'chat.modeWebllm': 'WebLLM 本地推理', 'chat.modeWebllmBadge': '真实 AI',
    'chat.modeWebllmSub': '加载 Qwen3-1.7B 模型，AI 在你的设备本地运行，无费用、无密钥，首次需要下载模型文件',
    'chat.tip': '提示：WebLLM 需要 WebGPU 支持（Chrome / Edge 等新版浏览器）；平板运行时轻微发热；首次下载模型建议连接 WiFi。',
    'chat.loadModel': '加载模型',
    'chat.model1': 'Qwen3-1.7B（约 1.1GB·推荐）',
    'chat.model2': 'Qwen3-4B（约 2.5GB·更聪明）',
    'chat.model3': 'Qwen2.5-1.5B（约 1GB·旧设备兼容）',
    'chat.apiAdv': '高级选项：在线 API（OpenAI 兼容接口）',
    'chat.apiCurrent': '· 当前模式',
    'chat.apiBasePh': '接口地址，如 https://api.deepseek.com/v1',
    'chat.apiKeyPh': 'API Key（仅保存在本机浏览器）',
    'chat.apiModelPh': '模型名，如 deepseek-chat',
    'chat.useApi': '使用在线 API',
    'chat.saveApi': '保存配置',
    'chat.test': '测试连接',
    'chat.testHint': '点击验证当前 AI 通道能否正常响应',
    'chat.llmPh': '与当前 AI 通道直接对话（测试用）…',
    'chat.send': '发送',
    'code.title': 'C++ 编程实验室',
    'code.online': '联网真实编译',
    'code.onlineTitle': '勾选后连接在线编译器（Wandbox/Piston）真实编译运行，需要网络',
    'code.save': '保存',
    'code.run': '运行',
    'files.title': '代码文件',
    'files.meta': '选择文件查看内容',
    'detail.roleLabel': '岗位',
    'detail.status': '状态',
    'detail.close': '关闭',
    'detail.station': '工位',
    'detail.task': '当前任务',
    'detail.history': '对话记录',
    'detail.none': '暂无',
    'detail.talk': '发起对话',
    'detail.goto': '定位视角',
    'loading.text': '正在构建低多边形工作室…',
    'lang.title': '选择语言',
    'lang.sub': '首次进入请选择界面语言，之后可随时在右上角切换',
    'lang.subEn': 'Pick your language — you can switch anytime from the top bar.',
    'lang.zh': '中文',
    'lang.zhSub': '简体中文界面',
    'lang.en': 'English',
    'lang.enSub': 'English interface',

    /* —— 状态标签（config.js StateMeta） —— */
    'state.idle': '空闲', 'state.thinking': '思考中', 'state.executing': '执行任务', 'state.talking': '对话中',

    /* —— 工位标签（config.js AGENT_SLOTS） —— */
    'slot.1': '后墙工位 1', 'slot.2': '后墙工位 2', 'slot.3': '后墙工位 3',
    'slot.4': '左墙工位 1', 'slot.5': '左墙工位 2',
    'slot.6': '右墙工位 1', 'slot.7': '右墙工位 2',
    'slot.8': '会议区站位 1', 'slot.9': '会议区站位 2', 'slot.10': '会议区站位 3',

    /* —— 通用 —— */
    'you': '你',
    'allAgents': '全体Agent',
    'user': '用户',

    /* —— main.js 系统消息 —— */
    'sys.ready': '工作室已就绪。默认使用「离线AI引擎」，无需联网即可体验全部功能。',
    'sys.selectHint': '点击 3D 场景中的 AI 员工或左侧列表可选中；选中后即可下发任务指令。',
    'sys.noWebgl': '当前设备不支持 WebGL，3D 场景与 AI 员工团队暂不可用；AI 助手对话、长期记忆、C++ 实验室仍可正常使用。',
    'bubble.here': '我在，请说。',
    'sys.initialAgents': '已加载 {n} 名初始员工（默认数量，节省渲染开销）。',
    'sys.addHint': '在下方「添加员工」中输入名称与岗位，可逐步扩充团队（上限 10 人）。',

    /* —— logPanel —— */
    'log.empty': '暂无员工，请在下方添加（最多10人）',
    'log.detailBtn': '详情', 'log.detailTitle': '查看详情',
    'log.removeBtn': '移除', 'log.removeTitle': '移除该员工',
    'log.selectFirst': '请先选中一个 Agent（点击 3D 员工 / 列表卡片），或使用「全体广播」。',
    'log.broadcastEmpty': '请输入广播内容后再发送。',
    'log.nameEmpty': '请输入员工名称后再添加。',
    'log.nameLong': '名称请控制在 8 个字符以内。',
    'log.addFail': '添加失败：员工数量已达上限（10人），或名称「{name}」已存在。',
    'log.full': '已满10人',
    'log.fullHint': '员工数量已达上限',
    'log.count': '当前 {n}/10 人',
    'log.targetPh': '选择员工…',
    'log.typeThought': '思考', 'log.typeMessage': '消息', 'log.typeSystem': '系统', 'log.typeState': '状态', 'log.typeAction': '动作',
    'log.enterState': '进入「{label}」状态',
    'log.cleared': '日志已清空。',

    /* —— agents.js —— */
    'agent.queued': '「{name}」正在执行任务，指令已排队（第 {n} 位），完成当前任务后自动处理。',
    'agent.blocked': '移动途中碰到障碍物，已停止移动（禁止穿墙），在原地继续执行任务。',
    'agent.arrived': '已到达{slot}的目标办公桌位置。',
    'agent.going': '前往{slot}的目标位置',
    'agent.thinking': '正在思考…',
    'agent.executing': '正在执行任务…',
    'agent.talking': '对话中',
    'agent.returning': '任务完成，返回工位',
    'agent.returned': '已返回工位，原地待命。',
    'agent.returnBlocked': '返回工位途中被障碍物阻挡，已停止移动。',
    'agent.queueErr': '「{name}」处理排队指令出错：{err}',
    'agent.hired': '新员工「{name}」（{role}）入职，工位：{slot}。',
    'agent.left': '员工「{name}」已离职。',
    'agent.noAgents': '当前场景内没有在岗 Agent，广播无效。',
    'agent.broadcastSent': '广播已发送给 {n} 名在岗 Agent，各员工开始自主认领…',
    'agent.busySkip': '「{name}」岗位匹配但正在执行其他任务，本次广播不参与。',
    'agent.claimed': '认领广播任务：「{text}」',
    'agent.dupClaim': '「{name}」同岗位已有同事认领，本人在工位待命，不重复执行。',
    'agent.notMine': '「{name}」认为该任务不属于自身职责范围，留在工位待命。',
    'agent.located': '视角已定位到 {name} 的工位（{slot}）。',
    'agent.collabFrom': '（来自 {name} 的协作消息）',
    'agent.depthMax': '协作深度已达上限，停止继续转派。',
    'agent.noColleague': '未找到名为「{name}」的同事，转派取消。',
    'agent.readFile': '读取文件 {name}（{lines}）',
    'agent.newFile': '新文件',
    'unit.lines': '{n} 行',
    'agent.analyzing': '分析修改点并生成新版本…',
    'agent.fileUpdated': '已{verb} {name}（{diff} 行，共 {total} 行）',
    'agent.verbMod': '修改', 'agent.verbNew': '新建',
    'agent.bubbleUpdated': '已更新 {name}',
    'sys.coderFiles': '虚拟文件系统当前文件：{files}',
    'sys.coderFilesEmpty': '（空）',
    'prompt.planner': '你是虚拟AI工作室的"规划"岗位员工，负责需求分析与任务拆解，回答结构化、简洁。需要他人落地实现时，在回复末尾另起一行输出 [TO:对方名字] 具体指令。',
    'prompt.coder': '你是虚拟AI工作室的"编码"岗位员工，负责编写与修改代码，操作对象是虚拟文件系统。被要求修改代码时，先说明读取了哪个文件，然后用一个 ```cpp 代码块输出该文件的完整新内容。',
    'prompt.artist': '你是虚拟AI工作室的"创作"岗位员工，负责文案、创意与内容设计，回答有创意、简洁。除非用户明确要求协作，不要输出 [TO:xxx] 指令。',
    'prompt.generic': '你是虚拟AI工作室的一名 AI 员工，请根据岗位职责专业、简洁地完成任务。需要同事协作时，可输出 [TO:对方名字] 具体指令。',
    'reply.planner': '收到需求：「{text}」\n我的拆解方案：\n1. 明确目标与验收标准；\n2. 划分模块：核心逻辑 → 数据结构 → 交互层；\n3. 排期：设计 0.5 天 / 实现 1 天 / 联调 0.5 天；\n4. 风险：本地资源与性能需提前验证。',
    'reply.plannerTo': '\n[TO:{name}] 请按上述方案实现核心功能，并更新 main.cpp。',
    'reply.coder': '已读取 {name}（{lines}），按需求修改如下：',
    'reply.artist': '为「{text}」准备了三版创意方向：\n1. 《把重复交给 AI，把创造留给自己》——理性共鸣向；\n2. 《一群不会下班的 AI 打工人》——故事向；\n3. 《你的团队，24 小时在线》——效率向。\n建议搭配低多边形办公室视觉，强化"沉浸式"体感。',
    'reply.generic': '（{role}）已接获任务：「{text}」\n执行思路：\n1. 明确交付物与验收标准；\n2. 拆解为可并行的子任务；\n3. 按时序推进并同步风险。\n如需其他岗位协作，可在指令中 @对应同事。',
    'code.cmtSort': '由 {name} 追加：冒泡排序',
    'code.cmtFib': '由 {name} 追加：斐波那契',
    'code.cmtStatus': '由 {name} 追加：工作室状态打印',

    /* —— uiPanels —— */
    'ui.switched': '已切换 AI 运行模式：{status}',
    'ui.memConfirm': '确认清除？',
    'ui.memClear': '清除记忆',
    'ui.memCleared': '已清除全部长期记忆（仅清空本机浏览器保存的记录）。',
    'ui.modelNotLoaded': '本地模型尚未加载。请点击「加载模型」下载并启动（需要支持 WebGPU 的浏览器，如 Chrome 113+）。未加载时 Agent 会自动使用演示模式（离线引擎）。',
    'ui.webllmTip': '提示：WebLLM 需要 WebGPU 支持（Chrome / Edge 等新版浏览器）；平板运行时轻微发热；首次下载模型建议连接 WiFi。',
    'ui.noWebgpu': '当前浏览器不支持 WebGPU，无法加载本地模型。可继续使用演示模式，或展开「高级选项」配置在线 API。',
    'ui.modelReady': '模型 {id} 已就绪，工作室 Agent 将自动改用它推理。',
    'ui.modelFail': '加载失败：{err}。可继续使用演示模式体验平台功能。',
    'ui.apiSaved': '在线 API 配置已保存：{model}，已自动切换为在线 API 模式。可点击「测试连接」验证。',
    'ui.apiNoKey': '配置已保存，但 API Key 为空，请填写后再测试。',
    'ui.chatFail': '调用失败：{err}。请检查配置或切换回离线AI引擎。',
    'ui.chatSys': '你是虚拟AI工作室搭载的 AI 助手，回答简洁、友好，使用中文。',
    'ui.testing': '测试中…',
    'ui.testResult': '（耗时 {ms}ms）',
    'ui.cppConnecting': '正在连接在线编译器…',
    'ui.cppLocal': '本地检查并模拟运行中…',
    'ui.cppSaved': '已保存到虚拟文件系统：{name}',
    'ui.fileBadge': '{name} 修改过',
    'ui.fileMeta': '{name} · {lines} 行 · 最近修改：{by} · {time}',

    /* —— detailPanel —— */
    'detail.noTask': '暂无进行中的任务',
    'detail.noHistory': '暂无对话记录，选中后下发任务或点击「发起对话」开始交流。',
    'detail.stationOf': '工位：{label}',

    /* —— webllm —— */
    'llm.statusLocal': '本地模型就绪（{id}）',
    'llm.statusNoLocal': '本地模型未加载',
    'llm.statusApi': '在线API：{model}',
    'llm.statusNoApi': '在线API未配置',
    'llm.statusDemo': '演示模式（离线规则引擎）',
    'llm.loading': '模型正在加载中，请稍候…',
    'llm.noWebgpu': '当前浏览器不支持 WebGPU。请使用 Chrome 113+ / Edge 最新版；或改用在线API / 离线引擎。',
    'llm.gettingEngine': '正在获取推理引擎…',
    'llm.initEngine': '正在初始化引擎…',
    'llm.downloading': '下载/初始化模型 {p}%',
    'llm.engineFail': '无法加载 WebLLM 引擎（CDN 不可达）',
    'llm.apiIncomplete': '在线API未配置完整（需要地址、密钥、模型名）',
    'llm.apiHttp': 'API 返回 HTTP {status}：{text}',
    'llm.offlineNotReady': '（离线引擎未就绪）',
    'llm.testApiOk': '在线API连接成功，模型回复：{r}',
    'llm.testLocalNoLoad': '本地模型尚未加载，请先点击"加载模型"',
    'llm.testLocalOk': '本地模型连接成功，回复：{r}',
    'llm.testOfflineOk': '离线引擎工作正常（内置规则引擎，无需联网）',
    'llm.probe': '请回复：连接成功',

    /* —— memory.js —— */
    'mem.nameUser': '你',
    'mem.nameAi': 'AI',
    'mem.nameAgent': 'Agent',
    'mem.summary': '【历史记忆】以下是本机浏览器中保存的近期对话（供你保持上下文连贯，即使用户换了一种问法也能对应上；没有相关信息时忽略即可）：',
    'mem.chipEmpty': '🧠 记忆：空',
    'mem.chip': '🧠 记忆：{n} 条',

    /* —— compiler.js —— */
    'cpp.empty': '代码为空',
    'cpp.brace': '花括号', 'cpp.paren': '圆括号', 'cpp.bracket': '方括号',
    'cpp.unpaired': '{name}不配对：{open} {o} 个 / {close} {c} 个',
    'cpp.noIostream': '使用了 cout/cin 但未 #include <iostream>',
    'cpp.noMain': '未找到 main 函数入口（int main）',
    'cpp.fullwidth': '检测到全角符号（；（）｛｝），C++ 需要半角符号',
    'cpp.checkFail': '[本地模拟运行·结构检查未通过]',
    'cpp.fixHint': '请修正后再运行；也可勾选"联网真实编译"获得真实结果。',
    'cpp.simTitle': '[本地模拟运行]（V1 离线壳子，非真实编译输出）',
    'cpp.simOk': '✓ 结构检查通过：{lines} 行，{cout} 处输出语句{loop}',
    'cpp.simLoop': '，含循环结构',
    'cpp.simMain': '✓ main 函数入口就绪',
    'cpp.simTip': '提示：勾选右上角"联网真实编译"可连接在线编译器获得真实运行结果。',
    'cpp.noOutput': '（程序无输出）',
    'cpp.onlineFail': '联网编译失败：网络不可达。已保持离线模式可用，可取消勾选"联网真实编译"。'
  },

  en: {
    /* —— HUD / side panel / panels —— */
    'html.lang': 'en',
    'hud.brand': 'Immersive AI Studio',
    'hud.brandSub': '虚拟AI工作室 · V1',
    'hud.chat': 'AI Connect',
    'hud.code': 'C++ Lab',
    'hud.files': 'Code Files',
    'hud.langBtn': '🌐 中文',
    'hud.langTitle': 'Switch language / 切换语言',
    'dpad.ariaUp': 'Forward', 'dpad.ariaLeft': 'Left', 'dpad.ariaRight': 'Right', 'dpad.ariaDown': 'Back',
    'hints.move': 'Move', 'hints.sprint': 'Sprint',
    'hints.clickAgent': 'Click an AI agent · view details',
    'hints.touch': 'Touch: D-pad to move · drag to look around',
    'side.title': 'Studio Console',
    'side.subtitle': 'Agent status · live log',
    'side.clear': 'Clear',
    'side.clearTitle': 'Clear log',
    'side.agents': 'AI Agents',
    'side.addNamePh': 'New agent name (≤8 chars)',
    'side.addRolePh': 'Role (e.g. QA)',
    'side.addBtn': 'Add',
    'side.addHint': '3 by default, up to 10 total',
    'log.filterAll': 'All', 'log.filterThought': 'Thinking', 'log.filterMessage': 'Messages', 'log.filterSystem': 'System',
    'side.targetPh': 'Select agent…',
    'side.inputPh': 'Type a command, Enter to send',
    'side.send': 'Send',
    'side.broadcast': 'Broadcast',
    'side.broadcastTitle': 'Send to all on-duty agents; each claims matching tasks by role',
    'chat.title': 'AI Connection',
    'chat.close': 'Close',
    'chat.modeDemo': 'Demo mode', 'chat.modeDemoBadge': 'Best for first try',
    'chat.modeDemoSub': 'Instant full experience, no model download',
    'chat.modeWebllm': 'WebLLM local inference', 'chat.modeWebllmBadge': 'Real AI',
    'chat.modeWebllmSub': 'Loads Qwen3-1.7B to run locally on your device — free, no API key, first-time model download required',
    'chat.tip': 'Note: WebLLM requires WebGPU (Chrome / Edge latest); the tablet may warm up slightly; use WiFi for the first model download.',
    'chat.loadModel': 'Load model',
    'chat.model1': 'Qwen3-1.7B (~1.1GB·recommended)',
    'chat.model2': 'Qwen3-4B (~2.5GB·smarter)',
    'chat.model3': 'Qwen2.5-1.5B (~1GB·older devices)',
    'chat.apiAdv': 'Advanced: Online API (OpenAI-compatible)',
    'chat.apiCurrent': '· current mode',
    'chat.apiBasePh': 'Base URL, e.g. https://api.deepseek.com/v1',
    'chat.apiKeyPh': 'API Key (stored in this browser only)',
    'chat.apiModelPh': 'Model name, e.g. deepseek-chat',
    'chat.useApi': 'Use online API',
    'chat.saveApi': 'Save config',
    'chat.test': 'Test connection',
    'chat.testHint': 'Verify that the current AI channel responds',
    'chat.llmPh': 'Chat directly with the current AI channel (test)…',
    'chat.send': 'Send',
    'code.title': 'C++ Lab',
    'code.online': 'Real online compile',
    'code.onlineTitle': 'Compile & run for real via online compilers (Wandbox/Piston) — requires network',
    'code.save': 'Save',
    'code.run': 'Run',
    'files.title': 'Code Files',
    'files.meta': 'Select a file to view its contents',
    'detail.roleLabel': 'Role',
    'detail.status': 'Status',
    'detail.close': 'Close',
    'detail.station': 'Station',
    'detail.task': 'Current task',
    'detail.history': 'Conversation',
    'detail.none': 'None',
    'detail.talk': 'Start chat',
    'detail.goto': 'Locate view',
    'loading.text': 'Building the low-poly studio…',
    'lang.title': 'Choose Language',
    'lang.sub': 'Please pick your interface language',
    'lang.subEn': '首次进入请选择界面语言，之后可随时在右上角切换。',
    'lang.zh': '中文',
    'lang.zhSub': '简体中文界面',
    'lang.en': 'English',
    'lang.enSub': 'English interface',

    /* —— state labels —— */
    'state.idle': 'Idle', 'state.thinking': 'Thinking', 'state.executing': 'Executing', 'state.talking': 'Talking',

    /* —— slot labels —— */
    'slot.1': 'Back-wall desk 1', 'slot.2': 'Back-wall desk 2', 'slot.3': 'Back-wall desk 3',
    'slot.4': 'Left-wall desk 1', 'slot.5': 'Left-wall desk 2',
    'slot.6': 'Right-wall desk 1', 'slot.7': 'Right-wall desk 2',
    'slot.8': 'Meeting spot 1', 'slot.9': 'Meeting spot 2', 'slot.10': 'Meeting spot 3',

    /* —— common —— */
    'you': 'You',
    'allAgents': 'All agents',
    'user': 'User',

    /* —— main.js —— */
    'sys.ready': 'Studio ready. Using the offline AI engine by default — no internet needed.',
    'sys.selectHint': 'Click an AI agent in the 3D scene (or the list) to select it, then send tasks.',
    'sys.noWebgl': 'WebGL is unavailable on this device: the 3D scene and agent team are paused. AI chat, long-term memory and the C++ lab still work.',
    'bubble.here': "I'm here — go ahead.",
    'sys.initialAgents': '{n} initial agents loaded (default count, saves rendering cost).',
    'sys.addHint': 'Add name & role below to grow the team (max 10).',

    /* —— logPanel —— */
    'log.empty': 'No agents yet — add some below (max 10)',
    'log.detailBtn': 'Details', 'log.detailTitle': 'View details',
    'log.removeBtn': 'Remove', 'log.removeTitle': 'Remove this agent',
    'log.selectFirst': 'Select an agent first (click in the 3D scene / a card), or use Broadcast.',
    'log.broadcastEmpty': 'Type a broadcast message before sending.',
    'log.nameEmpty': 'Enter an agent name first.',
    'log.nameLong': 'Name must be 8 characters or fewer.',
    'log.addFail': 'Add failed: team is full (10) or the name "{name}" already exists.',
    'log.full': 'Full (10)',
    'log.fullHint': 'Team is at capacity',
    'log.count': '{n}/10 agents',
    'log.targetPh': 'Select agent…',
    'log.typeThought': 'Thinking', 'log.typeMessage': 'Message', 'log.typeSystem': 'System', 'log.typeState': 'State', 'log.typeAction': 'Action',
    'log.enterState': 'Entered "{label}" state',
    'log.cleared': 'Log cleared.',

    /* —— agents.js —— */
    'agent.queued': '"{name}" is busy — your command is queued (#{n}) and will run after the current task.',
    'agent.blocked': 'Blocked by an obstacle mid-walk, movement stopped (no wall clipping); continuing the task in place.',
    'agent.arrived': 'Arrived at the target desk of {slot}.',
    'agent.going': 'Heading to the target desk of {slot}',
    'agent.thinking': 'Thinking…',
    'agent.executing': 'Executing…',
    'agent.talking': 'In conversation',
    'agent.returning': 'Task done — returning to station',
    'agent.returned': 'Back at station, standing by.',
    'agent.returnBlocked': 'Blocked by an obstacle on the way back; movement stopped.',
    'agent.queueErr': '"{name}" failed on a queued command: {err}',
    'agent.hired': 'New agent "{name}" ({role}) onboarded — station: {slot}.',
    'agent.left': 'Agent "{name}" has left.',
    'agent.noAgents': 'No on-duty agents in the scene — broadcast ignored.',
    'agent.broadcastSent': 'Broadcast sent to {n} on-duty agents; they are claiming tasks…',
    'agent.busySkip': '"{name}" matches the role but is busy with another task — skipped this broadcast.',
    'agent.claimed': 'Claimed broadcast task: "{text}"',
    'agent.dupClaim': 'A colleague with the same role already claimed it — "{name}" stands by.',
    'agent.notMine': '"{name}" judged this outside their role — standing by.',
    'agent.located': "View located at {name}'s station ({slot}).",
    'agent.collabFrom': '(collaboration message from {name})',
    'agent.depthMax': 'Max collaboration depth reached — stopping delegation.',
    'agent.noColleague': 'No colleague named "{name}" — delegation cancelled.',
    'agent.readFile': 'Read file {name} ({lines})',
    'agent.newFile': 'new file',
    'unit.lines': '{n} lines',
    'agent.analyzing': 'Analyzing changes and generating a new version…',
    'agent.fileUpdated': '{verb} {name} ({diff} lines, {total} total)',
    'agent.verbMod': 'Modified', 'agent.verbNew': 'Created',
    'agent.bubbleUpdated': 'Updated {name}',
    'sys.coderFiles': 'Virtual file system files: {files}',
    'sys.coderFilesEmpty': '(empty)',
    'prompt.planner': 'You are the "planning" agent at Immersive AI Studio, responsible for requirements analysis and task breakdown. Answer in a structured, concise way. When someone else must implement it, output a line at the end: [TO:their name] specific instruction.',
    'prompt.coder': 'You are the "coding" agent at Immersive AI Studio, writing and modifying code in the virtual file system. When asked to change code, first state which file you read, then output the complete new file content in one ```cpp code block.',
    'prompt.artist': 'You are the "creative" agent at Immersive AI Studio, handling copywriting, ideas and content design. Be creative and concise. Do not output [TO:xxx] instructions unless the user explicitly asks for collaboration.',
    'prompt.generic': 'You are an AI agent at Immersive AI Studio. Complete tasks professionally and concisely according to your role. When you need a colleague, output [TO:their name] specific instruction.',
    'reply.planner': 'Request received: "{text}"\nMy breakdown:\n1. Define goals and acceptance criteria;\n2. Split modules: core logic → data structures → interaction layer;\n3. Schedule: design 0.5d / implementation 1d / integration 0.5d;\n4. Risk: verify local resources and performance early.',
    'reply.plannerTo': '\n[TO:{name}] Please implement the core features per the plan above and update main.cpp.',
    'reply.coder': 'Read {name} ({lines}); modified per request:',
    'reply.artist': 'Three creative directions for "{text}":\n1. "Let AI handle the repeats, keep the creating to yourself" — rational resonance;\n2. "A team of AI workers that never clock out" — storytelling;\n3. "Your team, online 24/7" — efficiency.\nPair with the low-poly office look for an immersive feel.',
    'reply.generic': '({role}) Task received: "{text}"\nApproach:\n1. Clarify deliverables and acceptance criteria;\n2. Split into parallel subtasks;\n3. Progress in order and flag risks.\nMention @colleague in your command to involve other roles.',
    'code.cmtSort': 'added by {name}: bubble sort',
    'code.cmtFib': 'added by {name}: fibonacci',
    'code.cmtStatus': 'added by {name}: studio status print',

    /* —— uiPanels —— */
    'ui.switched': 'AI mode switched: {status}',
    'ui.memConfirm': 'Confirm clear?',
    'ui.memClear': 'Clear memory',
    'ui.memCleared': 'All long-term memory cleared (only records stored in this browser).',
    'ui.modelNotLoaded': 'Local model not loaded yet. Click "Load model" to download and start it (needs a WebGPU-capable browser such as Chrome 113+). Until then agents use the demo mode (offline engine).',
    'ui.webllmTip': 'Note: WebLLM requires WebGPU (Chrome / Edge latest); the tablet may warm up slightly; use WiFi for the first model download.',
    'ui.noWebgpu': 'This browser does not support WebGPU, so the local model cannot load. Keep using demo mode, or expand "Advanced" to configure an online API.',
    'ui.modelReady': 'Model {id} is ready — studio agents will use it automatically.',
    'ui.modelFail': 'Load failed: {err}. Demo mode is still available.',
    'ui.apiSaved': 'Online API config saved: {model}. Switched to online API mode automatically — click "Test connection" to verify.',
    'ui.apiNoKey': 'Config saved, but the API Key is empty. Fill it in before testing.',
    'ui.chatFail': 'Call failed: {err}. Check the config or switch back to the offline AI engine.',
    'ui.chatSys': 'You are the AI assistant aboard Immersive AI Studio. Keep replies concise and friendly, in English.',
    'ui.testing': 'Testing…',
    'ui.testResult': '({ms}ms)',
    'ui.cppConnecting': 'Connecting to the online compiler…',
    'ui.cppLocal': 'Checking and simulating locally…',
    'ui.cppSaved': 'Saved to the virtual file system: {name}',
    'ui.fileBadge': 'modified by {name}',
    'ui.fileMeta': '{name} · {lines} lines · last edit: {by} · {time}',

    /* —— detailPanel —— */
    'detail.noTask': 'No active task',
    'detail.noHistory': 'No conversation yet — select the agent and send a task, or click "Start chat".',
    'detail.stationOf': 'Station: {label}',

    /* —— webllm —— */
    'llm.statusLocal': 'Local model ready ({id})',
    'llm.statusNoLocal': 'Local model not loaded',
    'llm.statusApi': 'Online API: {model}',
    'llm.statusNoApi': 'Online API not configured',
    'llm.statusDemo': 'Demo mode (offline rules)',
    'llm.loading': 'A model is already loading, please wait…',
    'llm.noWebgpu': 'WebGPU is not supported. Use Chrome 113+ / latest Edge, or switch to the online API / offline engine.',
    'llm.gettingEngine': 'Fetching the inference engine…',
    'llm.initEngine': 'Initializing the engine…',
    'llm.downloading': 'Downloading/initializing model {p}%',
    'llm.engineFail': 'Cannot load the WebLLM engine (CDN unreachable)',
    'llm.apiIncomplete': 'Online API config incomplete (base URL, key and model name required)',
    'llm.apiHttp': 'API returned HTTP {status}: {text}',
    'llm.offlineNotReady': '(offline engine not ready)',
    'llm.testApiOk': 'Online API connected — model replied: {r}',
    'llm.testLocalNoLoad': 'Local model not loaded yet — click "Load model" first',
    'llm.testLocalOk': 'Local model connected — replied: {r}',
    'llm.testOfflineOk': 'Offline engine works fine (built-in rules, no internet needed)',
    'llm.probe': 'Please reply with: connection OK',

    /* —— memory.js —— */
    'mem.nameUser': 'You',
    'mem.nameAi': 'AI',
    'mem.nameAgent': 'Agent',
    'mem.summary': '【Memory】Recent conversations saved in this browser (use them to stay contextually consistent; ignore when irrelevant):',
    'mem.chipEmpty': '🧠 Memory: empty',
    'mem.chip': '🧠 Memory: {n}',

    /* —— compiler.js —— */
    'cpp.empty': 'Code is empty',
    'cpp.brace': 'braces', 'cpp.paren': 'parentheses', 'cpp.bracket': 'square brackets',
    'cpp.unpaired': 'Unpaired {name}: {open} {o} / {close} {c}',
    'cpp.noIostream': 'cout/cin used but <iostream> is not included',
    'cpp.noMain': 'No main function entry found (int main)',
    'cpp.fullwidth': 'Full-width symbols detected (；（）｛｝） — C++ needs half-width symbols',
    'cpp.checkFail': '[Local simulated run · structure check failed]',
    'cpp.fixHint': 'Fix the issues and run again, or check "Real online compile" for a real result.',
    'cpp.simTitle': '[Local simulated run] (V1 offline shell — not a real compiler output)',
    'cpp.simOk': '✓ Structure check passed: {lines} lines, {cout} output statements{loop}',
    'cpp.simLoop': ', includes loops',
    'cpp.simMain': '✓ main function entry ready',
    'cpp.simTip': 'Tip: check "Real online compile" at the top right to compile and run for real.',
    'cpp.noOutput': '(no program output)',
    'cpp.onlineFail': 'Online compile failed: network unreachable. Offline mode remains available — uncheck "Real online compile".'
  }
};

/* ================= 运行时状态 ================= */
let current = detectLang();
let _pickerDone = false;

/** 根据浏览器语言推断默认（仅作推荐，首访仍弹选择） */
export function detectLang() {
  try {
    const l = (navigator.language || '').toLowerCase();
    return l.startsWith('zh') ? 'zh' : 'en';
  } catch { return 'zh'; }
}

export function getLang() { return current; }

/** 是否已做过首次语言选择 */
export function hasChosenLang() {
  try { return !!localStorage.getItem(LS_KEY); } catch { return false; }
}

/** 读取已保存的语言（无则 null） */
export function storedLang() {
  try { return localStorage.getItem(LS_KEY); } catch { return null; }
}

/**
 * 翻译取词 + {var} 插值
 * @param {string} key 词典键
 * @param {object} [vars] 插值变量，如 { name: '小码' }
 */
export function t(key, vars) {
  const table = DICT[current] || DICT.zh;
  let s = table[key];
  if (s === undefined) s = DICT.zh[key];
  if (s === undefined) return key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
  }
  return s;
}

/** {zh, en} 形式的双语数据按当前语言取值（如 StateMeta.label、槽位 label） */
export function pick(v) {
  if (v && typeof v === 'object' && ('zh' in v || 'en' in v)) {
    return v[current] ?? v.zh ?? '';
  }
  return v;
}

/** 设置语言：持久化 + 刷新静态文本 + 广播 langchange 事件 */
export function setLang(lang, { persist = true } = {}) {
  if (!DICT[lang]) lang = 'zh';
  const changed = current !== lang;
  current = lang;
  if (persist) {
    try { localStorage.setItem(LS_KEY, lang); } catch { /* 隐私模式：仅内存生效 */ }
  }
  applyStatic();
  if (changed || persist) {
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }
  return current;
}

/** 应用静态文本：data-i18n / data-i18n-ph / data-i18n-title / data-i18n-aria */
export function applyStatic() {
  const html = document.documentElement;
  if (html) html.lang = t('html.lang');
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n);
    if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  // 语言切换按钮：显示"目标语言"名称
  const btn = document.getElementById('btn-lang');
  if (btn) btn.textContent = t('hud.langBtn');
}

/** 订阅语言切换事件（模块重渲染动态文本用） */
export function onLangChange(fn) {
  window.addEventListener('langchange', fn);
}

/**
 * 首访语言选择：已选过 → 直接回调启动；未选过 → 显示弹窗，选择后启动。
 * @param {() => void} onChosen 语言确定后的启动回调（整个 App boot）
 * @returns {boolean} 是否需要等待用户选择（true 表示弹窗已展示）
 */
export function initLangPicker(onChosen) {
  const overlay = document.getElementById('lang-overlay');
  if (!overlay) { onChosen(); return false; }
  if (_pickerDone) { onChosen(); return false; }

  const saved = storedLang();
  if (saved && DICT[saved]) {
    _pickerDone = true;
    current = saved;
    applyStatic();
    onChosen();
    return false;
  }

  // 首访：按浏览器语言预推荐（仅高亮，仍需用户点击确认）
  const suggested = detectLang();
  overlay.querySelectorAll('.lang-opt').forEach((b) => {
    b.classList.toggle('suggested', b.dataset.lang === suggested);
  });
  overlay.hidden = false;

  const choose = (lang) => {
    if (_pickerDone) return;
    _pickerDone = true;
    setLang(lang); // 持久化 + 刷新静态文本 + 广播
    overlay.hidden = true;
    onChosen();
  };
  overlay.querySelectorAll('.lang-opt').forEach((btn) => {
    btn.addEventListener('click', () => choose(btn.dataset.lang));
  });
  return true;
}

/** 供 E2E/调试：直接完成选择（不经过 UI） */
export function resolveLangForTest(lang = 'zh') {
  _pickerDone = true;
  setLang(lang);
  const overlay = document.getElementById('lang-overlay');
  if (overlay) overlay.hidden = true;
}

export { LS_KEY as LANG_LS_KEY, DICT };
