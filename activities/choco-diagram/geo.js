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

  // 사진 속 실제 색 경계 찾기: AB에 평행한 여러 줄을 따라 가며 A 색 → B 색으로 바뀌는 곳을 모아 직선으로 맞춤(픽셀 좌표).
  // 반환 { m: 지나는 점, d: 방향(단위), n: 찾은 점 수 } 또는 null(점 4개 미만)
  function boundaryFit(lab, w, h, p, q, skip, tol = 20) {
    const at = (x, y) => { x = Math.max(0, Math.min(w - 1, Math.floor(x))); y = Math.max(0, Math.min(h - 1, Math.floor(y))); const o = (y * w + x) * 3; return [lab[o], lab[o + 1], lab[o + 2]]; };
    const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L <= 3.2 * skip) return null;
    const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L, nx = -uy, ny = ux;
    const ring = (c, s) => { const m = [0, 0, 0]; for (let k = 0; k < 7; k++) at(c[0] + s * ux * (skip * 1.6 + 2 * k), c[1] + s * uy * (skip * 1.6 + 2 * k)).forEach((v, i) => { m[i] += v / 7; }); return m; };
    const cA = ring(p, 1), cB = ring(q, -1);
    if (dist(cA, cB) < tol) return null;                              // 두 영역 색이 같으면 구별 못 함
    const pts = [];
    for (let k = -10; k <= 10; k++) {
      const s = k * L * 0.04, ox = p[0] + nx * s, oy = p[1] + ny * s;
      const lab1 = []; for (let t = skip * 1.2; t <= L - skip * 1.2; t++) {
        const x = ox + ux * t, y = oy + uy * t; if (x < 0 || y < 0 || x >= w || y >= h) { lab1.push(null); continue; }
        const c = at(x, y), a = dist(c, cA), b = dist(c, cB); lab1.push(Math.min(a, b) > 1.5 * tol ? null : a < b ? 'A' : 'B');
      }
      const ia = lab1.lastIndexOf('A'), ib = lab1.indexOf('B');
      if (ia < 0 || ib < 0 || ib < ia - 3) continue;                    // A 다음 B 가 아니면 버림
      const t = skip * 1.2 + (ia + ib) / 2; pts.push([ox + ux * t, oy + uy * t]);
    }
    if (pts.length < 4) return null;
    const m = pts.reduce((a, v) => [a[0] + v[0] / pts.length, a[1] + v[1] / pts.length], [0, 0]);
    let sxx = 0, sxy = 0, syy = 0; pts.forEach(([x, y]) => { sxx += (x - m[0]) ** 2; sxy += (x - m[0]) * (y - m[1]); syy += (y - m[1]) ** 2; });
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy);                    // 주축 방향
    return { m, d: [Math.cos(th), Math.sin(th)], n: pts.length };
  }
  // 경계를 못 찾을 때 쓰는 두 번째 방법: 학생 직선(사진 픽셀의 두 점 l1, l2)의 양옆 색이
  // A쪽은 A 둘레 색, B쪽은 B 둘레 색에 더 가까운가. 직선을 따라 ±0.45|AB|, 양옆 0.12|AB| 에서 비교해 75% 이상이면 성공
  // (같은 기준이면 약 28° 기운 선까지 성공, 45°는 실패)
  function sideCheck(lab, w, h, p, q, skip, l1, l2, tol = 12, need = 0.75) {
    const at = (x, y) => { x = Math.max(0, Math.min(w - 1, Math.floor(x))); y = Math.max(0, Math.min(h - 1, Math.floor(y))); const o = (y * w + x) * 3; return [lab[o], lab[o + 1], lab[o + 2]]; };
    const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L <= 2.4 * skip) return null;
    const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L;
    const ring = (c, s) => { const m = [0, 0, 0]; for (let k = 0; k < 7; k++) at(c[0] + s * ux * (skip * 1.4 + 2 * k), c[1] + s * uy * (skip * 1.4 + 2 * k)).forEach((v, i) => { m[i] += v / 7; }); return m; };
    const cA = ring(p, 1), cB = ring(q, -1); if (dist(cA, cB) < tol) return null;
    const el = Math.hypot(l2[0] - l1[0], l2[1] - l1[1]), ex = (l2[0] - l1[0]) / el, ey = (l2[1] - l1[1]) / el;
    let nx = -ey, ny = ex; if ((p[0] - l1[0]) * nx + (p[1] - l1[1]) * ny < 0) { nx = -nx; ny = -ny; }   // n 은 A 쪽
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], t0 = (mid[0] - l1[0]) * ex + (mid[1] - l1[1]) * ey, M = [l1[0] + ex * t0, l1[1] + ey * t0];
    const d = 0.12 * L; let good = 0, all = 0;
    for (let k = -9; k <= 9; k++) {
      const s = k / 9 * 0.45 * L, c = [M[0] + ex * s, M[1] + ey * s];
      [[1, cA, cB], [-1, cB, cA]].forEach(([sg, mine, other]) => {
        const x = c[0] + nx * d * sg, y = c[1] + ny * d * sg; if (x < 0 || y < 0 || x >= w || y >= h) return;
        const v = at(x, y); all++; if (dist(v, mine) < dist(v, other)) good++;
      });
    }
    if (all < 10) return null;
    return { ok: good / all >= need, frac: good / all };
  }
  // 학생 직선 ax+by+c=0 과 찾은 경계(b.m, b.d)가 비슷한가: 기울기 차 ≤ 25°, 치우침 ≤ AB 길이 × 0.2
  // (선생님 사진 시험: 바른 수직이등분선 1~22°·치우침 ≤0.13, 45° 돌린 선은 대부분 36° 이상)
  function lineVsBoundary(l, b, ab, maxDeg = 25, maxShift = 0.2) {
    const [a, bb, c] = l, nn = Math.hypot(a, bb), dl = [bb / nn, -a / nn];
    const cos = Math.abs(dl[0] * b.d[0] + dl[1] * b.d[1]), deg = Math.acos(Math.min(1, cos)) * 180 / Math.PI;
    const shift = Math.abs(a * b.m[0] + bb * b.m[1] + c) / nn / ab;
    return { ok: deg <= maxDeg && shift <= maxShift, deg, shift };
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

  const Geo = { voronoi, neighbors, perpBisector, sameLine, lineOf, otherColour, boundaryFit, lineVsBoundary, sideCheck, VERSIONS, others, mapOrigin, toBase, SHIFT };
  if (typeof module !== 'undefined' && module.exports) module.exports = Geo; else window.Geo = Geo;
})();
