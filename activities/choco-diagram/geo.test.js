// node --test activities/choco-diagram/
const test = require('node:test');
const assert = require('node:assert');
const G = require('./geo.js');

test('perpBisector', () => {
  const r = G.perpBisector([2, 4], [-3, -1]);
  assert.deepEqual(r.mid, [-0.5, 1.5]); assert.equal(r.slope, -1);
  assert.ok(G.sameLine(r.line, [1, 1, -1]));                    // y=-x+1
  assert.equal(G.perpBisector([0, 0], [0, 4]).slope, 0);        // AB 세로 → y=2
  assert.equal(G.perpBisector([0, 0], [4, 0]).slope, null);     // AB 가로 → x=2
  assert.ok(G.sameLine(G.perpBisector([0, 0], [4, 0]).line, [1, 0, -2]));
  assert.equal(G.perpBisector([1, 1], [1, 1]), null);           // 겹친 점
});

test('lineOf', () => {
  assert.ok(G.sameLine(G.lineOf((x, y) => y - (0 * x + 3)), [0, 1, -3]));
  assert.equal(G.lineOf((x, y) => y - x * x), null);
  assert.ok(!G.sameLine([1, 1, -1], [1, 1, -2]));
});

test('5 versions: boundary equals given line, P–A and Q–B are neighbours', () => {
  // 설계서 표 그대로
  const SPEC = {
    1: [[5.5, 4.5], [9, 9], [7, 4], [10, 8], [3, -1, -14.5], [1, -1, -1]],
    2: [[4.5, 4.5], [8, 9], [6, 4], [9, 8], [3, -1, -11.5], [1, -1, 0]],
    3: [[5.5, 3.5], [9, 8], [7, 3], [10, 7], [3, -1, -15.5], [1, -1, -2]],
    4: [[3.5, 3.5], [7, 8], [5, 3], [8, 7], [3, -1, -9.5], [1, -1, 0]],
    5: [[6.5, 2.5], [10, 7], [8, 2], [11, 6], [3, -1, -19.5], [1, -1, -4]]
  };
  assert.equal(G.VERSIONS.length, 5);
  for (const v of G.VERSIONS) {
    const [P, Q, A, B, la, lb] = SPEC[v.id];
    assert.deepEqual([v.P, v.Q, v.A, v.B], [P, Q, A, B], 'points v' + v.id);
    assert.ok(G.sameLine(G.perpBisector(P, A).line, la), 'lineA v' + v.id);
    assert.ok(G.sameLine(G.perpBisector(Q, B).line, lb), 'lineB v' + v.id);
    assert.ok(G.sameLine(v.lineA, la) && G.sameLine(v.lineB, lb));
    const S = [...G.others(v.id), v.P, v.Q, v.A, v.B];
    const n = G.neighbors(S, { x0: -3, y0: -3, x1: 17, y1: 13 });
    assert.ok(n.has('4-6') && n.has('5-7'), 'neighbours v' + v.id);
  }
  assert.deepEqual(G.others(2)[0], [4.61, 1.66]);
  assert.deepEqual(G.mapOrigin(5), [0.97, -3.04]);
});

test('otherColour: share of the segment in a third colour', () => {
  const w = 300, h = 1, lab = new Float32Array(w * 3);
  const RED = [50, 60, 40], YEL = [90, -5, 80], GRN = [70, -50, 30];
  for (let i = 0; i < w; i++) lab.set(i < 100 ? RED : i < 200 ? YEL : GRN, i * 3);
  assert.ok(G.otherColour(lab, w, h, [10, 0], [290, 0], 5) > 25);    // 빨강 → (노랑) → 초록 : 이웃 아님
  assert.ok(G.otherColour(lab, w, h, [10, 0], [190, 0], 5) <= 5);    // 빨강 → 노랑 : 이웃
});

test('tmath parses student forms', () => {
  const T = require('../../common/tmath.js');
  assert.deepEqual(T.parsePoint(T.latexToPlain('\\left(-\\frac{11}{2},2\\right)')), [-5.5, 2]);
  const f = T.compileXY(T.latexToPlain('y=2\\left(x-7\\right)+5.5')).f;
  assert.ok(G.sameLine(G.lineOf(f), [2, -1, -8.5]));
  assert.ok(G.sameLine(G.lineOf(T.compileXY(T.latexToPlain('x=-2')).f), [1, 0, 2]));
  assert.equal(T.parseNumber(T.latexToPlain('-\\frac{19}{13}')), -19 / 13);
});
