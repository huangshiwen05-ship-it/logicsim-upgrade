// 补查：文件导入导出（fileToLoad 导入 / saveTextAsFile 导出）
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9226;
const URL = 'http://127.0.0.1:8000/index.html';

let ws; let msgId = 0; const pend = new Map();
function send(method, params) {
    return new Promise((resolve, reject) => {
        const id = ++msgId;
        pend.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) return { __exc: res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception && res.exceptionDetails.exception.description) };
    return res.result && res.result.value;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
        '--remote-debugging-port=' + PORT,
        '--user-data-dir=' + path.join(os.tmpdir(), 'edge-import-' + Date.now()),
        '--window-size=1280,900', URL], { stdio: 'ignore' });
    let target;
    for (let i = 0; i < 40; i++) {
        try { const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); target = l.find(t => t.type === 'page'); if (target) break; } catch (e) {}
        await sleep(250);
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = evt => {
        const m = JSON.parse(evt.data);
        if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    };
    await send('Runtime.enable');
    await sleep(1200);

    let pass = 0, fail = 0;
    const check = (n, c, d) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, JSON.stringify(d)); } };

    // 先造一个已知图形
    await evaluate(`document.getElementById("ReversePol").value='a b .'; app.parseLogic(); true`);
    const nodesBefore = await evaluate('graph.getCells().length');
    check('导入前图形节点 > 0', nodesBefore > 0, nodesBefore);

    // 导出：saveTextAsFile 不应抛异常（headless 下可能触发下载）
    const exportRes = await evaluate(`(function(){ try { app.saveTextAsFile(); return {ok:true}; } catch(e){ return {ok:false, err:e.message}; } })()`);
    check('saveTextAsFile 不抛异常', exportRes.ok === true, exportRes);

    // 导入：模拟文件选择，内容为合法 JSON 模型
    const importRes = await evaluate(`(function(){
        return new Promise(function(resolve){
            var input = document.getElementById("fileToLoad");
            var file = new File(['{"nodeArray":[{"key":"0","type":"0","name":"Zero"},{"key":2,"type":"Export","name":"Out"}],"linkArray":[{"from":"0","frompid":"OUT","to":2,"topid":"OUT"}]}'], 'test.json', {type:'application/json'});
            var dt = new DataTransfer();
            dt.items.add(file);
            Object.defineProperty(input, 'files', {value: dt.files, configurable: true});
            var done = false;
            input.addEventListener('change', function(){ setTimeout(function(){ resolve({status: document.getElementById("status").textContent, model: document.getElementById("myModel").value, nodes: graph.getCells().length}); }, 300); });
            input.dispatchEvent(new Event('change'));
        });
    })()`);
    check('导入后 myModel 被替换', importRes.model && importRes.model.indexOf('Export') >= 0, importRes);
    check('导入后重新渲染图形', importRes.nodes === 3, importRes);

    // 导入非法 JSON 文件（应提示格式错误，不崩溃）
    const badImport = await evaluate(`(function(){
        return new Promise(function(resolve){
            var input = document.getElementById("fileToLoad");
            var file = new File(['not json {{'], 'bad.json', {type:'application/json'});
            var dt = new DataTransfer(); dt.items.add(file);
            Object.defineProperty(input, 'files', {value: dt.files, configurable: true});
            input.addEventListener('change', function(){ setTimeout(function(){ resolve({status: document.getElementById("status").textContent}); }, 300); });
            input.dispatchEvent(new Event('change'));
        });
    })()`);
    check('非法 JSON 文件提示格式错误', badImport.status && badImport.status.indexOf('格式错误') >= 0, badImport);

    console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
    ws.close(); edge.kill();
    process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
