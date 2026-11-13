-- Math Land Explorers · 1단계 첫 번째 표
-- 활동 목록 표 land_activities 와, 첫 화면이 읽어 가는 함수 land_list_activities()
-- 기존 표(teachers, runner_*, practice_records)는 건드리지 않습니다.
-- 여러 번 실행해도 안전하게 만들었습니다(if not exists, or replace, on conflict).

-- 1) 활동 목록 표 -----------------------------------------------------------
create table if not exists public.land_activities (
  id               bigint generated always as identity primary key,
  slug             text        not null unique,                 -- 주소용 영문 이름 (예: jungle-run)
  title            text        not null,                        -- 활동 이름
  summary          text,                                        -- 카드에 보이는 한 줄 설명
  grade_group      text        not null check (grade_group in ('high', 'mid')),  -- 고등학교 / 중학교 복습
  grade_label      text,                                        -- 예: 고1 공통수학
  unit             text,                                        -- 예: 도형의 방정식
  mode             text        not null check (mode in ('eval', 'free', 'class')), -- 수행평가 / 자유 도전 / 수업
  mode_label       text,                                        -- 카드 꼬리표 글자
  status           text        not null default 'soon' check (status in ('open', 'closed', 'soon', 'hidden')),
  entry_url        text,                                        -- 학생이 들어가는 주소 (비우면 '준비 중')
  art              text        not null default 'treasure',     -- 카드 그림 종류 (treasure / jungle / merge)
  theme            text        not null default '#EEF2FF',      -- 카드 그림 바탕색
  keywords         text,                                        -- 검색어 (띄어쓰기로 구분)
  due_text         text,                                        -- 첫 화면 띠에 보이는 기한 글자
  sort_order       integer     not null default 100,            -- 작을수록 앞에
  current_version  text        not null default '1.0',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.land_activities is 'Math Land Explorers 활동 목록. 한 줄을 더하면 첫 화면에 카드가 생깁니다.';

-- 2) 보안: 표는 직접 열지 않고 함수로만 읽습니다 --------------------------------
alter table public.land_activities enable row level security;
alter table public.land_activities force row level security;
revoke all on table public.land_activities from anon, authenticated;

-- 3) 첫 화면이 읽어 가는 함수 (숨김 처리한 활동은 내보내지 않음) --------------------
create or replace function public.land_list_activities()
returns table (
  slug text, title text, summary text, grade_group text, grade_label text, unit text,
  mode text, mode_label text, status text, entry_url text, art text, theme text,
  keywords text, due_text text, current_version text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.slug, a.title, a.summary, a.grade_group, a.grade_label, a.unit,
         a.mode, a.mode_label, a.status, a.entry_url, a.art, a.theme,
         a.keywords, a.due_text, a.current_version
  from public.land_activities a
  where a.status <> 'hidden'
  order by a.sort_order, a.id;
$$;

revoke all on function public.land_list_activities() from public;
grant execute on function public.land_list_activities() to anon, authenticated;

-- 4) 지금 있는 활동 3개 미리 넣기 (이미 있으면 내용만 갱신) -----------------------------
insert into public.land_activities
  (slug, title, summary, grade_group, grade_label, unit, mode, mode_label, status, entry_url, art, theme, keywords, due_text, sort_order)
values
  ('treasure', '보물을 찾아라',
   '도형의 방정식으로 일곱 개의 미션을 풀고, 마지막에 보물상자를 열어요.',
   'high', '고1 공통수학', '도형의 방정식', 'eval', '수행평가', 'open', null,
   'treasure', '#FFE7B8', '보물 도형의 방정식 원 직선 고1 공통수학 고등학교 수행평가 미션', '[마감 날짜]', 10),
  ('jungle-run', '무리수 사냥',
   '정글을 달리며 무리수만 골라 먹고 1000 m 보물상자까지 가요.',
   'mid', '중3 복습', '제곱근과 실수', 'free', '자유 도전', 'open', 'jungle-run.html',
   'jungle', '#D9F2DC', '무리수 사냥 제곱근 실수 근호 중3 중학교 복습 자유 도전 게임 달리기', '[도전 기한]', 20),
  ('power-merge', '거듭제곱 합치기',
   '같은 수끼리 닿으면 하나로 합쳐져요. 통이 넘치기 전에 1024를 만들어요.',
   'mid', '중2 복습', '지수법칙', 'free', '자유 도전', 'soon', null,
   'merge', '#FFF1C2', '거듭제곱 합치기 지수법칙 2048 중2 중학교 복습 준비 중 게임', '곧 열려요', 30)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, grade_group = excluded.grade_group,
  grade_label = excluded.grade_label, unit = excluded.unit, mode = excluded.mode,
  mode_label = excluded.mode_label, status = excluded.status, entry_url = excluded.entry_url,
  art = excluded.art, theme = excluded.theme, keywords = excluded.keywords,
  due_text = excluded.due_text, sort_order = excluded.sort_order, updated_at = now();

-- 5) 확인용: 아래 한 줄을 따로 실행하면 첫 화면이 받는 목록이 그대로 보입니다
-- select * from public.land_list_activities();
