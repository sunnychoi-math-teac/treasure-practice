/* 수식 해석 엔진 — activities/treasure/index.html(보물을 찾아라) 347~646행을 그대로 복사. 보물 파일은 그대로 둠.
 * © 2026 경남고등학교 수학과 최선지 선생님 */
(function (G) {
  'use strict';

  /* ---------- LaTeX → 일반 수식 문자열 ---------- */
  function readGroup(s, i) {
    // s[i] === '{'  → returns [content, nextIndex]
    if (s[i] !== '{') {
      // single token (e.g. ^2 or \frac12)
      if (s[i] === '\\') {
        let j = i + 1;
        while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
        return [s.slice(i, j), j];
      }
      return [s[i] || '', i + 1];
    }
    let depth = 0, j = i;
    for (; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { depth--; if (depth === 0) break; }
    }
    return [s.slice(i + 1, j), j + 1];
  }

  function latexToPlain(tex) {
    if (tex == null) return '';
    let s = String(tex);
    s = s.replace(/\\left|\\right|\\bigl|\\bigr|\\Bigl|\\Bigr/g, '');
    s = s.replace(/\\placeholder\{[^}]*\}|\\placeholder/g, '');
    s = s.replace(/\\(mathrm|operatorname|text|mathit|textrm)\{([^}]*)\}/g, '$2');
    s = s.replace(/\\[,;:! ]|\\quad|\\qquad|~/g, '');
    s = s.replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/');
    s = s.replace(/\\pi/g, 'pi').replace(/\\lbrace|\\\{/g, '(').replace(/\\rbrace|\\\}/g, ')');
    s = s.replace(/\\lbrack/g, '(').replace(/\\rbrack/g, ')');
    s = s.replace(/\\le|\\leq/g, '<=').replace(/\\ge|\\geq/g, '>=');
    s = s.replace(/[−–]/g, '-').replace(/\\imaginaryI/g, 'i').replace(/\\exponentialE/g, 'e');
    let out = '', i = 0;
    while (i < s.length) {
      if (s.startsWith('\\dfrac', i) || s.startsWith('\\tfrac', i) || s.startsWith('\\frac', i)) {
        i += s.startsWith('\\frac', i) ? 5 : 6;
        while (s[i] === ' ') i++;
        const [a, i2] = readGroup(s, i); let k = i2; while (s[k] === ' ') k++;
        const [b, i3] = readGroup(s, k);
        out += '((' + latexToPlain(a) + ')/(' + latexToPlain(b) + '))';
        i = i3; continue;
      }
      if (s.startsWith('\\sqrt', i)) {
        i += 5; let n = null;
        if (s[i] === '[') { const e = s.indexOf(']', i); n = s.slice(i + 1, e); i = e + 1; }
        const [a, i2] = readGroup(s, i);
        out += n ? 'root(' + latexToPlain(a) + ',' + latexToPlain(n) + ')' : 'sqrt(' + latexToPlain(a) + ')';
        i = i2; continue;
      }
      if (s[i] === '^') {
        i++; while (s[i] === ' ') i++;
        const [a, i2] = readGroup(s, i);
        out += '^(' + latexToPlain(a) + ')'; i = i2; continue;
      }
      if (s[i] === '_') { const [, i2] = readGroup(s, i + 1); i = i2; continue; }
      if (s[i] === '{') { out += '('; i++; continue; }
      if (s[i] === '}') { out += ')'; i++; continue; }
      if (s[i] === '\\') { // unknown command → drop
        let j = i + 1; while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
        const cmd = s.slice(i + 1, j);
        if (cmd === 'sqrt') { i = j; continue; }
        out += ' '; i = j; continue;
      }
      out += s[i]; i++;
    }
    return out;
  }

  /* ---------- 토크나이저 · 파서 ---------- */
  const FUNCS = { sqrt: 1, abs: 1, root: 1 };
  function tokenize(str) {
    const t = []; let i = 0; const s = str.replace(/\s+/g, '');
    while (i < s.length) {
      const c = s[i];
      if (/[0-9.]/.test(c)) {
        let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const v = parseFloat(s.slice(i, j)); if (isNaN(v)) throw new Error('숫자를 확인하세요');
        t.push({ k: 'num', v }); i = j; continue;
      }
      if (/[a-zA-Z]/.test(c)) {
        let matched = null;
        for (const w of ['sqrt', 'root', 'abs', 'pi']) if (s.startsWith(w, i)) { matched = w; break; }
        if (matched) { t.push({ k: 'id', v: matched }); i += matched.length; continue; }
        t.push({ k: 'id', v: c }); i++; continue;
      }
      if (s.startsWith('<=', i) || s.startsWith('>=', i)) { t.push({ k: 'op', v: s.substr(i, 2) }); i += 2; continue; }
      if ('+-*/^(),=<>'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
      if (c === '[') { t.push({ k: 'op', v: '(' }); i++; continue; }
      if (c === ']') { t.push({ k: 'op', v: ')' }); i++; continue; }
      throw new Error('알 수 없는 기호: ' + c);
    }
    return t;
  }

  function parse(str, funcNames) {
    const fn = Object.assign({}, FUNCS);
    (funcNames || []).forEach(n => fn[n] = 1);
    const toks = tokenize(str); let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const isOp = (v) => toks[p] && toks[p].k === 'op' && toks[p].v === v;
    function startsPrimary(tk) { return tk && (tk.k === 'num' || tk.k === 'id' || (tk.k === 'op' && tk.v === '(')); }
    function parseEq() {
      const a = parseExpr();
      if (isOp('=')) { next(); const b = parseExpr(); return { t: 'eq', a, b }; }
      return a;
    }
    function parseExpr() {
      let a = parseTerm();
      while (isOp('+') || isOp('-')) { const o = next().v; const b = parseTerm(); a = { t: o, a, b }; }
      return a;
    }
    function parseTerm() {
      let a = parseUnary();
      for (;;) {
        if (isOp('*') || isOp('/')) { const o = next().v; const b = parseUnary(); a = { t: o, a, b }; continue; }
        if (startsPrimary(peek())) { const b = parsePow(); a = { t: '*', a, b }; continue; }
        break;
      }
      return a;
    }
    function parseUnary() {
      if (isOp('-')) { next(); return { t: 'neg', a: parseUnary() }; }
      if (isOp('+')) { next(); return parseUnary(); }
      return parsePow();
    }
    function parsePow() {
      const base = parsePrimary();
      if (isOp('^')) { next(); const e = parseUnary(); return { t: '^', a: base, b: e }; }
      return base;
    }
    function parsePrimary() {
      const tk = next();
      if (!tk) throw new Error('식이 덜 끝났어요');
      if (tk.k === 'num') return { t: 'num', v: tk.v };
      if (tk.k === 'id') {
        if (fn[tk.v] && isOp('(')) {
          next(); const args = [];
          if (!isOp(')')) { args.push(parseExpr()); while (isOp(',')) { next(); args.push(parseExpr()); } }
          if (!isOp(')')) throw new Error('괄호가 닫히지 않았어요'); next();
          return { t: 'call', f: tk.v, args };
        }
        if (tk.v === 'pi') return { t: 'num', v: Math.PI };
        if (tk.v === 'e') return { t: 'num', v: Math.E };
        return { t: 'var', v: tk.v };
      }
      if (tk.k === 'op' && tk.v === '(') {
        const a = parseExpr();
        if (isOp(',')) { const items = [a]; while (isOp(',')) { next(); items.push(parseExpr()); } if (!isOp(')')) throw new Error('괄호가 닫히지 않았어요'); next(); return { t: 'tuple', items }; }
        if (!isOp(')')) throw new Error('괄호가 닫히지 않았어요'); next();
        return a;
      }
      throw new Error('식을 다시 확인하세요');
    }
    const ast = parseEq();
    if (p < toks.length) throw new Error('식을 다시 확인하세요');
    return ast;
  }

  function evalAst(n, env, F) {
    switch (n.t) {
      case 'num': return n.v;
      case 'var': if (n.v in env) return env[n.v]; throw new Error('사용할 수 없는 문자: ' + n.v);
      case 'neg': return -evalAst(n.a, env, F);
      case '+': return evalAst(n.a, env, F) + evalAst(n.b, env, F);
      case '-': return evalAst(n.a, env, F) - evalAst(n.b, env, F);
      case '*': return evalAst(n.a, env, F) * evalAst(n.b, env, F);
      case '/': return evalAst(n.a, env, F) / evalAst(n.b, env, F);
      case '^': { const a = evalAst(n.a, env, F), b = evalAst(n.b, env, F); return Math.pow(a, b); }
      case 'call': {
        const args = n.args.map(x => evalAst(x, env, F));
        if (n.f === 'sqrt') return Math.sqrt(args[0]);
        if (n.f === 'abs') return Math.abs(args[0]);
        if (n.f === 'root') return Math.sign(args[0]) * Math.pow(Math.abs(args[0]), 1 / args[1]);
        if (F && F[n.f]) return F[n.f].apply(null, args);
        throw new Error('알 수 없는 함수: ' + n.f);
      }
      case 'eq': return evalAst(n.a, env, F) - evalAst(n.b, env, F);
      case 'tuple': throw new Error('좌표가 아니라 식을 입력하세요');
    }
    throw new Error('식 오류');
  }

  // 식(또는 방정식) → (x,y)=>값  (방정식이면 좌변-우변)
  function compileXY(plain, F) {
    const ast = parse(plain, Object.keys(F || {}));
    if (ast.t === 'tuple') throw new Error('좌표가 아니라 식을 입력하세요');
    // 실제로 계산되는지 한 번 시험
    const fnc = (x, y) => { try { return evalAst(ast, { x, y }, F); } catch (e) { return NaN; } };
    evalAst(ast, { x: 0.123, y: 0.456 }, F);
    return { ast, f: fnc };
  }

  // "(10,13)" → [10,13]
  function parsePoint(plain) {
    const ast = parse(plain, []);
    if (ast.t !== 'tuple' || ast.items.length !== 2) throw new Error('(x좌표, y좌표) 꼴로 입력하세요');
    return ast.items.map(it => evalAst(it, {}, {}));
  }
  function parseNumber(plain) {
    const ast = parse(plain, []);
    if (ast.t === 'tuple' || ast.t === 'eq') throw new Error('수 하나를 입력하세요');
    return evalAst(ast, {}, {});
  }

  /* ---------- 음함수 곡선 (marching squares) ---------- */
  function contour(f, view, nx, ny) {
    nx = nx || 240; ny = ny || Math.round(nx * (view.y1 - view.y0) / (view.x1 - view.x0));
    const dx = (view.x1 - view.x0) / nx, dy = (view.y1 - view.y0) / ny;
    const V = new Float64Array((nx + 1) * (ny + 1));
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[j * (nx + 1) + i] = f(view.x0 + i * dx, view.y0 + j * dy);
    const segs = [];
    const lerp = (x0, y0, v0, x1, y1, v1) => { const t = v0 / (v0 - v1); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]; };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = V[j * (nx + 1) + i], b = V[j * (nx + 1) + i + 1], c = V[(j + 1) * (nx + 1) + i + 1], d = V[(j + 1) * (nx + 1) + i];
      if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(d)) continue;
      const x0 = view.x0 + i * dx, y0 = view.y0 + j * dy, x1 = x0 + dx, y1 = y0 + dy;
      const pts = [];
      if ((a > 0) !== (b > 0)) pts.push(lerp(x0, y0, a, x1, y0, b));
      if ((b > 0) !== (c > 0)) pts.push(lerp(x1, y0, b, x1, y1, c));
      if ((c > 0) !== (d > 0)) pts.push(lerp(x1, y1, c, x0, y1, d));
      if ((d > 0) !== (a > 0)) pts.push(lerp(x0, y1, d, x0, y0, a));
      if (pts.length < 2) continue;
      // 극(무한대 점프) 거르기
      const m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
      const mid = f((x0 + x1) / 2, (y0 + y1) / 2);
      if (isFinite(mid) && Math.abs(mid) > 4 * m + 1e-9) continue;
      if (pts.length === 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
      else { segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]); segs.push([pts[2][0], pts[2][1], pts[3][0], pts[3][1]]); }
    }
    return { segs, cell: Math.max(dx, dy) };
  }

  // 선분들을 이어 폴리라인으로
  function chain(segs, eps) {
    eps = eps || 1e-6;
    const key = (x, y) => Math.round(x / eps) + ',' + Math.round(y / eps);
    const map = new Map(); const used = new Uint8Array(segs.length);
    segs.forEach((s, i) => {
      [key(s[0], s[1]), key(s[2], s[3])].forEach(k => { if (!map.has(k)) map.set(k, []); map.get(k).push(i); });
    });
    const lines = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; used[i] = 1;
      const s = segs[i]; let line = [[s[0], s[1]], [s[2], s[3]]];
      for (const dir of [1, 0]) {
        for (;;) {
          const end = dir ? line[line.length - 1] : line[0];
          const cand = (map.get(key(end[0], end[1])) || []).find(j => !used[j]);
          if (cand === undefined) break;
          used[cand] = 1; const t = segs[cand];
          const k0 = key(t[0], t[1]) === key(end[0], end[1]);
          const nxt = k0 ? [t[2], t[3]] : [t[0], t[1]];
          if (dir) line.push(nxt); else line.unshift(nxt);
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function samplePoints(f, view, n) {
    const { segs } = contour(f, view, n || 260);
    return segs.map(s => [(s[0] + s[2]) / 2, (s[1] + s[3]) / 2]);
  }
  function distToCurve(f, x, y) {
    const h = 1e-4, v = f(x, y);
    if (!isFinite(v)) return Infinity;
    const gx = (f(x + h, y) - f(x - h, y)) / (2 * h), gy = (f(x, y + h) - f(x, y - h)) / (2 * h);
    const g = Math.hypot(gx, gy);
    if (!isFinite(g)) return Infinity;
    if (g < 1e-12) return Math.abs(v) < 1e-9 ? 0 : Infinity;
    return Math.abs(v) / g;
  }
  // 두 음함수 곡선이 (보이는 범위에서) 같은지
  function curvesMatch(fTarget, fStudent, view, tol) {
    const n = 220;
    const A = samplePoints(fTarget, view, n), B = samplePoints(fStudent, view, n);
    if (!B.length || !A.length) return false;
    const cell = (view.x1 - view.x0) / n; tol = tol || Math.max(0.06, cell * 1.5);
    const okA = A.filter(p => distToCurve(fStudent, p[0], p[1]) < tol).length / A.length;
    const okB = B.filter(p => distToCurve(fTarget, p[0], p[1]) < tol).length / B.length;
    return okA > 0.97 && okB > 0.97;
  }

  /* ---------- 분수 표시 ---------- */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
  function fracTex(p, q) {
    if (q === 0) return '\\text{정의되지 않음}';
    if (q < 0) { p = -p; q = -q; }
    const g = gcd(p, q) || 1; p /= g; q /= g;
    if (q === 1) return String(p);
    return (p < 0 ? '-' : '') + '\\frac{' + Math.abs(p) + '}{' + q + '}';
  }
  function fmt(v) { const r = Math.round(v * 1000) / 1000; return (Object.is(r, -0) ? 0 : r).toString(); }

  G.TMath = { latexToPlain, parse, evalAst, compileXY, parsePoint, parseNumber, contour, chain, samplePoints, distToCurve, curvesMatch, fracTex, gcd, fmt };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.TMath;
