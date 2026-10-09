// Tests for the pure verifier core embedded in app.html.
// Extracts the verifier-core block (no DOM) and grades ACCEPTED / REJECTED cases.
// Run: node scripts/test-verifier.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'app.html'), 'utf8');

const match = html.match(/\/\* ===== verifier-core:start[\s\S]*?\/\* ===== verifier-core:end ===== \*\//);
if (!match) {
  console.error('FAIL: verifier-core block not found in app.html');
  process.exit(1);
}
const coreSource = match[0];

const ctx = vm.createContext({});
vm.runInContext(coreSource, ctx);
const { parseCertificate, buildVerificationSteps, edgeKey } = ctx;

if (typeof parseCertificate !== 'function' || typeof buildVerificationSteps !== 'function') {
  console.error('FAIL: verifier-core did not define parseCertificate / buildVerificationSteps');
  process.exit(1);
}

/* ---------------- harness ---------------- */
let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  ok  ' + name);
  } else {
    failed++;
    console.log('FAIL  ' + name + (detail ? '  — ' + detail : ''));
  }
}

function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  check(name, a === b, 'got ' + a + ', want ' + b);
}

/* ---------------- instance under test ----------------
   Same graph as the "Load example" button:
   edges 1-2, 1-3, 2-3, 2-4, 3-4, 4-5, 4-6, 5-6  (n = 6, m = 8)
   max clique = 3 ({1,2,3}), min vertex cover = 4 (tau = n - alpha, alpha = 2)
----------------------------------------------------- */
const nodes = [1, 2, 3, 4, 5, 6].map(id => ({ id, x: 0, y: 0 }));
const edges = new Set(['1-2', '1-3', '2-3', '2-4', '3-4', '4-5', '4-6', '5-6']);

const verdict = steps => (steps.every(s => s.pass) ? 'ACCEPTED' : 'REJECTED');
const failing = steps => steps.filter(s => !s.pass);
const findStep = (steps, needle) => steps.find(s => s.text.includes(needle));
const shapeOk = steps => steps.every(s =>
  typeof s.pass === 'boolean' && typeof s.text === 'string' &&
  Array.isArray(s.hlNodes) && (s.hlEdge === null || Array.isArray(s.hlEdge)));

/* ---------------- 1. strict certificate parsing ---------------- */
console.log('\ncertificate parsing');

eq('accepts comma list', parseCertificate('1,2,3').ids, [1, 2, 3]);
eq('accepts spaces around entries', parseCertificate(' 1 , 2 , 3 ').ids, [1, 2, 3]);
eq('accepts whitespace-separated IDs', parseCertificate('1 2 3').ids, [1, 2, 3]);
eq('single ID', parseCertificate('7').ids, [7]);

check('rejects empty input', !parseCertificate('').ok, 'empty string accepted');
check('rejects blank/whitespace input', !parseCertificate('   ').ok, 'whitespace accepted');
check('rejects a letter entry', !parseCertificate('1,2,x').ok && parseCertificate('1,2,x').error.includes('"x"'),
  'letter entry silently accepted');
check('rejects a decimal entry', !parseCertificate('1,2,3.5').ok, 'decimal silently accepted');
check('rejects a negative entry', !parseCertificate('1,-2').ok, 'negative silently accepted');
check('rejects a mixed list (nothing silently dropped)',
  !parseCertificate('1,2,foo').ok, 'malformed token dropped, list shortened to [1,2]');
check('error messages are non-empty strings',
  ['x', '', '3.5', '-1'].every(t => { const r = parseCertificate(t); return r.ok || (r.error || '').length > 0; }));

/* ---------------- 2. Clique: ACCEPTED and REJECTED ---------------- */
console.log('\nclique verifier');

const cliqueAccepted = buildVerificationSteps(nodes, edges, 'clique', 3, [1, 2, 3]);
check('k=3, {1,2,3} is ACCEPTED', verdict(cliqueAccepted) === 'ACCEPTED');
eq('  step count = 3 checks + C(3,2) pairs', cliqueAccepted.length, 6);
check('  every step carries the render shape', shapeOk(cliqueAccepted));
check('  no failing step', failing(cliqueAccepted).length === 0);

const cliqueMissing = buildVerificationSteps(nodes, edges, 'clique', 3, [1, 2, 4]);
check('k=3, {1,2,4} is REJECTED (1-4 missing)', verdict(cliqueMissing) === 'REJECTED');
check('  reports the missing edge (1, 4)',
  !!findStep(cliqueMissing, 'Edge check (1, 4)') && findStep(cliqueMissing, 'Edge check (1, 4)').pass === false,
  JSON.stringify(failing(cliqueMissing)));

const cliqueWrongSize = buildVerificationSteps(nodes, edges, 'clique', 4, [1, 2, 3]);
check('k=4, |C|=3 is REJECTED on size', verdict(cliqueWrongSize) === 'REJECTED');
check('  size step fails', findStep(cliqueWrongSize, '|C| = 3')?.pass === false);
eq('  pair checks still shown', cliqueWrongSize.length, 6);

const cliqueTooBig = buildVerificationSteps(nodes, edges, 'clique', 2, [1, 2, 3]);
check('k=2, |C|=3 is REJECTED', verdict(cliqueTooBig) === 'REJECTED');

