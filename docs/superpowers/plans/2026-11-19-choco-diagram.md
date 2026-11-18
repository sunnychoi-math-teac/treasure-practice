# 초코볼 다이어그램 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스모스 보로노이 수업을 수학나라 수업 활동 「초코볼 다이어그램」(slug `choco-diagram`)으로 옮긴다 — 학생 화면 1개, 교사 현황판 1개, Supabase 이전 1개.

**Architecture:** 기존 공통 틀(`common/land.js`의 `Land.start`/`Land.saver`, 보관함 `land-files`, Edge Function `land-upload`)을 그대로 쓴다. 계산(보로노이·직선 비교·이웃 검사·버전 좌표)은 순수 함수 파일 `geo.js` 하나에 모아 Node로 시험한다. 수식 입력은 보물을 찾아라의 엔진·자판을 `common/`으로 **복사**해 쓴다(보물 파일은 건드리지 않음).

**Tech Stack:** HTML + 순수 JS(빌드 없음, GitHub Pages), Supabase(Postgres RPC), MathLive 0.108.2(CDN), Node 18+ `node --test`(순수 함수 시험), Playwright(화면 시험, 서버 호출은 가로채기).

**Spec:** 프로젝트 문서 `claude/지도에숨은수학_설계서.md`(v0.1) + `claude/지도에숨은수학_설계메모.md`. 아래 「설계서와 달라진 점」이 설계서보다 우선한다.

## 설계서와 달라진 점 (2026-11-19, 계획 중 결정)

1. 이름 「초코볼 다이어그램」, slug `choco-diagram`, 폴더 `activities/choco-diagram/` (선생님 결정: 이름. slug는 이름에 맞춤)
2. 사진 파일 이름은 `land-upload`가 이미 받는 이름을 씀: 초코볼 `m1.jpg`, 풀이 ① `m2.jpg`, 풀이 ② `m3.jpg` → Edge Function 수정·재배포 없음
3. 채점(점수·메모·펜 자국)은 `detail`이 아닌 **새 표 `land_grades`** 에 저장. 이유: `land_save`가 `detail`을 통째로 덮어써서 학생이 저장하면 교사 채점이 지워짐. 펜 자국은 PNG가 아니라 획 좌표 JSON(보관함 권한 추가 없음)
4. S10·S11 「따로 열고 닫기」는 만들지 않음. 이어하기가 되므로 다음 시간에 그 화면부터 하면 됨

## Global Constraints

- 저장소 원칙(`CLAUDE.md`): Claude는 git push 안 함. 빌드 없이 정적 파일만. 학생 기록·사진은 저장소에 절대 넣지 않음
- Supabase 프로젝트 `math-treasure`(jerhkttkwvkfhiusgjhv)만. 표·함수 추가는 **선생님 허락 후** 실행
- 학생 기기: 태블릿 가로 + 키보드. 그래프 화면 = 왼쪽 문제·입력 | 오른쪽 그래프, 세로 = 위 그래프 | 아래 입력. 수식 자판은 그래프를 가리지 않음
- 틀리면 「아직 아니에요」만. 이유·힌트 없음
- 학생에게 점수 안 보임. 모둠 번호 없음. 로그인은 `Land.start`
- 만점: 풀이 ① 20, 풀이 ② 30 (한 상수 `MAX = { sol1: 20, sol2: 30 }`)
- 좌표평면(S1~S5): x −30~30, y −20~20, 점은 정수 칸에 붙음. 안내 「사진의 너비가 60, 높이가 40에 가깝게 맞춰 주세요」
- 지도: 1093×859 px, 1칸 = 67.76 px, 기준(버전 ①)에서 그림 왼쪽 아래 모서리 = (−0.03, −1.04)
- 저작권 문구: 첫 화면·마무리·교사 화면 아래 `Land.footerHtml('초코볼 다이어그램')` + 「수식 입력: MathLive (MIT License)」

## Review Focus

