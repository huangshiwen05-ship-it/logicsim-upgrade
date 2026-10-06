// 布局测量：桌面 + 手机
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9224;
const URL = 'http://127.0.0.1:8000/index.html';

let ws; let msgId = 0; const pending = new Map();
function send(method, params) {
    return new Promise((resolve, reject) => {
        const id = ++msgId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true });
    return res.result && res.result.value;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
        '--remote-debugging-port=' + PORT,
        '--user-data-dir=' + path.join(os.tmpdir(), 'edge-cdp-' + Date.now()),
        '--window-size=1280,900', URL], { stdio: 'ignore' });
    let target;
    for (let i = 0; i < 40; i++) {
        try {
            const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
            target = list.find(t => t.type === 'page');
            if (target) break;
        } catch (e) {}
        await sleep(250);
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = evt => {
        const m = JSON.parse(evt.data);
        if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    };
    await send('Runtime.enable');
    await sleep(1200);

    async function measure() {
        return await evaluate(`(() => {
            function box(sel){ var el = document.querySelector(sel); if(!el) return null; var r = el.getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y)}; }
            return {
                header: box('.app-header'),
                minimap: box('.mini-map'),
                main: box('.main-container'),
                right: box('.right-container'),
                bottom: box('.bottom-container'),
                truth: box('#truthTable'),
                scrollW: document.documentElement.scrollWidth,
                clientW: document.documentElement.clientWidth
            };
        })()`);
    }

    console.log('== 桌面 1280x900 ==');
    await send('Page.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(400);
    console.log(JSON.stringify(await measure(), null, 2));

    console.log('== 手机 390x844 ==');
    await send('Page.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(400);
    console.log(JSON.stringify(await measure(), null, 2));

    ws.close(); edge.kill();
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
