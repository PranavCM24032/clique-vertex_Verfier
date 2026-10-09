// End-to-end test of app.html's own UI code path: builds a fake DOM, runs the
// page's real script blocks, clicks the real buttons, and reads the verdict
// the simulator renders. Run: node scripts/test-app-ui.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'app.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (blocks.length < 2) {
  console.error('FAIL: expected the verifier core + app script blocks in app.html');
  process.exit(1);
}

/* ---------------- minimal DOM ---------------- */
const ctxStub = new Proxy({}, {
  get(t, p) { if (!(p in t)) t[p] = () => undefined; return t[p]; },
  set(t, p, v) { t[p] = v; return true; }
});

function makeEl(id) {
  const el = {
    id, value: '', textContent: '', disabled: false, style: {},
    children: [], handlers: {}, _html: '', _classes: new Set(),
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); this.children = []; },
    get className() { return [...this._classes].join(' '); },
    set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(type, fn) { (el.handlers[type] ||= []).push(fn); },
    fire(type, ev = {}) { (el.handlers[type] || []).slice().forEach(fn => fn(ev)); },
    focus() { },
    getBoundingClientRect() { return { width: 800, height: 320, left: 0, top: 0 }; },
    scrollIntoView() { },
    getContext() { return ctxStub; }
  };
  el.classList = {
    add: (...cs) => cs.forEach(c => el._classes.add(c)),
    remove: (...cs) => cs.forEach(c => el._classes.delete(c)),
    contains: c => el._classes.has(c)
  };
  return el;
}

const els = {};
const document = {
  getElementById(id) { return els[id] || (els[id] = makeEl(id)); },
  createElement() { return makeEl(''); },
  head: makeEl('head')
};

const sandbox = {
  document, window: { addEventListener() { } },
  devicePixelRatio: 1,
  requestAnimationFrame() { return 0; },
  cancelAnimationFrame() { },
  performance: { now: () => 0 },
  setInterval() { return 0; },
  clearInterval() { },
  setTimeout() { return 0; },
  navigator: { userAgent: 'test' },
  location: { protocol: 'file:' },
  console
};
vm.createContext(sandbox);
blocks.forEach((code, i) => vm.runInContext(code, sandbox, { filename: 'app.html:block' + i }));

// Default form state, mirroring the markup (looked up through document, since the
// page only creates some of these lazily on first use).
document.getElementById('problemSelect').value = 'clique';
document.getElementById('kInput').value = '3';
document.getElementById('certInput').value = '';
document.getElementById('speedRange').value = '3';

/* ---------------- harness ---------------- */
let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

function loadGraph() { els.loadExampleBtn.fire('click'); }

function verify(cert, problem, k) {
  // Set the values and fire 'input' on each field, the way typing does — the page
  // invalidates any standing run when a field changes.
  els.problemSelect.value = problem;
  els.problemSelect.fire('input');
  els.kInput.value = String(k);
  els.kInput.fire('input');
  els.certInput.value = cert;
  els.certInput.fire('input');
  els.verifyBtn.fire('click');
}

function runToTheEnd() {
  let guard = 0;
  while (!els.nextBtn.disabled && guard++ < 5000) els.nextBtn.fire('click');
  return guard;
}

function verdict() {
  const cls = els.verdictStage.className;
  if (cls.includes('show pass')) return 'ACCEPTED';
  if (cls.includes('show fail')) return 'REJECTED';
  return 'NONE';
}

/* ---------------- loading and stepping ---------------- */
console.log('\nUI: load and step through a run');
loadGraph();
check('graph editor reports the example instance',
  els.vertexCount.textContent === 6 && els.edgeCount.textContent === 8,
  els.vertexCount.textContent + 'v / ' + els.edgeCount.textContent + 'e');

verify('1,2,3', 'clique', 3);
check('tape shows the Clique verifier', els.tapeTitle.textContent.includes('Clique verifier'),
  els.tapeTitle.textContent);