const cliqueDup = buildVerificationSteps(nodes, edges, 'clique', 3, [1, 1, 2]);
check('duplicate vertices are REJECTED', verdict(cliqueDup) === 'REJECTED');
check('  duplicate step fails', findStep(cliqueDup, 'repeats a vertex')?.pass === false);
eq('  pair checks skipped when the set is malformed', cliqueDup.length, 3);

const cliqueGhost = buildVerificationSteps(nodes, edges, 'clique', 3, [1, 2, 9]);
check('nonexistent vertex 9 is REJECTED', verdict(cliqueGhost) === 'REJECTED');
check('  existence step fails', findStep(cliqueGhost, 'not a subset of V')?.pass === false);
eq('  no edge checks run against a nonexistent vertex', cliqueGhost.length, 3);

const cliqueEmpty = buildVerificationSteps(nodes, edges, 'clique', 3, []);
check('empty certificate is REJECTED', verdict(cliqueEmpty) === 'REJECTED');

/* ---------------- 3. Vertex Cover: ACCEPTED and REJECTED ---------------- */
console.log('\nvertex cover verifier');

const vcAccepted = buildVerificationSteps(nodes, edges, 'vc', 4, [1, 2, 4, 5]);
check('k=4, {1,2,4,5} is ACCEPTED', verdict(vcAccepted) === 'ACCEPTED');
eq('  step count = 3 checks + m edges', vcAccepted.length, 3 + edges.size);
check('  every step carries the render shape', shapeOk(vcAccepted));

const vcAcceptedAlt = buildVerificationSteps(nodes, edges, 'vc', 4, [2, 3, 4, 5]);
check('k=4, {2,3,4,5} is ACCEPTED', verdict(vcAcceptedAlt) === 'ACCEPTED');

// {1,2,4} leaves exactly one edge uncovered (5-6), so this case also pins the
// number of failing edge checks rather than just the final verdict.
const vcUncovered = buildVerificationSteps(nodes, edges, 'vc', 4, [1, 2, 4]);
check('k=4, {1,2,4} is REJECTED (5-6 uncovered)', verdict(vcUncovered) === 'REJECTED');
check('  reports uncovered edge (5, 6)',
  !!findStep(vcUncovered, 'Edge (5, 6) covered by C — NO') &&
  findStep(vcUncovered, 'Edge (5, 6)').pass === false);
eq('  exactly one failing edge', failing(vcUncovered).length, 1);

const vcTooBig = buildVerificationSteps(nodes, edges, 'vc', 2, [1, 2, 4, 5]);
check('k=2, |C|=4 is REJECTED on size', verdict(vcTooBig) === 'REJECTED');
check('  size step fails', findStep(vcTooBig, '|C| = 4')?.pass === false);

const vcGhost = buildVerificationSteps(nodes, edges, 'vc', 4, [1, 2, 3, 9]);
check('nonexistent vertex 9 is REJECTED', verdict(vcGhost) === 'REJECTED');
eq('  edge checks skipped when a vertex does not exist', vcGhost.length, 3);

const vcDup = buildVerificationSteps(nodes, edges, 'vc', 5, [1, 1, 2, 4, 5]);
check('duplicate vertices are REJECTED even if they cover', verdict(vcDup) === 'REJECTED');
check('  duplicate step fails', findStep(vcDup, 'repeats a vertex')?.pass === false);
check('  coverage still reported for every edge', vcDup.length === 3 + edges.size);

const vcEmptyNoEdges = buildVerificationSteps(nodes, new Set(), 'vc', 1, []);
check('empty certificate is REJECTED when edges exist', verdict(
  buildVerificationSteps(nodes, edges, 'vc', 1, [])) === 'REJECTED');
check('empty certificate ACCEPTED only for an edgeless graph', verdict(vcEmptyNoEdges) === 'ACCEPTED');

/* ---------------- 4. polynomial work bound ---------------- */
console.log('\npolynomial work bound');

check('core performs no linear .includes() scans',
  !/\.includes\(/.test(coreSource), 'cert.includes() found — reintroduces O(m·k)');

const nBig = 30;
const bigNodes = Array.from({ length: nBig }, (_, i) => ({ id: i + 1, x: 0, y: 0 }));
const bigEdges = new Set();
for (let a = 1; a <= nBig; a++) {
  for (let b = a + 1; b <= nBig; b++) bigEdges.add(edgeKey(a, b));
}
const mBig = bigEdges.size;
check('complete graph m = n(n-1)/2', mBig === (nBig * (nBig - 1)) / 2, 'm = ' + mBig);

const bigVc = buildVerificationSteps(bigNodes, bigEdges, 'vc', nBig, bigNodes.map(v => v.id));
eq('vertex cover checks = 3 + m ≤ O(n²)', bigVc.length, 3 + mBig);
check('vertex cover step count stays within the O(n²) bound',
  bigVc.length <= 3 + (nBig * (nBig - 1)) / 2);

const bigClique = buildVerificationSteps(bigNodes, bigEdges, 'clique', nBig, bigNodes.map(v => v.id));
eq('clique checks = 3 + C(k,2) ≤ O(n²)', bigClique.length, 3 + (nBig * (nBig - 1)) / 2);
check('both problems stay within a quadratic number of checks',
  bigVc.length <= 3 + mBig && bigClique.length <= 3 + (nBig * (nBig - 1)) / 2);

check('inputs are not mutated',
  nodes.length === 6 && edges.size === 8 && bigNodes.length === nBig && bigEdges.size === mBig);

/* ---------------- result ---------------- */
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
