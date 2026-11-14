-- Math Land Explorers · 1단계 공통 틀
-- 학생(학년도마다 등록) · 로그인 세션 · 운영(활동을 열 때마다 1줄) · 기록 · 활동 버전
-- 기존 표(teachers, runner_*, practice_records, land_activities)는 바꾸지 않습니다.
-- 학생은 함수(RPC)로만 로그인·저장·조회합니다. 표는 직접 열지 않습니다(RLS).

-- ─────────────────────────────────────────────────────────────
-- 0) 도움 함수: 지금 학년도 (3월 1일부터 새 학년도, 서울 시각 기준)
-- ─────────────────────────────────────────────────────────────
create or replace function private.land_school_year(p_at timestamptz default now())
returns integer language sql stable set search_path = '' as $$
  select case when extract(month from (p_at at time zone 'Asia/Seoul')) >= 3
              then extract(year from (p_at at time zone 'Asia/Seoul'))::int
              else extract(year from (p_at at time zone 'Asia/Seoul'))::int - 1 end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1) 표
-- ─────────────────────────────────────────────────────────────
-- 학생: 학번 4자리(학년 1 + 반 1 + 번호 2). 학년도마다 새로 등록
create table if not exists public.land_students (
  id             bigint generated always as identity primary key,
  school_year    integer     not null,
  student_no     text        not null check (student_no ~ '^[1-3][1-9][0-9]{2}$'),
  name           text        not null check (char_length(name) between 1 and 10),
  grade          integer     generated always as (substr(student_no, 1, 1)::integer) stored,
  class_no       integer     generated always as (substr(student_no, 2, 1)::integer) stored,
  pin_hash       text,                                   -- 비어 있으면 다음 로그인 때 새 비번 등록(초기화)
  failed_count   integer     not null default 0,
  locked_until   timestamptz,
  status         text        not null default 'active' check (status in ('active', 'moved')), -- 재학 / 전출
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz,
  unique (school_year, student_no)
);
comment on table public.land_students is '수학나라 학생. 학년도마다 첫 접속 때 학생이 직접 등록. 반은 학번에서 읽음.';

