// 浏览器端功能测试：通过 CDP 连接 Edge headless
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9223;
const URL = 'http://127.0.0.1:8000/index.html';
const USER_DATA = path.join(os.tmpdir(), 'edge-cdp-logicsim-' + Date.now());

let ws;
let msgId = 0;
const pending = new Map();
const errors = [];

function send(method, params) {
    return new Promise((resolve, reject) => {
        const id = ++msgId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
    });
    if (res.exceptionDetails) {
        return { __exception: res.exceptionDetails.text + ' ' + JSON.stringify(res.exceptionDetails.exception && res.exceptionDetails.exception.description) };
    }
    return res.result && res.result.value;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
    const edge = spawn(EDGE, [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--remote-debugging-port=' + PORT,
        '--user-data-dir=' + USER_DATA,
        '--window-size=1280,900',
        URL
    ], { stdio: ['ignore', 'ignore', 'ignore'] });

    // 等待调试端口
    let target = null;
    for (let i = 0; i < 40; i++) {
        try {
            const resp = await fetch('http://127.0.0.1:' + PORT + '/json/list');
            const list = await resp.json();
            target = list.find(t => t.type === 'page' && t.url.includes('index.html')) || list.find(t => t.type === 'page');
            if (target) break;
        } catch (e) { /* retry */ }
        await sleep(250);
    }
    if (!target) {
        console.log('FAIL: 未能连接浏览器调试端口');
        edge.kill();
        process.exit(1);
    }

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });
    ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id && pending.has(msg.id)) {
            const p = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
            else p.resolve(msg.result);
        } else if (msg.method === 'Runtime.exceptionThrown') {
            errors.push('exception: ' + (msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || msg.params.exceptionDetails.text));
        } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
            errors.push('console.error: ' + msg.params.args.map(a => a.value || a.description).join(' '));
        }
    };

    await send('Runtime.enable');
    await send('Page.enable');
    await sleep(1500); // 等页面初始化

    let pass = 0, fail = 0;
    function check(name, cond, detail) {
        if (cond) { pass++; console.log('  PASS', name); }
        else { fail++; console.log('  FAIL', name, detail === undefined ? '' : JSON.stringify(detail)); }
    }

    // 基础加载
    const title = await evaluate('document.title');
    check('页面标题', title && title.length > 0, title);
    const exCount = await evaluate('document.querySelectorAll("#examples .example-btn").length');
    check('示例按钮已生成(8)', exCount === 8, exCount);
    const opsCount = await evaluate('document.querySelectorAll("#opsHelp tr").length');
    check('操作符说明已生成(5)', opsCount === 5, opsCount);

    // 辅助：设置输入并解析，返回状态/真值表信息
    async function parseExpr(expr) {
        await evaluate(`document.getElementById("ReversePol").value = ${JSON.stringify(expr)}; app.parseLogic(); true`);
        return await evaluate(`({
            status: document.getElementById("status").textContent,
            err: document.getElementById("errorMsg").textContent,
            errVisible: document.getElementById("errorMsg").style.display,
            tt: document.getElementById("truthTable").innerText,
            summary: document.getElementById("ttSummary").textContent,
            nodes: (typeof graph !== 'undefined' ? graph.getCells().length : -1)
        })`);
    }

    console.log('== 五种运算（浏览器端）==');
    for (const [expr, want] of [
        ['a b .', '可满足'],
        ['a b ,', '可满足'],
        ['a <', '可满足'],
        ['a b >', '可满足'],
        ['a b =', '可满足']
    ]) {
        const r = await parseExpr(expr);
        check(expr + ' 生成图形', r.nodes > 0, r);
        check(expr + ' 真值表有内容', r.tt && r.tt.length > 0, r.tt.slice(0, 50));
    }

    console.log('== 指定用例（浏览器端）==');
    let r = await parseExpr('a a < ,');
    check('a a < , 永真式', r.summary.indexOf('永真') >= 0, r);
    r = await parseExpr('a a < .');
    check('a a < . 矛盾式', r.summary.indexOf('矛盾') >= 0, r);
    r = await parseExpr('a b >');
    check('a b > 可满足但非永真', r.summary.indexOf('可满足') >= 0, r);

    console.log('== 错误提示（浏览器端）==');
    // 先成功一次，确认有旧结果
    await parseExpr('a b .');
    const before = await evaluate('graph.getCells().length');
    r = await parseExpr('');
    check('空输入显示错误', r.err && r.err.indexOf('输入为空') >= 0, r);
    const after1 = await evaluate('graph.getCells().length');
    check('空输入后保留旧图形', after1 === before && before > 0, { before, after1 });
    check('错误提示可见', r.errVisible !== 'none', r);

    r = await parseExpr('a .');
    check('a . 操作数不足', r.err.indexOf('操作数不足') >= 0, r);
    r = await parseExpr('a b');
    check('a b 多余操作数', r.err.indexOf('多余') >= 0, r);
    const after2 = await evaluate('graph.getCells().length');
    check('连续错误后仍保留旧图形', after2 === before, { before, after2 });

    // 状态提示旧结果
    r = await parseExpr('a .');
    check('错误提示注明旧结果', r.err.indexOf('旧') >= 0 || r.err.indexOf('上一次') >= 0, r);

    console.log('== 导入导出 / 编辑（浏览器端）==');
    // 图转文本 / 文本转图
    await evaluate(`app.save(); true`);
    const modelText = await evaluate('document.getElementById("myModel").value');
    check('图转文本生成 JSON', modelText && modelText.indexOf('nodeArray') >= 0, modelText.slice(0, 60));
    await evaluate(`app.load(); true`);
    const nodesAfterLoad = await evaluate('graph.getCells().length');
    check('文本转图正常', nodesAfterLoad > 0, nodesAfterLoad);

    // 节点编辑：点击第一个节点（通过模型）
    await evaluate(`var first = graph.getCells()[0]; ERKeyNow = first.id; document.getElementById("ERName").value = JSON.stringify(first.attr().label.text.split("\\n")); document.getElementById("ERMemo").value = "测试备注"; app.ChangeName(); true`);
    const statusEdit = await evaluate('document.getElementById("status").textContent');
    check('节点编辑保存成功', statusEdit.indexOf('已保存') >= 0, statusEdit);

    // 控制台错误
    console.log('== 控制台错误 ==');
    check('无 JS 异常', errors.length === 0, errors);

    // 布局截图（桌面 + 手机）
    await send('Page.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(400);
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'shot-desktop.png'), Buffer.from(shot1.data, 'base64'));
    console.log('  已保存 shot-desktop.png');

    await send('Page.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(400);
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'shot-mobile.png'), Buffer.from(shot2.data, 'base64'));
    console.log('  已保存 shot-mobile.png');

    // 手机布局横向溢出检查
    const overflow = await evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth');
    check('手机无横向溢出', overflow <= 0, overflow);

    console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
    console.log('控制台错误数: ' + errors.length);
    if (errors.length) console.log(errors.join('\n'));

    ws.close();
    edge.kill();
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