1. 학생이 같은 좌표에 A, B(또는 B, C)를 두면(겹친 점) → 표 화면이 깨지지 않고 「두 점이 겹쳐 있어요. 점을 옮겨 주세요」로 S2에 돌려보냄 (Task 1 `perpBisector` 시험 + Task 5)
2. AB가 가로·세로일 때(기울기 0·없음) 채점 → `x=−2`, `y=3`, `y=0x+3` 정답, 기울기 칸 「없음」 정답 (Task 1)
3. 수업 중 인터넷이 끊기거나 마감 뒤 사진 올리기 → 사진은 3번 다시 시도, 마감이면 「마감되어 올릴 수 없어요」, 화면 진행은 막지 않음 (Task 5)
4. 교사가 채점하는 동안 학생이 계속 저장 → 채점이 지워지지 않음 (Task 4 시험)
5. 새로 고침·다른 기기로 다시 들어옴 → 같은 화면·같은 버전(①~⑤)·같은 사진 위치로 이어짐 (Task 5·6)

---

## File Structure

| 파일 | 책임 |
|---|---|
| `activities/choco-diagram/geo.js` | 순수 계산: 보로노이 칸·경계, 수직이등분선, 직선 같음 판정, 이웃 검사(색 경계 세기), 도전 문제 5버전·좌표 이동 |
| `activities/choco-diagram/geo.test.js` | `node --test` 시험 |
| `common/tmath.js` | 보물 `index.html` 339~645행 수식 엔진 복사(`window.TMath`) + Node export 한 줄 |
| `common/mathpad.js` | 보물 `index.html`의 `KP`·`mathInput`·`withKeyBtn`·`el` 복사(`window.MathPad = { mathInput, KP }`) + 자판 CSS 문자열 주입 |
| `activities/choco-diagram/index.html` | 학생 화면 S1~S11 |
| `activities/choco-diagram/teacher.html` | 교사 현황판 |
| `activities/choco-diagram/img/` | `map-base.png`, `pop-2014.png`, `pop-2024.png`, `teacher-choco.jpg` |
| `tools/prep_choco_maps.py` | 지도 동 이름 지우기·테두리선 얹기(한 번 돌리는 도구) |
| `supabase/migrations/20261119_land_choco_diagram.sql` | 활동 등록 + `land_grades` + `land_t_grade` + `land_t_grades` |
| `index.html`, `teacher/index.html` | 카드·현황판 연결 한 줄씩 |
| `current_status.md` | 마칠 때 갱신 |

---

### Task 1: 순수 계산 `geo.js`

**Files:**
- Create: `activities/choco-diagram/geo.js`, `activities/choco-diagram/geo.test.js`

**Interfaces:**
- Produces (`window.Geo`, Node에서는 `module.exports`):
  - `voronoi(sites: [x,y][], box: {x0,y0,x1,y1}) -> { cells: [x,y][][], edges: {a,b,p,q}[] }` — 칸 i는 sites[i]의 다각형, edge는 이웃 a<b 사이 선분 p→q
  - `neighbors(sites, box) -> Set<"a-b">`
  - `perpBisector(A, B) -> { mid:[x,y], slope:number|null, line:[a,b,c] }` (ax+by+c=0; A=B면 `null` 반환)
  - `sameLine(l1:[a,b,c], l2:[a,b,c], eps=1e-6) -> boolean`
  - `lineOf(f:(x,y)=>number) -> [a,b,c] | null` — 일차식이 아니면 null (5점에서 확인)
  - `countEdges(lab: Float32Array, w, h, p:[px,py], q:[px,py], skip:number, thr=10, step=6) -> number`
  - `VERSIONS` (5개), `others(ver) -> [x,y][]`(나머지 4개 학교), `mapOrigin(ver) -> [x,y]`(그림 왼쪽 아래 모서리 좌표)

- [ ] **Step 1: 실패하는 시험 쓰기** (`geo.test.js`, `node:test` + `assert`)

