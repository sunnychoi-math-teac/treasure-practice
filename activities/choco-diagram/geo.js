/*
 * 초코볼 다이어그램 · 계산 (보로노이, 수직이등분선, 직선 비교, 이웃 검사, 도전 문제 5버전)
 * © 2026 경남고등학교 수학과 최선지 선생님 · 초코볼 다이어그램
 */
(function () {
  'use strict';
  const EPS = 1e-9;

  // 반평면 a·x + b·y <= c 로 다각형 자르기
  function clip(poly, a, b, c) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const fp = a * p[0] + b * p[1] - c, fq = a * q[0] + b * q[1] - c;
      if (fp <= EPS) out.push(p);
      if ((fp < -EPS && fq > EPS) || (fp > EPS && fq < -EPS)) {
        const t = fp / (fp - fq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  }
  // i번 점과 j번 점 사이 수직이등분선: i 쪽 반평면 계수
  const half = (s, o) => [o[0] - s[0], o[1] - s[1], (o[0] ** 2 + o[1] ** 2 - s[0] ** 2 - s[1] ** 2) / 2];

  function voronoi(sites, box) {
    const cells = sites.map((s, i) => {
      let poly = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]];
      sites.forEach((o, j) => { if (j !== i && (o[0] !== s[0] || o[1] !== s[1])) poly = clip(poly, ...half(s, o)); });
      return poly;
    });
    const edges = [];
    for (let a = 0; a < sites.length; a++) for (let b = a + 1; b < sites.length; b++) {
      const [ha, hb, hc] = half(sites[a], sites[b]), n = Math.hypot(ha, hb);
      if (!n) continue;
      const on = cells[a].filter(p => Math.abs(ha * p[0] + hb * p[1] - hc) / n < 1e-7);
      if (on.length < 2) continue;
      let best = null, d = 1e-6;
      for (const p of on) for (const q of on) { const e = Math.hypot(p[0] - q[0], p[1] - q[1]); if (e > d) { d = e; best = [p, q]; } }
      if (best) edges.push({ a, b, p: best[0], q: best[1] });
    }
    return { cells, edges };
  }
  const neighbors = (sites, box) => new Set(voronoi(sites, box).edges.map(e => e.a + '-' + e.b));

  // 수직이등분선: ax+by+c=0, 기울기(세로선이면 null). 두 점이 같으면 null
  function perpBisector(A, B) {
    const dx = B[0] - A[0], dy = B[1] - A[1];
    if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return null;
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    return { mid, slope: Math.abs(dy) < EPS ? null : (dx === 0 ? 0 : -dx / dy), line: [dx, dy, -(dx * mid[0] + dy * mid[1])] };
  }
  function sameLine(l1, l2, eps = 1e-6) {
    const n1 = Math.hypot(l1[0], l1[1]), n2 = Math.hypot(l2[0], l2[1]);
    if (!n1 || !n2) return false;
    const u = l1.map(v => v / n1), w = l2.map(v => v / n2);
    const s = Math.abs(u[0] - w[0]) + Math.abs(u[1] - w[1]) < 1e-9 ? 1 : -1;
    return u.every((v, i) => Math.abs(v - s * w[i]) < eps);
  }
  // f(x,y)=좌변-우변 이 일차식이면 [a,b,c]
  function lineOf(f) {
    const c = f(0, 0), a = f(1, 0) - c, b = f(0, 1) - c;
    if (![a, b, c].every(Number.isFinite) || (Math.abs(a) < EPS && Math.abs(b) < EPS)) return null;
    for (const [x, y] of [[2.7, -1.3], [-4.1, 3.9], [7.3, 5.2], [-2.2, -6.6]]) {
      const v = f(x, y);
      if (!Number.isFinite(v) || Math.abs(v - (a * x + b * y + c)) > 1e-6 * (1 + Math.abs(v))) return null;
    }
    return [a, b, c];
  }

  // 흐린 Lab 사진(lab: w*h*3) 위 선분 p→q 중 「두 초코볼 자기 색이 아닌 제3의 색」인 부분의 비율(%).
  // 각 끝에서 초코볼(skip px) 바로 바깥 색을 그 영역 색으로 봄. 하얀 바탕(채도 < 12)은 셈에서 뺌.
  // shortcut: 사이에 낀 영역이 A나 B와 같은 색이면 못 찾음 — 경고용이라 그대로 둠
  function otherColour(lab, w, h, p, q, skip, tol = 20) {
    const at = (x, y) => { x = Math.max(0, Math.min(w - 1, Math.floor(x))); y = Math.max(0, Math.min(h - 1, Math.floor(y))); const o = (y * w + x) * 3; return [lab[o], lab[o + 1], lab[o + 2]]; };
    const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L <= 3.2 * skip) return 0;
    const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L;
    const ring = (c, s) => { const m = [0, 0, 0]; for (let k = 0; k < 7; k++) at(c[0] + s * ux * (skip * 1.6 + 2 * k), c[1] + s * uy * (skip * 1.6 + 2 * k)).forEach((v, i) => { m[i] += v / 7; }); return m; };
    const cA = ring(p, 1), cB = ring(q, -1); let n = 0, o = 0;
    for (let t = skip * 1.6; t <= L - skip * 1.6; t++) {
      const c = at(p[0] + ux * t, p[1] + uy * t); if (Math.hypot(c[1], c[2]) < 12) continue;
      n++; if (Math.min(dist(c, cA), dist(c, cB)) > tol) o++;
    }
    return n ? Math.round(100 * o / n) : 0;
  }

  // 도전 문제: 기준판(①)을 정수만큼 평행이동한 5버전. 숨은 학교 A, B가 답
  const OTHERS = [[5.61, 1.66], [8.05, 6.44], [7.17, 7.38], [11.17, 7.63]];
  const ORIGIN = [-0.03, -1.04];   // 지도 그림 왼쪽 아래 모서리(기준판)
  const SHIFT = { 1: [0, 0], 2: [1, 0], 3: [0, 1], 4: [2, 1], 5: [-1, 2] };
  const r2 = v => Math.round(v * 100) / 100;
  const mv = (p, id) => [r2(p[0] - SHIFT[id][0]), r2(p[1] - SHIFT[id][1])];
  const VERSIONS = [1, 2, 3, 4, 5].map(id => {
    const P = mv([5.5, 4.5], id), Q = mv([9, 9], id), A = mv([7, 4], id), B = mv([10, 8], id);
    return { id, shift: SHIFT[id], P, Q, A, B, lineA: perpBisector(P, A).line, lineB: perpBisector(Q, B).line };
  });
  const others = id => OTHERS.map(p => mv(p, id));
  const mapOrigin = id => mv(ORIGIN, id);
  // 화면 좌표(버전) ↔ 기준판 좌표
  const toBase = (p, id) => [r2(p[0] + SHIFT[id][0]), r2(p[1] + SHIFT[id][1])];

  const Geo = { voronoi, neighbors, perpBisector, sameLine, lineOf, otherColour, VERSIONS, others, mapOrigin, toBase, SHIFT };
  if (typeof module !== 'undefined' && module.exports) module.exports = Geo; else window.Geo = Geo;
})();
