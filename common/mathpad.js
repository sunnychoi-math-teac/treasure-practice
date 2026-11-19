/* 수식 입력칸 + 앱 자판 — activities/treasure/index.html(보물을 찾아라)의 el·withKeyBtn·mathInput·KP·자판 CSS를 복사.
 * 보물 파일은 그대로 둠. 쓰는 법: await MathPad.ready(); const w = MathPad.mathInput('', onEnter); w.tex()/w.plain()/w.setTex()
 * 자판은 화면에 .ws-dock 이 있으면 그 안에 붙음(그래프를 가리지 않게).
 * © 2026 경남고등학교 수학과 최선지 선생님 · 수식 입력: MathLive (MIT License) */
(function () {
  'use strict';
  const M = window.TMath;
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v);
    }
    (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach(k => { if (k == null || k === false) return; e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); });
    return e;
  }
  let MATHLIVE = false;
  // 입력칸 안의 자판 버튼 (데스모스처럼 누를 때만 자판이 열림)
  function withKeyBtn(field) {
    const btn = el('button', { class: 'kp-toggle', type: 'button', title: '수식 자판', 'aria-label': '수식 자판 열기' }, el('span', { 'aria-hidden': 'true', text: '⌨' }));
    btn.addEventListener('pointerdown', e => e.preventDefault());
    btn.addEventListener('click', () => { if (KP.isOpenFor(field)) { KP.close(); return; } KP.open(field); try { field.focus(); } catch (e) { } });
    const wrap = el('span', { class: 'mf-wrap' }, [field, btn]);
    wrap.field = field; wrap.tex = field.tex; wrap.plain = field.plain; wrap.setTex = field.setTex;
    Object.defineProperty(wrap, 'value', { get: () => field.value, set: v => { field.value = v; } });
    wrap.focus = () => field.focus();
    return wrap;
  }
  function mathInput(tex, onEnter, onInput) {
    if (MATHLIVE) {
      const mf = new window.MathfieldElement();
      mf.setAttribute('math-virtual-keyboard-policy', 'manual');
      mf.addEventListener('focusin', () => KP.retarget(mf));
      mf.value = tex || '';
      try { mf.menuItems = []; } catch (e) { }
      mf.smartFence = true;
      mf.addEventListener('keydown', e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } });
      if (onInput) mf.addEventListener('input', () => onInput());
      mf.tex = () => mf.value; mf.plain = () => M.latexToPlain(mf.value); mf.setTex = v => { mf.value = v; };
      return withKeyBtn(mf);
    }
    const inp = el('input', { class: 'mf-fallback', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    inp.addEventListener('focusin', () => KP.retarget(inp));
    inp.value = M.latexToPlain(tex || '').replace(/\(\(([^()]*)\)\/\(([^()]*)\)\)/g, '$1/$2');
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && onEnter) onEnter(); });
    if (onInput) inp.addEventListener('input', () => onInput());
    inp.tex = () => inp.value; inp.plain = () => inp.value.replace(/×/g, '*').replace(/÷/g, '/'); inp.setTex = v => { inp.value = M.latexToPlain(v); };
    return withKeyBtn(inp);
  }


  /* ---------- 수식 자판 (앱 안에 직접 그리는 키패드) ---------- */
  const KP = (function () {
    let target = null, box = null;
    // 초코볼 다이어그램용(선생님 요청): 왼쪽 숫자 3×4, 오른쪽 기호. f·g·h·i·x²·xⁿ·√ 는 뺌. ['', 'gap'] 은 왼쪽·오른쪽 사이 빈칸
    const K = [
      [['7', '7'], ['8', '8'], ['9', '9'], ['', 'gap'], ['x', 'x'], ['y', 'y'], ['(', '('], [')', ')']],
      [['4', '4'], ['5', '5'], ['6', '6'], ['', 'gap'], ['+', '+'], ['−', '-'], ['×', 'times'], ['÷', 'div']],
      [['1', '1'], ['2', '2'], ['3', '3'], ['', 'gap'], [',', ','], ['=', '='], ['분수', 'frac'], ['◀', 'left']],
      [['0', '0'], ['.', '.'], ['⌫', 'back'], ['', 'gap'], ['▶', 'right'], ['모두 지우기', 'clear'], ['자판 닫기', 'close'], ['입력 ↵', 'enter']]
    ];
    const TEX = { times: '\\times', div: '\\div', frac: '\\frac{#?}{#?}', sq: '^2', pow: '^{#?}', sqrt: '\\sqrt{#?}' };
    const TXT = { times: '*', div: '/', frac: '/', sq: '^2', pow: '^', sqrt: 'sqrt(' };
    function press(code) {
      if (code === 'close') return close();
      const t = target; if (!t) return;
      const isMF = t.tagName === 'MATH-FIELD';
      if (code === 'enter') { t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return; }
      if (isMF) {
        if (code === 'back') t.executeCommand('deleteBackward');
        else if (code === 'left') t.executeCommand('moveToPreviousChar');
        else if (code === 'right') t.executeCommand('moveToNextChar');
        else if (code === 'clear') { t.value = ''; }
        else t.executeCommand(['insert', TEX[code] || code, { format: 'latex', focus: true }]);
        t.focus();
      } else {
        const a = t.selectionStart ?? t.value.length, b = t.selectionEnd ?? a, v = t.value;
        if (code === 'back') { const c = a === b ? Math.max(0, a - 1) : a; t.value = v.slice(0, c) + v.slice(b); t.setSelectionRange(c, c); }
        else if (code === 'left') t.setSelectionRange(Math.max(0, a - 1), Math.max(0, a - 1));
        else if (code === 'right') t.setSelectionRange(a + 1, a + 1);
        else if (code === 'clear') t.value = '';
        else { const ins = TXT[code] || code; t.value = v.slice(0, a) + ins + v.slice(b); t.setSelectionRange(a + ins.length, a + ins.length); }
      }
      t.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function build() {
      box = el('div', { class: 'keypad', role: 'group', 'aria-label': '수식 자판', hidden: '' });
      K.forEach(row => {
        const r = el('div', { class: 'kp-row' });
        row.forEach(([label, code, span]) => {
          if (code === 'gap') { r.appendChild(el('span', { 'aria-hidden': 'true' })); return; }
          const b = el('button', { class: 'kp-key' + (/^[0-9.]$/.test(code) ? ' num' : '') + (['close', 'enter', 'clear', 'back'].includes(code) ? ' fn' : ''), type: 'button', text: label, style: span ? `grid-column:span ${span}` : null });
          b.addEventListener('pointerdown', e => { e.preventDefault(); press(code); });
          b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(code); } });
          r.appendChild(b);
        });
        box.appendChild(r);
      });
      document.body.appendChild(box);
    }
    function open(t) {
      if (!box) build();
      const dock = document.querySelector('.ws-dock');
      if (dock) { if (box.parentElement !== dock) dock.appendChild(box); box.classList.add('docked'); }
      else { if (box.parentElement !== document.body) document.body.appendChild(box); box.classList.remove('docked'); }
      target = t; box.hidden = false; document.body.classList.add('kp-open'); mark();
      setTimeout(() => { try { (t.closest ? (t.closest('.mf-wrap') || t) : t).scrollIntoView({ block: 'nearest' }); } catch (e) { } }, 60);
    }
    function close() { if (box) box.hidden = true; document.body.classList.remove('kp-open'); mark(); }
    function isOpen() { return !!box && !box.hidden; }
    function mark() { document.querySelectorAll('.mf-wrap').forEach(w => w.classList.toggle('kp-on', isOpen() && w.field === target)); }
    function retarget(t) { if (isOpen()) { target = t; mark(); } }
    function isOpenFor(t) { return isOpen() && target === t; }
    return { open, close, retarget, isOpenFor };
  })();
  const CSS = `
math-field,.mf-fallback{flex:1;min-width:120px;font-size:21px;border:2px solid #C5CBE6;border-radius:10px;background:#fff;padding:5px 9px}
math-field:focus-within,.mf-fallback:focus{outline:3px solid rgba(26,31,77,.25);border-color:#1A1F4D}
math-field::part(menu-toggle),math-field::part(virtual-keyboard-toggle){display:none}
.mf-fallback{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:19px}
.mf-wrap{position:relative;flex:1;min-width:120px;display:flex}
.mf-wrap>math-field,.mf-wrap>.mf-fallback{flex:1;min-width:0;padding-right:50px}
.kp-toggle{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:40px;height:32px;border-radius:8px;border:1.5px solid #C5CBE6;background:#F4F5F9;color:#1A1F4D;font-size:19px;line-height:1;cursor:pointer;display:grid;place-items:center;z-index:2}
.mf-wrap.kp-on .kp-toggle{background:#1A1F4D;border-color:#1A1F4D;color:#fff}
.keypad{position:fixed;left:0;right:0;bottom:0;z-index:70;background:#2A2F5E;padding:8px;display:flex;flex-direction:column;gap:6px;align-items:center;box-shadow:0 -6px 18px rgba(0,0,0,.25)}
.kp-row{display:grid;grid-template-columns:repeat(3,1fr) 10px repeat(4,1fr);gap:6px;width:min(720px,100%)}
.kp-key{min-height:44px;border:0;border-radius:9px;background:#E9E6FB;color:#1A1F4D;font-size:19px;font-family:'Times New Roman',Georgia,serif;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.kp-key.num{background:#fff}
.kp-key.fn{background:#FFC93C;color:#1A1F4D;font-family:inherit;font-size:14px;font-weight:700}
.kp-key:active{transform:translateY(1px);filter:brightness(.92)}
.keypad.docked{position:static;padding:6px;gap:4px;box-shadow:0 -4px 12px rgba(0,0,0,.18)}
.keypad.docked .kp-row{width:100%;gap:4px}
.keypad.docked .kp-key{min-height:38px;font-size:16px;padding:0;min-width:0;white-space:nowrap}
.keypad.docked .kp-key.fn{font-size:12px}
[hidden]{display:none!important}`;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  // MathLive가 7초 안에 안 오면 일반 입력칸으로(보물과 같은 방식)
  function ready() {
    const ml = (window.customElements && customElements.whenDefined) ? Promise.race([customElements.whenDefined('math-field').then(() => true), new Promise(r => setTimeout(() => r(false), 7000))]) : Promise.resolve(false);
    return ml.then(ok => {
      MATHLIVE = ok;
      if (ok && window.MathfieldElement) { try { window.MathfieldElement.soundsDirectory = null; window.MathfieldElement.fontsDirectory = 'https://cdn.jsdelivr.net/npm/mathlive@0.108.2/fonts/'; } catch (e) { } }
      return ok;
    });
  }
  window.MathPad = { ready, mathInput, KP };
})();