```js
const G = require('./geo.js');
test('perpBisector', () => {
  const r = G.perpBisector([2,4],[-3,-1]);
  assert.deepEqual(r.mid, [-0.5, 1.5]); assert.equal(r.slope, -1);
  assert.ok(G.sameLine(r.line, [1,1,-1]));                       // y=-x+1
  assert.equal(G.perpBisector([0,0],[0,4]).slope, 0);             // AB 세로 → y=2
  assert.equal(G.perpBisector([0,0],[4,0]).slope, null);          // AB 가로 → x=2
  assert.ok(G.sameLine(G.perpBisector([0,0],[4,0]).line, [1,0,-2]));
  assert.equal(G.perpBisector([1,1],[1,1]), null);                // 겹친 점
});
test('lineOf', () => {
  assert.ok(G.sameLine(G.lineOf((x,y)=>y-(0*x+3)), [0,1,-3]));
  assert.equal(G.lineOf((x,y)=>y-x*x), null);
});
test('5 versions: boundary equals given line, answers integer', () => {
  for (const v of G.VERSIONS) {
    const pa = G.perpBisector(v.P, v.A), qb = G.perpBisector(v.Q, v.B);
    assert.ok(G.sameLine(pa.line, v.lineA)); assert.ok(G.sameLine(qb.line, v.lineB));
    const S = [...G.others(v.id), v.P, v.Q, v.A, v.B], n = G.neighbors(S, {x0:-3,y0:-3,x1:17,y1:13});
    assert.ok(n.has('4-6') && n.has('5-7'));                      // P–A, Q–B 이웃
  }
});
test('countEdges on synthetic strip', () => {
  // 가로 200px: 0~99 빨강, 100~199 노랑 → 경계 1번
  const w=200,h=1,lab=new Float32Array(w*3); for(let i=0;i<w;i++){lab.set(i<100?[50,60,40]:[90,-5,80],i*3);}
  assert.equal(G.countEdges(lab,w,h,[0,0],[199,0],10), 1);
});
```

`VERSIONS` 값(축 이동 dx, dy; 기준 ①에서 모두 뺌):
| id | dx,dy | P | Q | A | B | lineA (ax+by+c) | lineB |
|---|---|---|---|---|---|---|---|
| 1 | 0,0 | 5.5,4.5 | 9,9 | 7,4 | 10,8 | 3,−1,−14.5 | 1,−1,−1 |
| 2 | 1,0 | 4.5,4.5 | 8,9 | 6,4 | 9,8 | 3,−1,−11.5 | 1,−1,0 |
| 3 | 0,1 | 5.5,3.5 | 9,8 | 7,3 | 10,7 | 3,−1,−15.5 | 1,−1,−2 |
| 4 | 2,1 | 3.5,3.5 | 7,8 | 5,3 | 8,7 | 3,−1,−9.5 | 1,−1,0 |
| 5 | −1,2 | 6.5,2.5 | 10,7 | 8,2 | 11,6 | 3,−1,−19.5 | 1,−1,−4 |
나머지 학교(①): (5.61,1.66) (8.05,6.44) (7.17,7.38) (11.17,7.63). 지도 원점(①): (−0.03, −1.04).

- [ ] **Step 2:** `node --test activities/choco-diagram/` → FAIL(`Cannot find module`)
- [ ] **Step 3: `geo.js` 구현.** 보로노이는 상자에서 시작해 다른 점마다 수직이등분 반평면으로 자르기(점 ≤ 10개라 O(n²) 충분). 이웃은 두 칸이 길이 > 1e-6인 변을 공유. `countEdges`는 p→q를 1px씩 따라가며 양 끝 `skip`px를 빼고, `step` 간격 Lab 거리 > thr 구간을 하나로 묶어 셈(설계메모의 시험 방식 그대로). 파일 끝: `if (typeof module !== 'undefined') module.exports = Geo; else window.Geo = Geo;`
- [ ] **Step 4:** `node --test activities/choco-diagram/` → PASS
- [ ] **Step 5:** 선생님 실험 사진으로 확인 스크립트 한 번(커밋 안 함): 설계메모 14쌍이 이웃 0~3 / 아님 ≥4로 갈리는지. 갈리면 문턱 10 유지, 아니면 숫자만 조정해 `geo.js` 기본값 바꿈

---

### Task 2: 수식 엔진·자판을 `common/`으로 복사

**Files:**
- Create: `common/tmath.js`, `common/mathpad.js`
- Test: `activities/choco-diagram/geo.test.js`(시험 추가)

**Interfaces:**
- Produces: `window.TMath = { latexToPlain, parse, evalAst, compileXY, parsePoint, parseNumber, … }`(보물과 같음), `window.MathPad = { mathInput(tex, onEnter, onInput) -> wrap, KP: { open, close, retarget, isOpenFor } }`. `wrap.tex()`, `wrap.plain()`, `wrap.setTex(v)`
- 자판은 입력 영역의 `.ws-dock` 안에 붙음(보물과 같은 규칙) → 학생 화면 왼쪽 패널 맨 아래에 `<div class="ws-dock">`를 둔다