const stepsSeen = runToTheEnd();
check('simulation reaches the last step', els.nextBtn.disabled && stepsSeen > 1, stepsSeen + ' steps');
check('k=3, {1,2,3} ACCEPTED', verdict() === 'ACCEPTED', els.verdictStage.innerHTML);
check('verdict text says ACCEPTED', els.verdictStage.innerHTML.includes('Certificate ACCEPTED'));
check('stats show the O(n²) bound for clique',
  els.statRow.innerHTML.includes('O(k²) ⊆ O(n²)'), els.statRow.innerHTML);
check('solver/verifier race armed', els.raceBtn.disabled === false);
check('growth chart armed for the loaded instance',
  els.solverDesc.textContent.includes('C(6, 3)'), els.solverDesc.textContent);

/* ---------------- REJECTED cases ---------------- */
console.log('\nUI: rejected certificates');
verify('1,2,4', 'clique', 3);
runToTheEnd();
check('k=3, {1,2,4} REJECTED (missing edge)', verdict() === 'REJECTED', els.verdictStage.innerHTML);

verify('1,1,2', 'clique', 3);
runToTheEnd();
check('duplicate vertices REJECTED', verdict() === 'REJECTED', els.verdictStage.innerHTML);

verify('1,2,9', 'clique', 3);
runToTheEnd();
check('nonexistent vertex REJECTED', verdict() === 'REJECTED', els.verdictStage.innerHTML);

verify('1,2,3', 'clique', 4);
runToTheEnd();
check('wrong certificate size REJECTED', verdict() === 'REJECTED', els.verdictStage.innerHTML);

verify('1,2,4,5', 'vc', 4);
runToTheEnd();
check('k=4, {1,2,4,5} cover ACCEPTED', verdict() === 'ACCEPTED', els.verdictStage.innerHTML);
check('stats show the O(n²) bound for vertex cover',
  els.statRow.innerHTML.includes('O(m) ⊆ O(n²)'), els.statRow.innerHTML);

verify('1,2,4', 'vc', 4);
runToTheEnd();
check('incomplete cover REJECTED', verdict() === 'REJECTED', els.verdictStage.innerHTML);

verify('1,2,3,9', 'vc', 4);
runToTheEnd();
check('cover with a phantom vertex REJECTED', verdict() === 'REJECTED', els.verdictStage.innerHTML);

verify('1,2,4,5', 'vc', 2);
runToTheEnd();
check('cover larger than k REJECTED', verdict() === 'REJECTED', els.verdictStage.innerHTML);

/* ---------------- malformed input never reaches the verifier ---------------- */
console.log('\nUI: malformed input is rejected before any check runs');
verify('1,2,x', 'clique', 3);
check('letter in certificate shows a parse error',
  els.certError.textContent.includes('Invalid certificate entry'), els.certError.textContent);
check('no verdict is rendered for malformed input', verdict() === 'NONE', els.verdictStage.className);
check('no tape is loaded for malformed input', els.tapeCount.textContent === 'step 0 / 0',
  els.tapeCount.textContent);

verify('', 'clique', 3);
check('empty certificate shows a parse error',
  els.certError.textContent.includes('Enter at least one vertex ID'), els.certError.textContent);

verify('1,2,3.5', 'clique', 3);
check('decimal certificate entry shows a parse error',
  els.certError.textContent.includes('Invalid certificate entry'), els.certError.textContent);

verify('1,2,3', 'clique', '');
check('empty k shows a k error', els.certError.textContent.includes('target size k'),
  els.certError.textContent);

verify('1,2,3', 'clique', 3);
check('a valid certificate clears the previous error', els.certError.textContent === '',
  els.certError.textContent);

/* ---------------- invalidation on edit ---------------- */
console.log('\nUI: editing invalidates a standing verdict');
verify('1,2,3', 'clique', 3);
runToTheEnd();
check('run accepted before the edit', verdict() === 'ACCEPTED');
els.certInput.fire('input');
check('editing the certificate tears the run down', verdict() === 'NONE' &&
  els.stepStage.innerHTML.includes('Certificate edited'), els.stepStage.innerHTML);

verify('1,2,3', 'clique', 3);
runToTheEnd();
els.problemSelect.fire('input');
check('changing the problem tears the run down',
  els.stepStage.innerHTML.includes('Problem changed'), els.stepStage.innerHTML);

/* ---------------- result ---------------- */
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