-- 로그인 세션: 로그인할 때 받은 표(토큰)로 저장. 비번을 매번 보내지 않음
create table if not exists public.land_sessions (
  token_hash   text        primary key,
  student_id   bigint      not null references public.land_students(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists land_sessions_student_idx on public.land_sessions(student_id);

-- 활동 버전 기록
create table if not exists public.land_activity_versions (
  id            bigint generated always as identity primary key,
  activity_slug text   not null references public.land_activities(slug) on update cascade,
  version       text   not null,
  changes       text,
  released_on   date   not null default current_date,
  unique (activity_slug, version)
);

-- 운영: 활동을 반에 열 때마다 1줄 (학년도 · 버전 · 모드 · 기한 · 대상 반 · 열림/마감)
create table if not exists public.land_runs (
  id              bigint generated always as identity primary key,
  activity_slug   text        not null references public.land_activities(slug) on update cascade,
  school_year     integer     not null,
  version         text        not null,
  mode            text        not null check (mode in ('free', 'class', 'eval')), -- 자유 도전 / 수업 / 수행평가
  label           text,                                  -- 예: 1학기 수행평가
  starts_at       timestamptz,                           -- 비우면 바로
  ends_at         timestamptz,                           -- 비우면 마감할 때까지
  target_classes  text[]      not null default '{}',     -- 예: {1-3,1-5}. 비우면 모든 반
  closed_classes  text[]      not null default '{}',     -- 반별 마감
  status          text        not null default 'open' check (status in ('open', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists land_runs_slug_year_idx on public.land_runs(activity_slug, school_year);

-- 기록: 공통 칸 + 활동별 자세한 내용(detail)
create table if not exists public.land_records (
  id           bigint generated always as identity primary key,
  run_id       bigint      not null references public.land_runs(id),
  student_id   bigint      not null references public.land_students(id),
  version      text        not null,                     -- 시작할 때의 활동 버전
  started_at   timestamptz not null default now(),
  saved_at     timestamptz not null default now(),
  finished_at  timestamptz,                              -- 완료·제출
  score        numeric,
  level        text,                                     -- 예: 상-(49)
  summary      text,                                     -- 소감·작품 설명 등 짧은 글
  detail       jsonb       not null default '{}'::jsonb, -- 활동별 진행 상황
  save_count   integer     not null default 0,
  unique (run_id, student_id)
);
create index if not exists land_records_student_idx on public.land_records(student_id);

-- 보안: 모두 RLS 켜고 직접 접근 막음
alter table public.land_students           enable row level security;
alter table public.land_sessions           enable row level security;
alter table public.land_activity_versions  enable row level security;
alter table public.land_runs               enable row level security;
alter table public.land_records            enable row level security;
revoke all on table public.land_students, public.land_sessions, public.land_activity_versions,
                    public.land_runs, public.land_records from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2) 내부 도움 함수
-- ─────────────────────────────────────────────────────────────
create or replace function private.land_hash(p_token text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- 토큰 → 학생 (만료·전출이면 null)
create or replace function private.land_student_of(p_token text)
returns public.land_students language sql stable security definer set search_path = '' as $$
  select s.* from public.land_sessions x
  join public.land_students s on s.id = x.student_id
  where x.token_hash = private.land_hash(p_token) and x.expires_at > now() and s.status = 'active';
$$;

create or replace function private.land_student_json(s public.land_students)
returns json language sql immutable set search_path = '' as $$
  select json_build_object('id', s.id, 'no', s.student_no, 'name', s.name, 'grade', s.grade,
                           'class_no', s.class_no, 'year', s.school_year);
$$;

-- 이 운영에서 지금 이 학생이 저장할 수 있는가 → 'ok' 또는 거절 이유
create or replace function private.land_run_state(r public.land_runs, s public.land_students)
returns text language sql stable set search_path = '' as $$
  select case
    when r.school_year <> s.school_year then 'other_year'
    when cardinality(r.target_classes) > 0 and not ((s.grade || '-' || s.class_no) = any (r.target_classes)) then 'not_target'
    when r.status = 'closed' or (s.grade || '-' || s.class_no) = any (r.closed_classes) then 'closed'
    when r.starts_at is not null and now() < r.starts_at then 'not_yet'
    when r.ends_at is not null and now() > r.ends_at then 'ended'
    else 'ok' end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3) 학생 함수
-- ─────────────────────────────────────────────────────────────
-- 로그인(첫 접속이면 등록). 잠금 없이 처리, 8번 틀리면 10분 잠금
create or replace function public.land_login(p_no text, p_name text, p_pin text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_year integer := private.land_school_year();
  v_name text := btrim(coalesce(p_name, ''));
  s public.land_students;
  v_code text;
  v_token text;
begin
  if p_no is null or p_no !~ '^[1-3][1-9][0-9]{2}$' then return json_build_object('ok', false, 'code', 'bad_no'); end if;
  if char_length(v_name) not between 1 and 10 then return json_build_object('ok', false, 'code', 'bad_name'); end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then return json_build_object('ok', false, 'code', 'bad_pin'); end if;

  insert into public.land_students (school_year, student_no, name, pin_hash, last_login_at)
    values (v_year, p_no, v_name, extensions.crypt(p_pin, extensions.gen_salt('bf')), now())
    on conflict (school_year, student_no) do nothing
    returning * into s;

  if found then
    v_code := 'new';
  else
    select * into s from public.land_students where school_year = v_year and student_no = p_no;
    if s.status = 'moved' then return json_build_object('ok', false, 'code', 'moved'); end if;
    if s.name <> v_name then return json_build_object('ok', false, 'code', 'name_mismatch'); end if;
    if s.pin_hash is null then
      update public.land_students set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
             failed_count = 0, locked_until = null, last_login_at = now()
       where id = s.id returning * into s;
      v_code := 'reset';
    elsif s.locked_until is not null and s.locked_until > now() then
      return json_build_object('ok', false, 'code', 'locked',
                               'minutes', ceil(extract(epoch from (s.locked_until - now())) / 60));
    elsif s.pin_hash <> extensions.crypt(p_pin, s.pin_hash) then
      update public.land_students set
        failed_count = case when s.failed_count + 1 >= 8 then 0 else s.failed_count + 1 end,
        locked_until = case when s.failed_count + 1 >= 8 then now() + interval '10 minutes' else null end
       where id = s.id;
      return json_build_object('ok', false, 'code', case when s.failed_count + 1 >= 8 then 'locked' else 'wrong_pin' end,
                               'left', greatest(0, 7 - s.failed_count), 'minutes', 10);
    else
      update public.land_students set failed_count = 0, locked_until = null, last_login_at = now()
       where id = s.id returning * into s;
      v_code := 'ok';
    end if;
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.land_sessions (token_hash, student_id, expires_at)
    values (private.land_hash(v_token), s.id, now() + interval '1 day');
  delete from public.land_sessions where student_id = s.id and expires_at < now();

  return json_build_object('ok', true, 'code', v_code, 'token', v_token, 'student', private.land_student_json(s));
end $$;

create or replace function public.land_logout(p_token text)
returns boolean language sql security definer set search_path = '' as $$
  delete from public.land_sessions where token_hash = private.land_hash(p_token) returning true;
$$;

-- 활동에 들어올 때: 이 학생에게 열린 운영 + 내 기록(이어하기)
create or replace function public.land_enter(p_token text, p_slug text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  s public.land_students := private.land_student_of(p_token);
  r public.land_runs;
  rec public.land_records;
  v_state text;
begin
  if s.id is null then return json_build_object('ok', false, 'code', 'no_session'); end if;

  -- 1순위: 지금 저장할 수 있는 운영(가장 최근), 2순위: 이 학생 대상인 가장 최근 운영
  select * into r from public.land_runs x
   where x.activity_slug = p_slug and x.school_year = s.school_year
     and private.land_run_state(x, s) in ('ok', 'closed', 'not_yet', 'ended')
   order by (private.land_run_state(x, s) = 'ok') desc, x.created_at desc
   limit 1;
  if r.id is null then
    return json_build_object('ok', false, 'code', 'no_run', 'student', private.land_student_json(s));
  end if;

  v_state := private.land_run_state(r, s);
  select * into rec from public.land_records where run_id = r.id and student_id = s.id;

  return json_build_object(
    'ok', v_state = 'ok', 'code', v_state,
    'student', private.land_student_json(s),
    'run', json_build_object('id', r.id, 'mode', r.mode, 'label', r.label, 'version', r.version,
                             'starts_at', r.starts_at, 'ends_at', r.ends_at),
    'record', case when rec.id is null then null else json_build_object(
                'detail', rec.detail, 'summary', rec.summary, 'score', rec.score, 'level', rec.level,
                'started_at', rec.started_at, 'saved_at', rec.saved_at, 'finished_at', rec.finished_at) end);
end $$;

-- 저장(여러 번 불러도 됨). p_finish = true 면 완료·제출 시각을 남김
create or replace function public.land_save(p_token text, p_run_id bigint, p_detail jsonb,
                                            p_summary text default null, p_score numeric default null,
                                            p_level text default null, p_finish boolean default false)
returns json language plpgsql security definer set search_path = '' as $$
declare
  s public.land_students := private.land_student_of(p_token);
  r public.land_runs;
  v_state text;
  rec public.land_records;
begin
  if s.id is null then return json_build_object('ok', false, 'code', 'no_session'); end if;
  select * into r from public.land_runs where id = p_run_id;
  if r.id is null then return json_build_object('ok', false, 'code', 'no_run'); end if;
  v_state := private.land_run_state(r, s);
  if v_state <> 'ok' then return json_build_object('ok', false, 'code', v_state); end if;
  if octet_length(coalesce(p_detail, '{}'::jsonb)::text) > 500000 then
    return json_build_object('ok', false, 'code', 'too_big');
  end if;

  insert into public.land_records as x (run_id, student_id, version, detail, summary, score, level, finished_at, save_count)
    values (r.id, s.id, r.version, coalesce(p_detail, '{}'::jsonb), p_summary, p_score, p_level,
            case when p_finish then now() end, 1)
  on conflict (run_id, student_id) do update set
    detail      = coalesce(p_detail, x.detail),
    summary     = coalesce(p_summary, x.summary),
    score       = coalesce(p_score, x.score),
    level       = coalesce(p_level, x.level),
    finished_at = case when p_finish then coalesce(x.finished_at, now()) else x.finished_at end,
    saved_at    = now(),
    save_count  = x.save_count + 1
  returning * into rec;

  return json_build_object('ok', true, 'code', 'saved', 'saved_at', rec.saved_at, 'finished_at', rec.finished_at);
end $$;

-- 내 기록(학생 입구용): 올해 내가 한 활동
create or replace function public.land_my_records(p_token text)
returns json language plpgsql security definer set search_path = '' as $$
declare s public.land_students := private.land_student_of(p_token);
begin
  if s.id is null then return json_build_object('ok', false, 'code', 'no_session'); end if;
  return json_build_object('ok', true, 'student', private.land_student_json(s), 'records', coalesce((
    select json_agg(json_build_object('slug', r.activity_slug, 'title', a.title, 'mode', r.mode, 'label', r.label,
                                      'started_at', x.started_at, 'finished_at', x.finished_at,
                                      'score', x.score, 'level', x.level,
                                      'open', private.land_run_state(r, s) = 'ok') order by x.started_at desc)
      from public.land_records x
      join public.land_runs r on r.id = x.run_id
      join public.land_activities a on a.slug = r.activity_slug
     where x.student_id = s.id), '[]'::json));
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4) 교사 함수 (teachers 표에 등록된 계정만)
-- ─────────────────────────────────────────────────────────────
create or replace function private.land_need_teacher()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_teacher() then raise exception 'not allowed' using errcode = '42501'; end if;
end $$;

-- 교사 홈: 모든 활동(숨김 포함) + 올해 운영 요약
create or replace function public.land_t_activities()
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  return coalesce((select json_agg(json_build_object(
      'slug', a.slug, 'title', a.title, 'summary', a.summary, 'grade_label', a.grade_label, 'unit', a.unit,
      'grade_group', a.grade_group, 'mode', a.mode, 'status', a.status, 'entry_url', a.entry_url,
      'due_text', a.due_text, 'version', a.current_version, 'art', a.art, 'theme', a.theme,
      'runs', coalesce((select json_agg(json_build_object(
                  'id', r.id, 'year', r.school_year, 'version', r.version, 'mode', r.mode, 'label', r.label,
                  'starts_at', r.starts_at, 'ends_at', r.ends_at, 'target_classes', r.target_classes,
                  'closed_classes', r.closed_classes, 'status', r.status, 'created_at', r.created_at,
                  'records', (select count(*) from public.land_records x where x.run_id = r.id),
                  'finished', (select count(*) from public.land_records x where x.run_id = r.id and x.finished_at is not null))
                order by r.school_year desc, r.created_at desc)
                from public.land_runs r where r.activity_slug = a.slug), '[]'::json))
      order by a.sort_order, a.id) from public.land_activities a), '[]'::json);
end $$;

-- 활동 카드 정보 고치기(입장 주소·기한 글자·첫 화면 상태)
create or replace function public.land_t_update_activity(p_slug text, p_entry_url text, p_due_text text, p_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  update public.land_activities set entry_url = nullif(btrim(p_entry_url), ''), due_text = nullif(btrim(p_due_text), ''),
         status = p_status, updated_at = now() where slug = p_slug;
  return found;
end $$;

-- 운영 만들기(p_id 비움) / 고치기
create or replace function public.land_t_save_run(p_id bigint, p_slug text, p_year integer, p_mode text, p_label text,
                                                  p_starts timestamptz, p_ends timestamptz, p_classes text[])
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_ver text;
begin
  perform private.land_need_teacher();
  if p_classes is not null and exists (select 1 from unnest(p_classes) c where c !~ '^[1-3]-[1-9]$') then
    raise exception 'bad class';
  end if;
  if p_id is null then
    select current_version into v_ver from public.land_activities where slug = p_slug;
    if v_ver is null then raise exception 'no activity'; end if;
    insert into public.land_runs (activity_slug, school_year, version, mode, label, starts_at, ends_at, target_classes)
      values (p_slug, coalesce(p_year, private.land_school_year()), v_ver, p_mode, nullif(btrim(p_label), ''),
              p_starts, p_ends, coalesce(p_classes, '{}'))
      returning id into v_id;
  else
    update public.land_runs set mode = p_mode, label = nullif(btrim(p_label), ''), starts_at = p_starts, ends_at = p_ends,
           target_classes = coalesce(p_classes, '{}'), updated_at = now()
     where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

-- 열기·마감(전체), 반별 마감·풀기
create or replace function public.land_t_set_run_status(p_id bigint, p_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  update public.land_runs set status = p_status, updated_at = now() where id = p_id;
  return found;
end $$;

create or replace function public.land_t_close_class(p_id bigint, p_class text, p_closed boolean)
returns text[] language plpgsql security definer set search_path = '' as $$
declare v text[];
begin
  perform private.land_need_teacher();
  if p_class !~ '^[1-3]-[1-9]$' then raise exception 'bad class'; end if;
  update public.land_runs set
    closed_classes = case when p_closed then array(select distinct unnest(closed_classes || p_class) order by 1)
                          else array_remove(closed_classes, p_class) end,
    updated_at = now()
   where id = p_id returning closed_classes into v;
  return v;
end $$;

-- 현황판: 한 활동의 학년도 목록
create or replace function public.land_t_years(p_slug text)
returns integer[] language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  return coalesce((select array_agg(distinct school_year order by school_year desc)
                     from public.land_runs where activity_slug = p_slug), '{}');
end $$;

-- 현황판: 한 활동·학년도의 기록(자세한 내용 detail 은 빼고)
create or replace function public.land_t_records(p_slug text, p_year integer)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  return coalesce((select json_agg(json_build_object(
      'record_id', x.id, 'run_id', r.id, 'run_label', r.label, 'mode', r.mode, 'version', x.version,
      'student_id', s.id, 'no', s.student_no, 'name', s.name, 'grade', s.grade, 'class_no', s.class_no,
      'student_status', s.status, 'started_at', x.started_at, 'saved_at', x.saved_at,
      'finished_at', x.finished_at, 'score', x.score, 'level', x.level, 'summary', x.summary,
      'save_count', x.save_count) order by s.student_no, r.created_at)
    from public.land_records x
    join public.land_runs r on r.id = x.run_id
    join public.land_students s on s.id = x.student_id
   where r.activity_slug = p_slug and r.school_year = p_year), '[]'::json);
end $$;

-- 현황판: 기록 하나의 자세한 내용
create or replace function public.land_t_record_detail(p_record_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  return (select detail from public.land_records where id = p_record_id);
end $$;

-- 학생 관리: 학년도 명단
create or replace function public.land_t_students(p_year integer)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  return coalesce((select json_agg(json_build_object(
      'id', s.id, 'no', s.student_no, 'name', s.name, 'grade', s.grade, 'class_no', s.class_no,
      'status', s.status, 'pin_set', s.pin_hash is not null,
      'locked', s.locked_until is not null and s.locked_until > now(),
      'created_at', s.created_at, 'last_login_at', s.last_login_at,
      'records', (select count(*) from public.land_records x where x.student_id = s.id))
      order by s.student_no)
    from public.land_students s where s.school_year = p_year), '[]'::json);
end $$;

create or replace function public.land_t_student_years()
returns integer[] language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  return array(select distinct y from (select school_year y from public.land_students
                                       union select private.land_school_year()) t order by y desc);
end $$;

-- 비번 초기화(다음 로그인 때 학생이 새 비번 등록) — 로그인 중인 기기도 로그아웃
create or replace function public.land_t_reset_pin(p_student_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  update public.land_students set pin_hash = null, failed_count = 0, locked_until = null where id = p_student_id;
  delete from public.land_sessions where student_id = p_student_id;
  return true;
end $$;

-- 잘못 등록한 학번·이름 고치기 → 'ok' / 'dup'(같은 학번이 이미 있음) / 'bad'
create or replace function public.land_t_fix_student(p_student_id bigint, p_no text, p_name text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  if p_no !~ '^[1-3][1-9][0-9]{2}$' or char_length(btrim(p_name)) not between 1 and 10 then return 'bad'; end if;
  update public.land_students set student_no = p_no, name = btrim(p_name) where id = p_student_id;
  delete from public.land_sessions where student_id = p_student_id;
  return 'ok';
exception when unique_violation then
  return 'dup';
end $$;

-- 전출 표시 / 되돌리기 (기록은 그대로 보관)
create or replace function public.land_t_set_moved(p_student_id bigint, p_moved boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  update public.land_students set status = case when p_moved then 'moved' else 'active' end where id = p_student_id;
  if p_moved then delete from public.land_sessions where student_id = p_student_id; end if;
  return true;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5) 실행 권한: 함수만 열어 둠
-- ─────────────────────────────────────────────────────────────
revoke all on function private.land_school_year(timestamptz), private.land_hash(text), private.land_student_of(text),
  private.land_student_json(public.land_students), private.land_run_state(public.land_runs, public.land_students),
  private.land_need_teacher() from public, anon, authenticated;

revoke all on function
  public.land_login(text, text, text), public.land_logout(text), public.land_enter(text, text),
  public.land_save(text, bigint, jsonb, text, numeric, text, boolean), public.land_my_records(text),
  public.land_t_activities(), public.land_t_update_activity(text, text, text, text),
  public.land_t_save_run(bigint, text, integer, text, text, timestamptz, timestamptz, text[]),
  public.land_t_set_run_status(bigint, text), public.land_t_close_class(bigint, text, boolean),
  public.land_t_years(text), public.land_t_records(text, integer), public.land_t_record_detail(bigint),
  public.land_t_students(integer), public.land_t_student_years(), public.land_t_reset_pin(bigint),
  public.land_t_fix_student(bigint, text, text), public.land_t_set_moved(bigint, boolean)
from public;

grant execute on function
  public.land_login(text, text, text), public.land_logout(text), public.land_enter(text, text),
  public.land_save(text, bigint, jsonb, text, numeric, text, boolean), public.land_my_records(text)
to anon, authenticated;

grant execute on function
  public.land_t_activities(), public.land_t_update_activity(text, text, text, text),
  public.land_t_save_run(bigint, text, integer, text, text, timestamptz, timestamptz, text[]),
  public.land_t_set_run_status(bigint, text), public.land_t_close_class(bigint, text, boolean),
  public.land_t_years(text), public.land_t_records(text, integer), public.land_t_record_detail(bigint),
  public.land_t_students(integer), public.land_t_student_years(), public.land_t_reset_pin(bigint),
  public.land_t_fix_student(bigint, text, text), public.land_t_set_moved(bigint, boolean)
to authenticated;

-- 첫 버전 기록
insert into public.land_activity_versions (activity_slug, version, changes)
select slug, current_version, '수학나라에 처음 등록' from public.land_activities
on conflict do nothing;

-- Supabase는 새 함수에 anon 실행 권한을 따로 주므로, 교사 함수는 anon에서 한 번 더 뺌
revoke execute on function
  public.land_t_activities(), public.land_t_update_activity(text, text, text, text),
  public.land_t_save_run(bigint, text, integer, text, text, timestamptz, timestamptz, text[]),
  public.land_t_set_run_status(bigint, text), public.land_t_close_class(bigint, text, boolean),
  public.land_t_years(text), public.land_t_records(text, integer), public.land_t_record_detail(bigint),
  public.land_t_students(integer), public.land_t_student_years(), public.land_t_reset_pin(bigint),
  public.land_t_fix_student(bigint, text, text), public.land_t_set_moved(bigint, boolean)
from anon;
