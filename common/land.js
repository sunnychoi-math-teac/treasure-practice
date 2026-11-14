/*
 * Math Land Explorers · 공통 코드 (common/land.js)
 * © 2026 경남고등학교 수학과 최선지 선생님 · Math Land Explorers
 *
 * 쓰는 법 (활동 화면):
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
 *   <script src="../../common/land.js"></script>
 *   const enter = await Land.start({ slug: 'jungle-run', title: '무리수 사냥' });
 *   //  enter.student  : { no, name, grade, class_no, year }
 *   //  enter.run      : { id, mode, label, version, ends_at }   (mode: free 자유 도전 / class 수업 / eval 수행평가)
 *   //  enter.record   : 지난번 기록(이어하기) 또는 null
 *   //  enter.readOnly : 마감·기한 지남이면 true (보기만)
 *   const saver = Land.saver(enter);         // 4초씩 모아 저장, 실패하면 다시 시도
 *   saver.save({ mission: 3, ... });         // 자세한 진행 내용(detail)
 *   await saver.finish(detail, { score: 49, level: '상-(49)', summary: '소감' });   // 완료·제출
 *
 * 학생 로그인·저장은 모두 Supabase 함수(land_login, land_enter, land_save)로만 합니다.
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://jerhkttkwvkfhiusgjhv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_MVAoOq79TXkJWwCXuPBSPQ_DvZpeCPR';   // 공개용 키(publishable)만
  const TOKEN_KEY = 'land.session';
  const SAVE_EVERY_MS = 4000;

  if (!window.supabase) { console.error('[Land] supabase-js 를 먼저 불러와 주세요.'); return; }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ───────── 작은 도움 함수 ─────────
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MODE = { free: '자유 도전', class: '수업', eval: '수행평가' };
  function schoolYear(d = new Date()) {
    const k = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return k.getMonth() + 1 >= 3 ? k.getFullYear() : k.getFullYear() - 1;
  }
  function fmt(t, withTime = true) {
    if (!t) return '';
    const d = new Date(t);
    const o = { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' };
    if (withTime) Object.assign(o, { hour: '2-digit', minute: '2-digit', hour12: false });
    return d.toLocaleString('ko-KR', o);
  }
  const classKey = (grade, cls) => `${grade}-${cls}`;
  const classLabel = k => { const [g, c] = String(k).split('-'); return `${g}학년 ${c}반`; };
  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw error;
    return data;
  }

  // ───────── 화면 꾸밈(로그인 창·안내 창) ─────────
  const CSS = `
  .land-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;
    background:linear-gradient(160deg,#EDE9FB 0%,#DDE6FF 55%,#E4F4F1 100%);font-family:'IBM Plex Sans KR',system-ui,sans-serif;color:#1A1F4D;word-break:keep-all}
  .land-ov.dim{background:rgba(26,31,77,.55)}
  .land-box{background:#fff;border-radius:24px;box-shadow:0 12px 40px rgba(26,31,77,.18);width:100%;max-width:400px;padding:28px 28px 22px}
  .land-box h2{margin:0 0 4px;font-size:22px}
  .land-box .sub{margin:0 0 18px;color:#4A4F72;font-size:15px;line-height:1.5}
  .land-box label{display:block;font-weight:700;font-size:14px;margin:12px 0 6px}
  .land-box input{width:100%;box-sizing:border-box;font:inherit;font-size:18px;padding:11px 14px;border:2px solid #C5CBE6;border-radius:14px;color:#1A1F4D;background:#fff}
  .land-box input:focus{outline:none;border-color:#1A1F4D}
  .land-box .hint{font-size:13px;color:#6A6F8E;margin-top:4px}
  .land-btn{display:block;width:100%;margin-top:20px;min-height:50px;border:0;border-radius:999px;background:#1A1F4D;color:#fff;font:inherit;font-size:17px;font-weight:700;cursor:pointer}
  .land-btn[disabled]{opacity:.6;cursor:default}
  .land-btn.line{background:#fff;color:#1A1F4D;border:2px solid #C5CBE6;margin-top:10px}
  .land-msg{min-height:22px;margin-top:12px;color:#C0392B;font-size:14px;line-height:1.5}
  .land-msg.ok{color:#2E8B57}
  .land-who{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#F4F5F9;border-radius:14px;padding:10px 14px;margin:6px 0 4px;font-size:15px}
  .land-who button{border:0;background:none;color:#4A4F72;text-decoration:underline;font:inherit;font-size:13px;cursor:pointer}
  .land-badge{display:inline-block;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:#FFC93C;color:#1A1F4D;margin-bottom:10px}
  .land-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9998;background:#1A1F4D;color:#fff;
    padding:9px 16px;border-radius:999px;font:500 14px 'IBM Plex Sans KR',system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.2);opacity:0;transition:opacity .25s;pointer-events:none}
  .land-toast.on{opacity:1}
  .land-foot{text-align:center;font-size:12px;line-height:1.6;color:#4A4F72;margin-top:16px}
  .land-foot p{margin:0}`;
  function injectCss() {
    if (document.getElementById('land-css')) return;
    const st = document.createElement('style'); st.id = 'land-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  function overlay(html, dim) {
    injectCss();
    const ov = document.createElement('div');
    ov.className = 'land-ov' + (dim ? ' dim' : '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="land-box">${html}</div>`;
    document.body.appendChild(ov);
    return ov;
  }
  let toastTimer;
  function toast(text, ms = 1800) {
    injectCss();
    let t = document.querySelector('.land-toast');
    if (!t) { t = document.createElement('div'); t.className = 'land-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
  }
  function footerHtml(title) {
    return `<div class="land-foot">
      <p>© 2026 경남고등학교 수학과 최선지 선생님 · ${esc(title || 'Math Land Explorers')}</p>
      <p>원 저작자를 표시하면 비영리 교육 목적으로 이용할 수 있어요(CC BY-NC 4.0).</p>
      <p>저작자 표시 없는 무단 복제·배포와 상업적 이용은 금지합니다.</p></div>`;
  }

  // ───────── 학생 세션 ─────────
  function getSession() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch (e) { return null; }
  }
  function setSession(s) {
    try { s ? localStorage.setItem(TOKEN_KEY, JSON.stringify(s)) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* 저장 불가 기기 */ }
    memSession = s;
  }
  let memSession = null;
  const session = () => memSession || getSession();

  const LOGIN_MSG = {
    bad_no: '학번은 4자리 숫자예요. (예: 1학년 3반 5번 → 1305)',
    bad_name: '이름을 1~10글자로 적어 주세요.',
    bad_pin: '비밀번호는 숫자 4자리예요.',
    name_mismatch: '이 학번은 다른 이름으로 등록되어 있어요. 이름을 확인하거나 선생님께 말씀드려 주세요.',
    wrong_pin: '비밀번호가 맞지 않아요.',
    locked: '비밀번호를 여러 번 틀려서 잠시 잠겼어요.',
    moved: '전출 처리된 학번이에요. 선생님께 말씀드려 주세요.'
  };

  function loginForm(title, cancelText) {
    return new Promise(resolve => {
      const ov = overlay(`
        <span class="land-badge">Math Land Explorers</span>
        <h2>${esc(title || '수학나라')}</h2>
        <p class="sub">처음이면 지금 적은 학번·이름·비밀번호로 등록돼요.<br>다음부터 같은 비밀번호로 들어와요.</p>
        <form novalidate>
          <label for="land-no">학번 (4자리)</label>
          <input id="land-no" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="예: 1305" required>
          <div class="hint">학년 1자리 · 반 1자리 · 번호 2자리</div>
          <label for="land-name">이름</label>
          <input id="land-name" autocomplete="off" maxlength="10" required>
          <label for="land-pin">비밀번호 (숫자 4자리)</label>
          <input id="land-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="4" required>
          <button class="land-btn" type="submit">들어가기</button>
          ${cancelText ? `<button class="land-btn line" type="button" data-cancel>${esc(cancelText)}</button>` : ''}
          <div class="land-msg" aria-live="polite"></div>
        </form>${footerHtml(title)}`);
      const f = ov.querySelector('form'), msg = ov.querySelector('.land-msg'), btn = ov.querySelector('button[type=submit]');
      const cancel = ov.querySelector('[data-cancel]');
      if (cancel) cancel.addEventListener('click', () => { ov.remove(); resolve(null); });
      const no = ov.querySelector('#land-no'), nm = ov.querySelector('#land-name'), pin = ov.querySelector('#land-pin');
      const s = getSession(); if (s && s.student) { no.value = s.student.no; nm.value = s.student.name; }
      setTimeout(() => (no.value ? pin : no).focus(), 50);
      [no, pin].forEach(i => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); }));
      f.addEventListener('submit', async e => {
        e.preventDefault(); msg.className = 'land-msg'; msg.textContent = '';
        btn.disabled = true; btn.textContent = '확인 중…';
        try {
          const r = await rpc('land_login', { p_no: no.value.trim(), p_name: nm.value.trim(), p_pin: pin.value.trim() });
          if (!r.ok) {
            let t = LOGIN_MSG[r.code] || '들어가지 못했어요. 다시 해 보세요.';
            if (r.code === 'wrong_pin' && r.left != null) t += ` (${r.left}번 더 틀리면 10분 동안 잠겨요)`;
            if (r.code === 'locked') t += ` ${r.minutes || 10}분 뒤에 다시 해 보세요.`;
            msg.textContent = t; btn.disabled = false; btn.textContent = '들어가기'; pin.select(); return;
          }
          setSession({ token: r.token, student: r.student });
          ov.remove();
          if (r.code === 'new') toast(`${r.student.name} 학생, 등록했어요!`);
          if (r.code === 'reset') toast('새 비밀번호로 등록했어요.');
          resolve(r);
        } catch (err) {
          console.error(err);
          msg.textContent = '서버와 연결되지 않았어요. 인터넷 연결을 확인하고 다시 눌러 주세요.';
          btn.disabled = false; btn.textContent = '들어가기';
        }
      });
    });
  }

  const STATE_MSG = {
    no_run: ['아직 열리지 않은 활동이에요', '선생님이 활동을 열면 들어올 수 있어요.'],
    not_yet: ['아직 시작 전이에요', ''],
    ended: ['기간이 끝났어요', '이 활동의 기간이 지났어요.'],
    closed: ['마감되었어요', '선생님이 이 활동을 마감했어요.']
  };

  function notice(title, body, buttons) {
    return new Promise(resolve => {
      const ov = overlay(`<span class="land-badge">Math Land Explorers</span><h2>${esc(title)}</h2>
        <p class="sub">${body}</p>${buttons.map((b, i) =>
          `<button class="land-btn${i ? ' line' : ''}" data-i="${i}" type="button">${esc(b)}</button>`).join('')}`);
      ov.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { ov.remove(); resolve(+b.dataset.i); }));
      setTimeout(() => ov.querySelector('button') && ov.querySelector('button').focus(), 50);
    });
  }

  // 활동 시작: 로그인 → 운영 확인 → {student, run, record, readOnly}
  //  opt.cancelText 를 주면 로그인 창·안내 창에 그 버튼이 생기고, 누르면 null 을 돌려줌(예: '연습만 하기')
  async function start(opt) {
    const slug = opt.slug, title = opt.title || '', cancelText = opt.cancelText || '';
    for (;;) {
      let s = session();
      if (!s || !s.token) { if (!(await loginForm(title, cancelText))) return null; s = session(); }
      let r;
      try { r = await rpc('land_enter', { p_token: s.token, p_slug: slug }); }
      catch (err) {
        console.error(err);
        const p = await notice('서버와 연결되지 않았어요', '인터넷 연결을 확인하고 다시 시도해 주세요.',
          cancelText ? ['다시 시도', cancelText] : ['다시 시도']);
        if (p === 1) return null;
        continue;
      }
      if (r.code === 'no_session') { setSession(null); continue; }
      if (r.ok) return { student: r.student, run: r.run, record: r.record, readOnly: false, code: 'ok', token: s.token };

      const who = `${esc(r.student.no)} ${esc(r.student.name)}`;
      const [h, b] = STATE_MSG[r.code] || ['들어갈 수 없어요', ''];
      let body = b;
      if (r.code === 'not_yet' && r.run && r.run.starts_at) body = `${fmt(r.run.starts_at)}부터 시작해요.`;
      if (r.code === 'ended' && r.run && r.run.ends_at) body = `${fmt(r.run.ends_at)}까지였어요.`;
      body += `<br><small>로그인: ${who}</small>`;
      const canView = r.record && opt.allowReadOnly !== false && (r.code === 'closed' || r.code === 'ended');
      const btns = canView ? ['내 기록 보기', '다른 학번으로 들어가기'] : ['다시 확인하기', '다른 학번으로 들어가기'];
      if (cancelText) btns.push(cancelText);
      const pick = await notice(h, body, btns);
      if (pick === 2) return null;
      if (pick === 1) { setSession(null); continue; }
      if (canView) return { student: r.student, run: r.run, record: r.record, readOnly: true, code: r.code, token: s.token };
    }
  }

  // 화면 위쪽에 「1305 홍길동 · 로그아웃」 같은 작은 표시를 넣고 싶을 때
  function whoHtml(enter) {
    const st = enter.student;
    return `${esc(st.no)} ${esc(st.name)}${enter.run ? ' · ' + MODE[enter.run.mode] : ''}`;
  }
  async function logout(reload = true) {
    const s = session();
    if (s && s.token) { try { await rpc('land_logout', { p_token: s.token }); } catch (e) { /* 무시 */ } }
    setSession(null);
    if (reload) location.reload();
  }

  // ───────── 저장 (4초씩 모아서, 실패하면 다시 시도) ─────────
  function saver(enter, opts = {}) {
    let pending = null, timer = null, busy = false, stopped = enter.readOnly, retry = 0;
    const onStop = opts.onClosed || (code => {
      const [h, b] = STATE_MSG[code] || ['저장할 수 없어요', ''];
      notice(code === 'closed' && enter.run.mode === 'eval' ? '수행평가가 마감되었어요' : h,
        (b || '') + '<br>더 이상 저장되지 않아요.', ['확인']);
    });
    const onSaved = opts.onSaved || (() => {});

    async function flush() {
      if (stopped || busy || !pending) return;
      busy = true; clearTimeout(timer); timer = null;
      const job = pending; pending = null;
      try {
        const r = await rpc('land_save', {
          p_token: enter.token, p_run_id: enter.run.id, p_detail: job.detail,
          p_summary: job.summary ?? null, p_score: job.score ?? null, p_level: job.level ?? null, p_finish: !!job.finish
        });
        busy = false;
        if (r.ok) { retry = 0; onSaved(r); job.done && job.done(r); if (pending) schedule(0); return; }
        if (r.code === 'no_session') {
          // 로그인 표가 만료됨 → 다시 로그인하고 이어서 저장
          setSession(null); await loginForm(opts.title);
          enter.token = session().token; pending = merge(job, pending); schedule(0); return;
        }
        stopped = true; job.fail && job.fail(r); onStop(r.code); return;
      } catch (err) {
        busy = false; console.warn('[Land] 저장 실패, 다시 시도', err);
        pending = merge(job, pending);
        retry = Math.min(retry + 1, 6);
        if (retry === 3) toast('저장이 늦어지고 있어요. 인터넷 연결을 확인해 주세요.', 3000);
        schedule(Math.min(30000, 1000 * 2 ** retry));   // 2초, 4초, 8초 … 최대 30초
      }
    }
    function merge(a, b) {
      if (!b) return a;
      if (!a) return b;
      return Object.assign({}, a, b, { finish: a.finish || b.finish, done: b.done || a.done, fail: b.fail || a.fail });
    }
    function schedule(ms) { if (!timer) timer = setTimeout(() => { timer = null; flush(); }, ms); }
    function save(detail, extra = {}) {
      if (stopped) return false;
      pending = merge(pending, Object.assign({ detail }, extra));
      schedule(SAVE_EVERY_MS); return true;
    }
    function finish(detail, extra = {}) {
      if (stopped) return Promise.resolve({ ok: false, code: 'stopped' });
      return new Promise(resolve => {
        pending = merge(pending, Object.assign({ detail, finish: true, done: resolve, fail: resolve }, extra));
        clearTimeout(timer); timer = null; flush();
      });
    }
    // 창을 닫거나 다른 앱으로 넘어갈 때 바로 저장
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    return { save, finish, flush, get stopped() { return stopped; }, get pending() { return !!pending || busy; } };
  }

  // ───────── 학생: 내 기록 ─────────
  async function myRecords() {
    const s = session(); if (!s || !s.token) return null;
    const r = await rpc('land_my_records', { p_token: s.token });
    if (!r.ok) { if (r.code === 'no_session') setSession(null); return null; }
    return r;
  }

  // ───────── 교사 로그인 (teachers 표에 등록된 Supabase 계정) ─────────
  // Land.teacherGate(el, onReady): el 안에 로그인 칸을 그리고, 로그인되면 onReady(user) 호출
  async function teacherGate(el, onReady) {
    injectCss();
    const showForm = () => {
      el.innerHTML = `<div class="land-box" style="margin:40px auto">
        <span class="land-badge">Math Land Explorers</span><h2>선생님 로그인</h2>
        <p class="sub">선생님 계정(이메일)으로 로그인하세요.</p>
        <form novalidate><label for="t-email">이메일</label><input id="t-email" type="email" autocomplete="username" required>
        <label for="t-pw">비밀번호</label><input id="t-pw" type="password" autocomplete="current-password" required>
        <button class="land-btn" type="submit">로그인</button><div class="land-msg" aria-live="polite"></div></form>
        ${footerHtml('Math Land Explorers')}</div>`;
      const f = el.querySelector('form'), msg = el.querySelector('.land-msg'), btn = el.querySelector('button');
      f.addEventListener('submit', async e => {
        e.preventDefault(); msg.textContent = ''; btn.disabled = true; btn.textContent = '확인 중…';
        const { data, error } = await sb.auth.signInWithPassword({ email: el.querySelector('#t-email').value.trim(), password: el.querySelector('#t-pw').value });
        btn.disabled = false; btn.textContent = '로그인';
        if (error) { msg.textContent = '로그인하지 못했어요. 이메일과 비밀번호를 확인해 주세요.'; return; }
        check(data.user);
      });
    };
    const check = async user => {
      try { await rpc('land_t_student_years'); }      // teachers 표에 없으면 여기서 거절됨
      catch (e) {
        await sb.auth.signOut(); showForm();
        el.querySelector('.land-msg').textContent = '선생님 계정으로 등록되지 않은 계정이에요.'; return;
      }
      onReady(user);
    };
    const { data } = await sb.auth.getSession();
    if (data.session) check(data.session.user); else showForm();
  }
  async function teacherLogout() { await sb.auth.signOut(); location.reload(); }

  window.Land = {
    sb, rpc, esc, fmt, schoolYear, classKey, classLabel, MODE, toast, notice, footerHtml,
    start, saver, whoHtml, logout, myRecords, session,
    teacherGate, teacherLogout
  };
})();