- [ ] **Step 1: 시험 추가**
```js
const T = require('../../common/tmath.js');
test('tmath parses student forms', () => {
  assert.deepEqual(T.parsePoint(T.latexToPlain('\\left(-\\frac{11}{2},2\\right)')), [-5.5, 2]);
  const f = T.compileXY(T.latexToPlain('y=2\\left(x-7\\right)+5.5')).f;
  assert.ok(require('./geo.js').sameLine(require('./geo.js').lineOf(f), [2,-1,-8.5]));
  assert.equal(T.parseNumber(T.latexToPlain('-\\frac{19}{13}')), -19/13);
});
```
- [ ] **Step 2:** `node --test activities/choco-diagram/` → FAIL
- [ ] **Step 3:** 보물 `activities/treasure/index.html` 339~645행(「수식 해석 · 음함수 그래프 · 채점 엔진」 IIFE)을 그대로 `common/tmath.js`에 붙이고 `})(window)` 대신 `})(typeof window !== 'undefined' ? window : globalThis); if (typeof module !== 'undefined') module.exports = globalThis.TMath;`. `mathpad.js`는 868행 `el`, `withKeyBtn`, `mathInput`, `KP`와 222~230·283~289행 자판 CSS를 복사, `MATHLIVE` 판정은 보물 2157~2163행 방식 복사. 머리말에 「보물을 찾아라에서 복사, 보물 파일은 그대로」 한 줄
- [ ] **Step 4:** `node --test activities/choco-diagram/` → PASS

---

### Task 3: 그림 준비

**Files:**
- Create: `tools/prep_choco_maps.py`, `activities/choco-diagram/img/{map-base.png,pop-2014.png,pop-2024.png,teacher-choco.jpg}`

- [ ] **Step 1:** 스크립트 = 설계 중 시험한 방법 그대로: 동 이름 상자 18개 안의 따뜻한 회색 글자(R−B ≥ 3, 밝기 < 242)만 지우고 `cv2.inpaint`(TELEA, 반지름 5) → 학교 표시 지도에서 테두리선 뽑아(밝기 < 200, 백지도보다 25 이상 어둡고, 무채색, 덩어리 > 800px, 닫기 9×9 → 뼈대 → 짧은 조각(<60px) 버림) 약 3px 회색 #969696로 얹기. 인구 지도 2장은 이름만 지움(테두리선 없음). 선생님 실험 사진은 긴 변 1600px JPEG 0.85
- [ ] **Step 2:** 실행 후 네 그림을 선생님께 보내 확인(특히 「동구」 자리 큰길 얼룩). 고칠 곳은 상자·반지름만 조정
- [ ] **Step 3:** 선생님 실험 사진의 초코볼 7개 좌표를 S1 좌표계(사진 너비 60·높이 80 비율 유지, 가운데 원점)로 적어 `index.html`의 `TEACHER_CHOCO` 상수에 넣을 값 확정(사진 1932×2576 기준 픽셀 중심: (392,1140) (680,1640) (1100,1128) (1048,480) (1540,700) (1632,1552) (980,2020))

---

### Task 4: Supabase 이전 (선생님 허락 후 실행)

**Files:**
- Create: `supabase/migrations/20261119_land_choco_diagram.sql`

**Interfaces:**
- Produces:
  - 표 `public.land_grades(record_id bigint references land_records(id), key text check (key in ('sol1','sol2')), score integer, max integer, memo text, marks jsonb not null default '[]', graded_at timestamptz not null default now(), primary key(record_id,key))` — RLS 켜고 직접 접근 막음
  - `land_t_grade(p_record_id bigint, p_key text, p_score integer, p_max integer, p_memo text, p_marks jsonb) -> json` — 교사만(`private.land_need_teacher()`), 0 ≤ score ≤ max 아니면 `{ok:false,code:'bad_score'}`, upsert 후 `land_records.score` = 그 기록 점수 합, `level` = 「① 18 · ② 25」(없는 쪽은 「① 18 · ② –」) → `{ok:true}`
  - `land_t_grades(p_slug text, p_year integer) -> json` — 그 활동·학년도의 모든 채점 `[{record_id,key,score,max,memo,marks,graded_at}]`
  - `land_activities` 한 줄: slug `choco-diagram`, title `초코볼 다이어그램`, summary `초코볼 실험으로 보로노이 다이어그램을 만들고, 지도에서 사라진 옛 학교를 찾아요.`, grade_group `high`, grade_label `고1 공통수학2`, unit `직선의 방정식`, mode `class`, mode_label `수업`, status `open`, entry_url `activities/choco-diagram/`, art `choco`, theme `#FDEFE3`, keywords `초코볼 보로노이 수직이등분선 직선의 방정식 지도 폐교 공통수학2 고등학교 수업`, sort_order 16, current_version `1.0`; `land_activity_versions` 1줄 `('choco-diagram','1.0','데스모스 보로노이 수업을 수학나라로 옮김: 초코볼 사진·수직이등분선 표·퀴즈 3문항·사라진 학교 찾기(5버전)·풀이 사진 2장과 교사 채점')`
