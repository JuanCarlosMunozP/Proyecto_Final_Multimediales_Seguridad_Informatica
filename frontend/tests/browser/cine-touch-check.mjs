// Prueba manual automatizada: requiere Vite local y Chrome existente, sin instalar paquetes.
// Uso: node tests/browser/cine-touch-check.mjs [touch|desktop]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const touch = process.argv[2] !== 'desktop';
const port = 9231;
const profile = path.join(os.tmpdir(), `release005a-${Date.now()}`);
const browser = spawn(process.env.CINE_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--remote-allow-origins=*', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const jobs = new Map(), errors = [], warnings = [], models = [], steps = [];
let ws, id = 0, sessionId, version;
browser.on('error', error => errors.push({ harness: String(error) }));

try {
  let info;
  for (let i = 0; i < 50; i++) {
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; }
    catch { await delay(200); }
  }
  assert.ok(info, 'Chrome/CDP disponible');
  version = info.Browser;
  ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const job = jobs.get(message.id);
      if (job) {
        clearTimeout(job.timer); jobs.delete(message.id);
        message.error ? job.reject(Error(JSON.stringify(message.error))) : job.resolve(message.result);
      }
    } else if (['Runtime.exceptionThrown', 'Network.loadingFailed'].includes(message.method)) errors.push(message);
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message);
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'warning') warnings.push(message);
    else if (message.method === 'Log.entryAdded') {
      if (message.params.entry.level === 'error') errors.push(message);
      else if (message.params.entry.level === 'warning') warnings.push(message);
    } else if (message.method === 'Network.responseReceived' && message.params.response.url.includes('/models/')) {
      models.push({ url: message.params.response.url, status: message.params.response.status });
    }
  };
  ws.onclose = () => {
    for (const job of jobs.values()) { clearTimeout(job.timer); job.reject(Error('CDP cerrado')); }
    jobs.clear();
  };
  const send = (method, params = {}, attached = true) => new Promise((resolve, reject) => {
    const n = ++id;
    const timer = setTimeout(() => { jobs.delete(n); reject(Error(`Timeout ${method}`)); }, 10000);
    jobs.set(n, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: n, method, params, ...(attached && sessionId ? { sessionId } : {}) }));
  });
  const target = await send('Target.createTarget', { url: 'about:blank' }, false);
  sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId;
  for (const method of ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable']) await send(method);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const tracked = new Map();
    window.__cineCheck = { added: 0, removed: 0, active: () => tracked.size };
    const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
    window.addEventListener = (type, fn, ...rest) => {
      if (['alTocar', 'alSaltar'].includes(fn?.name)) { tracked.set(fn, type); window.__cineCheck.added++; }
      return add(type, fn, ...rest);
    };
    window.removeEventListener = (type, fn, ...rest) => {
      if (tracked.get(fn) === type) { tracked.delete(fn); window.__cineCheck.removed++; }
      return remove(type, fn, ...rest);
    };
  ` });
  if (touch) {
    await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' });
  }
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? 'Error evaluate');
    return result.result.value;
  };
  const until = async (expression, label) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(200); }
    throw Error(`No se cumplio: ${label}`);
  };
  const pressE = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 });
  };
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/#demo=-2,12' });
  await until("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Jugar como invitado'))", 'cuenta');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Jugar como invitado')).click()");
  await until("document.body.innerText.includes('Daniel: 1 m')", 'nivel listo');
  await pressE(); // Abre la primera linea de Daniel.
  const notice = touch ? 'Toca para saltar' : 'E · saltar';
  for (const name of ['avion', 'playa']) {
    await pressE();
    await until(`document.body.innerText.includes(${JSON.stringify(notice)})`, `${name} creada`);
    await delay(700); // Permite cuadros reales antes del salto.
    const before = await evaluate('({active:__cineCheck.active(),added:__cineCheck.added,removed:__cineCheck.removed})');
    assert.equal(before.active, touch ? 2 : 1);
    if (touch) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 820, y: 330 }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await pressE();
    await until(`!document.body.innerText.includes(${JSON.stringify(notice)}) && __cineCheck.active() === 0`, `${name} cerrada`);
    const after = await evaluate('({active:__cineCheck.active(),added:__cineCheck.added,removed:__cineCheck.removed,dialogue:document.getElementById("dialogo").innerText})');
    assert.equal(after.added, after.removed);
    assert.ok(after.dialogue.length > 0, 'dialogo restaurado');
    steps.push({ cinematic: name, before, after });
  }
  assert.equal(errors.length, 0, 'sin errores de consola, ejecucion o red');
  assert.ok(models.some(model => model.url.includes('daniel.glb')));
  assert.ok(models.some(model => model.url.includes('palmera.glb')));
  assert.ok(models.some(model => model.url.includes('idolo.glb')));
  assert.ok(models.every(model => model.status === 200));
  console.log(JSON.stringify({ passed: true, mode: touch ? 'touch-emulated' : 'desktop', version, steps, models, errors, warnings, profile }));
  try { await send('Browser.close', {}, false); } catch { /* cierre interrumpe la respuesta CDP */ }
} catch (error) {
  console.log(JSON.stringify({ passed: false, error: String(error), version, steps, errors, warnings, models, profile }));
  process.exitCode = 1;
} finally {
  ws?.close();
  browser.kill();
}