- 학생 함수 `land_save`는 그대로 → 채점은 학생 저장에 영향받지 않음. 단 학생이 `p_score`/`p_level`을 보내면 덮어쓰므로 **학생 화면은 score·level을 보내지 않는다**

- [ ] **Step 1:** SQL 작성(`create table if not exists`, `on conflict do nothing`, 권한 revoke/grant는 `20261114_land_core.sql` 끝 방식 그대로)
- [ ] **Step 2:** 선생님께 무엇을 왜 만드는지 설명하고 허락받기
- [ ] **Step 3:** `mcp__Supabase__apply_migration`으로 실행
- [ ] **Step 4: 확인** (`execute_sql`, 끝나면 시험 줄 지움): 시험용 운영·기록 1줄에 `land_t_grade`(교사 권한 흉내: `set local role authenticated` + `request.jwt.claims`로 teachers 계정) → `land_save`로 detail 다시 저장 → `land_grades` 그대로, `land_records.score` 그대로인지. `get_advisors(security)`에 새 경고 없음

---

### Task 5: 학생 화면 파트1 (S1~S6 + 공통 뼈대)

**Files:**
- Create: `activities/choco-diagram/index.html`

**Interfaces:**
- Consumes: `Land.start/saver/toast/notice/footerHtml/logout/whoHtml`, `Geo.*`, `TMath.*`, `MathPad.*`
- Produces (Task 6·8이 쓰는 `detail` 모양 — 설계서 5절 그대로, 아래만 확정):
  - `P.screen: 'S1'..'S11'`, `P.done: string[]`, `P.ver: 1..5`(첫 입장 때 정하고 고정)
  - `P.photo: {x,y,w,h,angle}`(좌표평면 단위), `P.abc: {A:[x,y],B:[x,y],C:[x,y]}`, `P.nb: {AB:n,BC:n,warned:bool,ignored:bool}`
  - `P.s5: {AB:{mid,slope,eq},BC:{…}}`, 칸 = `{input:string(latex), ok:bool, wrong:int}`, 기울기 「없음」은 `input:'none'`
  - `P.files: {m1?:iso, m2?:iso, m3?:iso}`

- [ ] **Step 1:** 뼈대: 위쪽 단계 칩(S1~S11, 끝낸 곳·지금 곳만 누를 수 있음), 화면마다 `render<S>()`, 왼쪽 패널(`.ws-scroll` + `.ws-dock`) | 오른쪽 그래프(SVG). `Land.start({slug:'choco-diagram', title:'초코볼 다이어그램'})` → `enter.record.detail`로 이어하기, 없으면 `P.ver = 1 + (Number(student.no) % 5)`(반 안에서 고르게 섞임). `saver.save(P)`는 바뀔 때마다(점수·level 안 보냄). 읽기 전용이면 입력 막고 「마감되었어요」 띠
- [ ] **Step 2: S1** 사진 고르기(`<input type=file accept="image/*">`, 카메라·앨범 모두) → 팩터 방탈출 `shrink`(최대 1600) 복사 → `upload('m1', data)`(팩터 방탈출 `post`/`upload` 복사, 3번 재시도) → 그래프 위 반투명 이미지, 처음 크기 60×(60×세로/가로), 끌기·모서리 크기·돌리기 핸들. `P.photo` 저장. 학생이 다시 들어오면 `post({action:'list'})`의 `urls.m1`로 사진 다시 그림
- [ ] **Step 3: S2** A·B·C 끌기(정수 칸 붙음, 처음 위치 (−10,0) (0,0) (10,0)), [다 옮겼어요] → 두 점 겹침이면 「두 점이 겹쳐 있어요」 → 아니면 사진을 캔버스에 그려 가우스 3px 흐림 + Lab 변환 후 `Geo.countEdges`(AB, BC, skip = 초코볼 반지름 ≈ 사진 너비의 2.5%) ≥ 4면 경고 창 [다시 옮기기]/[이대로 갈래요]. `P.nb` 저장
- [ ] **Step 4: S3** 서술 칸(빈칸이면 다음 못 감). **S4** 선생님 실험 사진 + 펜(손가락·펜 획 저장 `P.s4`), [경계선 확인하기] → `Geo.voronoi(TEACHER_CHOCO)`의 edges를 파란 선으로
- [ ] **Step 5: S5** 위에 「세 점 A(a,b) …」(자동), 표 2×3 `MathPad.mathInput` 칸, 칸마다 [확인]: 중점 `TMath.parsePoint` vs `perpBisector.mid`(1e-9), 기울기 `parseNumber` vs `slope`(null이면 「없음」 버튼만 정답), 방정식 `Geo.lineOf(compileXY(plain).f)` + `sameLine`; 일차식 아니면 「직선의 방정식으로 써 주세요」(틀린 횟수 안 셈). 결과는 ✓ / 「아직 아니에요」만. [그래프 확인하기] → 입력한 방정식(맞든 틀리든 일차식이면) 두 직선을 사진 위에 그림 + 「사진 속 경계선과 비슷한가요?」
- [ ] **Step 6: S6** 풀이 사진 ① → `shrink`(최대 2000) → `upload('m2')`, 올린 사진 미리 보기·다시 올리기. 안 올려도 [다음]
- [ ] **Step 7: 확인(Playwright, webapp-testing 스킬)** 로컬 정적 서버 + `page.route('**/rest/v1/rpc/**')`·`'**/functions/v1/land-upload'` 가로채 가짜 응답: 로그인 → S1 사진(선생님 실험 사진) → S2 이웃 아닌 점(빨강왼–초록) 경고 뜸 / 이웃 점 경고 없음 → S5 정답·오답·`y=3` 꼴 → 새로 고침 후 S5·같은 사진 위치로 이어짐 → 가로·세로 화면 캡처를 선생님께

---

### Task 6: 학생 화면 퀴즈 + 파트2 + 마무리 (Q, S7~S11)

**Files:**
- Modify: `activities/choco-diagram/index.html`

**Interfaces:**
- Produces: `P.quiz: [{first, tries, ok}]×3`, `P.s71: {xs:[[x,y]…], why}`, `P.s72: {picked:[i,j], why}`, `P.s73: {cells:int[], icons:[[x,y],[x,y]]}`, `P.s8: {A:{input,ok,wrong}, B:{…}}`, `P.s10: {q1:{first,tries,ok}, q2:{…}, eq:{input,ok,wrong}}`, `P.s11: {u:1..5, c:1..5, text}`. 7번 좌표는 **기준(①) 좌표**로 저장(화면에서는 `+ver 이동` 해서 그림)

- [ ] **Step 1: Q** 3문항, 그림은 `Geo.voronoi`로 고정 점 6개에서 그림(1번: 한 칸 색칠·점 A, 2번: 같은 그림의 경계 VW, 3번: 세 점 + 4개 보기 — 정답은 실제 보로노이, 오답 3개 = 점을 지나는 선 / 점마다 원 / 꼭짓점이 엉뚱한 곳). 문구는 설계서 그대로. 고르면 ✓/✗, 다시 고를 수 있음
- [ ] **Step 2: S7-1** 인구 2014 지도(`img/pop-2014.png`, 원점 `Geo.mapOrigin(ver)`) 누르면 X(최대 8, 다시 누르면 지움) + 이유(필수). **S7-2** 인구 2024 지도 + 내 X 8개, 2개 눌러 동그라미 + 이유(필수). **S7-3** `map-base.png` + 6개 학교(`[...others, P, Q]`) 보로노이, 칸 눌러 색칠(최대 2) + 학교 아이콘 2개 끌기
- [ ] **Step 3: S8** 버전 `P.ver`의 P, Q(이름표 「P(5.5, 4.5)」), 빨간 선 두 개(경계 선분 = `voronoi` 8개 학교의 P–A, Q–B 변) + 식 이름표(`y=3x-14.5` 꼴), 나머지 학교·6개 학교 경계선. 입력칸 2개 → [학교의 위치 확인하기] → 입력 위치에 학교 아이콘 + 칸별 ✓/「아직 아니에요」(답과 거리 1e-9), 둘 다 맞으면 8개 학교 경계선으로 다시 그림
- [ ] **Step 4: S9** S6과 같음(`m3`). **S10** 설계서 그대로(정답 −1, (−1/2, 3/2), `y=-x+1`). **S11** 막대 2개(말: 보물·방탈출의 `U`, `F` 배열 복사) + 한 줄(선택) → [제출하기] = `saver.finish(P, {summary})` → 「제출했어요」 + `Land.footerHtml`
- [ ] **Step 5: 확인(Playwright)** 버전 ①~⑤ 각각 정답 입력 → ✓, 경계선이 빨간 선과 겹침(캡처 5장). 7-1 X 9개째는 안 놓임. 제출 후 새로 고침 → 제출 화면

---

### Task 7: 교사 현황판 `teacher.html`

**Files:**
- Create: `activities/choco-diagram/teacher.html`

**Interfaces:**
- Consumes: `land_t_activities`, `land_t_records`, `land_t_record_detail`, `land_t_students`, `land_t_close_class`, `land_t_reset_pin`(모두 기존), `land_t_grade`, `land_t_grades`(Task 4), 보관함 `createSignedUrls`(방탈출 `signed()` 복사). 사진 경로 `choco-diagram/<학년도>/run<운영>/<학번>/m1.jpg|m2.jpg|m3.jpg`
- **뼈대는 `activities/factor-escape/teacher.html`을 복사해서 시작**(게이트·학년도·운영·반 칩·자동 새로 고침·반 마감·비번 초기화·CSV·「← 활동 모음」이 이미 있음). 바꾸는 것은 표 칸과 아래 화면들뿐

- [ ] **Step 1:** 진행 현황 표: 학번·이름·지금 화면·S5 6칸(✓ 또는 틀린 수)·퀴즈 3·S8 버전/A/B·이웃 경고 무시·사진 ①②·점수 ①②·합계·마지막 저장. 「지금 어디에?」: 한 칸 틀린 수 ≥ 3 빨간색
- [ ] **Step 2:** 초코볼 사진 모아 보기: 학생마다 작은 그래프(사진 + A·B·C + 학생이 쓴 두 직선)
- [ ] **Step 3:** 7번 오버레이: 반 전체 X(반투명 점), 고른 2곳(동그라미), 칸 색칠 인원 수만큼 진하게. [크게 보기](화면 꽉 채우기)
- [ ] **Step 4:** 풀이 채점(① / ② 탭): 왼쪽 학생 목록(채점함·안 함·미제출), 가운데 사진(확대·끌기·90° 돌리기), 위 캔버스 펜(빨강·파랑, 굵기 2, 지우개, 되돌리기, 획은 사진 기준 0~1 좌표로 `marks`), [펜 자국 숨기기], 점수칸(0~MAX 정수만) + 메모 + [저장하고 다음 학생] → `land_t_grade`. 「채점 안 한 학생만」
- [ ] **Step 5:** 소감 모아 보기(막대 평균 + 한 줄, 복사), CSV(학번·이름·버전·S5 칸별·퀴즈·S8·점수①②·합계·메모)
- [ ] **Step 6: 확인(Playwright, 가짜 기록 30명)** 표·오버레이·채점 저장 → 다음 학생 이동, 만점 넘는 점수 거절, 펜 숨기기. 캡처를 선생님께

---

### Task 8: 연결·마무리

**Files:**
- Modify: `index.html`(FALLBACK에 카드 1줄, `ARTS`에 `choco` 그림: 접시 위 색 다른 초코볼 4개와 경계선 SVG), `teacher/index.html:124,126`(`ICON.choco = '🍫'`, `OWN_BOARD['choco-diagram']`), `current_status.md`

- [ ] **Step 1:** 위 세 곳 수정
- [ ] **Step 2:** `node --test activities/choco-diagram/` 통과, 학생·교사 화면 Playwright 한 번 더
- [ ] **Step 3:** 바뀐 파일 전체를 선생님 컴퓨터 저장소 폴더에 넣고 목록을 알림(선생님이 GitHub Desktop으로 올림). 올린 뒤 실제 사이트에서 시험 학생(3999)으로 S1 사진 올리기·S8 정답·교사 채점 1번 확인

---

## 하지 않는 것 (ponytail)
- S10·S11 따로 열고 닫기, 힌트, 30명 동시 부하 시험(기존 활동과 같은 저장 방식이라 생략 — 첫 수업 때 지켜봄), 보물 파일의 수식 코드를 공통 파일로 바꾸기(복사만)
