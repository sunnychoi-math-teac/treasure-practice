-- Math Land Explorers · 무리수 사냥(jungle-run)을 공통 틀에 연결
-- 로그인은 공통(land_login → 토큰), 운영·마감은 land_runs, 학생 한 명의 요약은 land_records 한 줄.
-- 한 운영에서 여러 판을 달리므로 판·훈련은 따로 표에 쌓습니다.
-- 예전 표(runner_players / runner_runs / runner_trainings)와 runner_* 함수는 그대로 보관합니다(바꾸지 않음).

-- ─────────────────────────────────────────────────────────────
-- 1) 표
-- ─────────────────────────────────────────────────────────────
-- 학생별 훈련 상태(운영마다): 훈련 대기 유형, 받은 배지, 다음 판 보호막
create table if not exists public.land_jr_state (
  record_id     bigint      primary key references public.land_records(id) on delete cascade,
  train_due     integer[]   not null default '{}',
  train_badges  integer[]   not null default '{}',
  shield        integer     not null default 0,
  updated_at    timestamptz not null default now()
);

-- 달린 판
create table if not exists public.land_jr_games (
  id           bigint generated always as identity primary key,
  record_id    bigint      not null references public.land_records(id) on delete cascade,
  score        integer     not null,
  distance     integer     not null,
  cleared      boolean     not null default false,
  correct      integer     not null,
  wrong        integer     not null,
  gates        integer     not null,
  duration_ms  integer     not null,
  wrong_items  text[]      not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists land_jr_games_record_idx on public.land_jr_games(record_id, created_at);

-- 훈련소 기록
create table if not exists public.land_jr_trainings (
  id          bigint generated always as identity primary key,
  record_id   bigint      not null references public.land_records(id) on delete cascade,
  type        integer     not null check (type between 1 and 5),
  correct     integer     not null check (correct between 0 and 5),
  passed      boolean     not null,
  required    boolean     not null,
  created_at  timestamptz not null default now()
);
create index if not exists land_jr_trainings_record_idx on public.land_jr_trainings(record_id, created_at);

alter table public.land_jr_state     enable row level security;
alter table public.land_jr_games     enable row level security;
alter table public.land_jr_trainings enable row level security;
revoke all on table public.land_jr_state, public.land_jr_games, public.land_jr_trainings from anon, authenticated;

-- 첫 화면·교사 홈의 학생 주소를 새 폴더로
update public.land_activities set entry_url = 'activities/jungle-run/', current_version = '2.0', updated_at = now()
 where slug = 'jungle-run';
insert into public.land_activity_versions (activity_slug, version, changes)
values ('jungle-run', '2.0', '수학나라 공통 로그인·운영(반에 열기·반별 마감)·현황판으로 옮김. 게임 규칙은 그대로')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- 2) 내부 도움 함수
-- ─────────────────────────────────────────────────────────────
-- 토큰 + 운영 → 확인 결과. p_write = true 이면 저장 가능한 상태('ok')여야 하고, 기록 줄이 없으면 만듦
create or replace function private.land_jr_ctx(p_token text, p_run_id bigint, p_write boolean,
                                               out o_code text, out o_student bigint, out o_record bigint)
language plpgsql security definer set search_path = '' as $$
declare
  s public.land_students := private.land_student_of(p_token);
  r public.land_runs;
  v_state text;
  v_rec bigint;
begin
  if s.id is null then o_code := 'no_session'; return; end if;
  o_student := s.id;
  select * into r from public.land_runs where id = p_run_id;
  if r.id is null or r.activity_slug <> 'jungle-run' then o_code := 'no_run'; return; end if;
  v_state := private.land_run_state(r, s);
  if v_state in ('other_year', 'not_target') then o_code := v_state; return; end if;

  select x.id into v_rec from public.land_records x where x.run_id = r.id and x.student_id = s.id;
  if p_write then
    if v_state <> 'ok' then o_code := v_state; return; end if;
    if v_rec is null then
      insert into public.land_records as x (run_id, student_id, version, detail)
        values (r.id, s.id, r.version, '{}'::jsonb)
      on conflict (run_id, student_id) do nothing returning x.id into v_rec;
      if v_rec is null then
        select x.id into v_rec from public.land_records x where x.run_id = r.id and x.student_id = s.id;
      end if;
    end if;
    insert into public.land_jr_state as j (record_id) values (v_rec) on conflict do nothing;
  end if;
  o_record := v_rec;
  o_code := 'ok';
end $$;

create or replace function private.land_jr_state_json(p_record_id bigint)
returns json language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select json_build_object('train_due', x.train_due, 'badges', x.train_badges, 'shield', x.shield)
       from public.land_jr_state x where x.record_id = p_record_id),
    json_build_object('train_due', '{}'::int[], 'badges', '{}'::int[], 'shield', 0));
$$;

-- 이 운영 안에서 나의 최고 기록·순위
create or replace function private.land_jr_me(p_record_id bigint)
returns json language sql stable security definer set search_path = '' as $$
  with me as (select run_id from public.land_records where id = p_record_id),
  best as (
    select distinct on (g.record_id) g.record_id, g.score, g.distance, g.cleared
      from public.land_jr_games g join public.land_records x on x.id = g.record_id
     where x.run_id = (select run_id from me)
     order by g.record_id, g.cleared desc, g.score desc, g.created_at
  ), ranked as (
    select b.*, rank() over (order by b.cleared desc, b.score desc) rk, count(*) over () total from best b
  )
  select coalesce(
    (select json_build_object('best', score, 'distance', distance, 'cleared', cleared, 'rank', rk, 'total', total,
             'plays', (select count(*) from public.land_jr_games g where g.record_id = p_record_id))
       from ranked where record_id = p_record_id),
    json_build_object('best', null, 'rank', null, 'plays', 0));
$$;

-- 공통 기록 줄(land_records) 요약 다시 계산: 점수 = 최고점, 수준 = 완주 / 최고 거리, 요약 = 판 수·정확도
-- 완료 시각(finished_at) = 처음 완주한 때
create or replace function private.land_jr_refresh(p_record_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare b record; t record;
begin
  select g.score, g.distance, g.cleared into b from public.land_jr_games g
   where g.record_id = p_record_id order by g.cleared desc, g.score desc, g.created_at limit 1;
  select count(*) plays, count(*) filter (where cleared) clears, coalesce(sum(correct), 0) c, coalesce(sum(wrong), 0) w,
         min(created_at) filter (where cleared) first_clear
    into t from public.land_jr_games where record_id = p_record_id;
  update public.land_records set
    score       = b.score,
    level       = case when b.score is null then null when b.cleared then '완주' else b.distance || ' m' end,
    summary     = case when t.plays = 0 then null else t.plays || '판 · 정확도 ' ||
                    case when t.c + t.w = 0 then '-' else round(100.0 * t.c / (t.c + t.w)) || '%' end end,
    detail      = jsonb_build_object('plays', t.plays, 'clears', t.clears, 'correct', t.c, 'wrong', t.w,
                                     'state', private.land_jr_state_json(p_record_id)::jsonb),
    finished_at = t.first_clear,
    saved_at    = now(),
    save_count  = save_count + 1
  where id = p_record_id;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3) 학생 함수 (공통 로그인 토큰 사용)
-- ─────────────────────────────────────────────────────────────
-- 들어온 뒤 훈련 상태·내 순위 (마감된 운영도 보기는 됨)
create or replace function public.land_jr_state(p_token text, p_run_id bigint)
returns json language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from private.land_jr_ctx(p_token, p_run_id, false);
  if c.o_code <> 'ok' then return json_build_object('ok', false, 'code', c.o_code); end if;
  return json_build_object('ok', true, 'state', private.land_jr_state_json(c.o_record),
                           'me', case when c.o_record is null then json_build_object('best', null, 'rank', null, 'plays', 0)
                                      else private.land_jr_me(c.o_record) end);
end $$;

-- 한 판 저장 (예전 runner_submit 과 같은 검사 + 운영·마감 검사)
create or replace function public.land_jr_submit(p_token text, p_run_id bigint, p_score integer, p_distance integer,
                                                 p_cleared boolean, p_correct integer, p_wrong integer, p_gates integer,
                                                 p_duration_ms integer, p_wrong_items text[], p_train_types integer[] default '{}')
returns json language plpgsql security definer set search_path = '' as $$
declare c record; st public.land_jr_state; v_last timestamptz; v_cap integer; v_types integer[];
begin
  select * into c from private.land_jr_ctx(p_token, p_run_id, true);
  if c.o_code <> 'ok' then return json_build_object('ok', false, 'code', c.o_code); end if;
  select * into st from public.land_jr_state where record_id = c.o_record for update;

  if cardinality(st.train_due) > 0 then
    return json_build_object('ok', false, 'code', 'train_due', 'state', private.land_jr_state_json(c.o_record));
  end if;
  if p_distance is null or p_distance < 0 or p_distance > 1000
     or p_score is null or p_correct is null or p_wrong is null or p_gates is null or p_duration_ms is null
     or (coalesce(p_cleared, false) and p_distance < 1000)
     or p_gates < 0 or p_gates > 2 or p_correct < 0 or p_wrong < 0 or p_wrong > 3 + st.shield
     or p_correct > p_distance / 4 + 3
     or p_duration_ms < p_distance * 40
     or coalesce(array_length(p_wrong_items, 1), 0) > 8
     or exists (select 1 from unnest(coalesce(p_wrong_items, '{}')) w where char_length(w) > 40)
     or coalesce(array_length(p_train_types, 1), 0) > 2
     or exists (select 1 from unnest(coalesce(p_train_types, '{}')) t where t not between 1 and 5) then
    return json_build_object('ok', false, 'code', 'invalid');
  end if;
  v_cap := p_distance + 30 * p_correct + 100 * p_gates + case when p_cleared then 800 else 0 end;
  if p_score < 0 or p_score > v_cap then return json_build_object('ok', false, 'code', 'invalid'); end if;

  select max(created_at) into v_last from public.land_jr_games where record_id = c.o_record;
  if v_last is not null and v_last > now() - interval '10 seconds' then
    return json_build_object('ok', false, 'code', 'too_fast');
  end if;

  insert into public.land_jr_games (record_id, score, distance, cleared, correct, wrong, gates, duration_ms, wrong_items)
  values (c.o_record, p_score, p_distance, coalesce(p_cleared, false), p_correct, p_wrong, p_gates, p_duration_ms,
          coalesce(p_wrong_items, '{}'));
  select coalesce(array_agg(distinct t), '{}') into v_types from unnest(coalesce(p_train_types, '{}')) t;
  update public.land_jr_state set shield = 0, train_due = v_types, updated_at = now() where record_id = c.o_record;
  perform private.land_jr_refresh(c.o_record);
  return json_build_object('ok', true, 'me', private.land_jr_me(c.o_record), 'state', private.land_jr_state_json(c.o_record));
end $$;

-- 훈련 결과 저장 (5문제 중 4개 이상 = 통과 → 대기 해제·배지·보호막 1회)
create or replace function public.land_jr_train_done(p_token text, p_run_id bigint, p_type integer, p_correct integer)
returns json language plpgsql security definer set search_path = '' as $$
declare c record; st public.land_jr_state; v_pass boolean;
begin
  if p_type is null or p_type not between 1 and 5 or p_correct is null or p_correct not between 0 and 5 then
    return json_build_object('ok', false, 'code', 'invalid');
  end if;
  select * into c from private.land_jr_ctx(p_token, p_run_id, true);
  if c.o_code <> 'ok' then return json_build_object('ok', false, 'code', c.o_code); end if;
  select * into st from public.land_jr_state where record_id = c.o_record for update;
  v_pass := p_correct >= 4;
  insert into public.land_jr_trainings (record_id, type, correct, passed, required)
    values (c.o_record, p_type, p_correct, v_pass, p_type = any (st.train_due));
  if v_pass then
    update public.land_jr_state set
      train_due = array_remove(train_due, p_type),
      train_badges = case when p_type = any (train_badges) then train_badges else array_append(train_badges, p_type) end,
      shield = 1, updated_at = now()
    where record_id = c.o_record;
  end if;
  perform private.land_jr_refresh(c.o_record);
  return json_build_object('ok', true, 'passed', v_pass, 'state', private.land_jr_state_json(c.o_record));
end $$;

-- 랭킹: 같은 운영 안에서 TOP 20 (p_class 예: '3-1', 비우면 전체). 완주 우선 → 점수 순
create or replace function public.land_jr_top(p_token text, p_run_id bigint, p_class text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from private.land_jr_ctx(p_token, p_run_id, false);
  if c.o_code <> 'ok' then return json_build_object('ok', false, 'code', c.o_code); end if;
  return json_build_object('ok', true, 'rows', coalesce((select json_agg(z order by z.rk, z.student_no) from (
    select rank() over (order by b.cleared desc, b.score desc) rk, b.student_no, b.name, b.score, b.distance, b.cleared
      from (select distinct on (g.record_id) g.record_id, s.student_no, s.name, g.score, g.distance, g.cleared
              from public.land_jr_games g
              join public.land_records x on x.id = g.record_id
              join public.land_students s on s.id = x.student_id
             where x.run_id = p_run_id and (p_class is null or (s.grade || '-' || s.class_no) = p_class)
             order by g.record_id, g.cleared desc, g.score desc, g.created_at) b
     order by 1, 2 limit 20) z), '[]'::json));
end $$;

-- 내 기록: 최근 10판
create or replace function public.land_jr_my_games(p_token text, p_run_id bigint)
returns json language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select * into c from private.land_jr_ctx(p_token, p_run_id, false);
  if c.o_code <> 'ok' then return json_build_object('ok', false, 'code', c.o_code); end if;
  if c.o_record is null then
    return json_build_object('ok', true, 'me', json_build_object('best', null, 'rank', null, 'plays', 0), 'runs', '[]'::json);
  end if;
  return json_build_object('ok', true, 'me', private.land_jr_me(c.o_record),
    'runs', (select coalesce(json_agg(x), '[]'::json) from (
       select score, distance, cleared, correct, wrong, gates, created_at
         from public.land_jr_games where record_id = c.o_record order by created_at desc limit 10) x));
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4) 교사 함수
-- ─────────────────────────────────────────────────────────────
-- 현황판 자료: 한 운영의 학생·판·훈련
create or replace function public.land_t_jr_data(p_run_id bigint)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  return json_build_object(
    'students', coalesce((select json_agg(json_build_object(
        'record_id', x.id, 'student_id', s.id, 'student_no', s.student_no, 'name', s.name, 'student_status', s.status,
        'created_at', x.started_at, 'last_login_at', s.last_login_at,
        'train_due', coalesce(st.train_due, '{}'), 'train_badges', coalesce(st.train_badges, '{}'), 'shield', coalesce(st.shield, 0))
        order by s.student_no)
      from public.land_records x join public.land_students s on s.id = x.student_id
      left join public.land_jr_state st on st.record_id = x.id
      where x.run_id = p_run_id), '[]'::json),
    'runs', coalesce((select json_agg(json_build_object(
        'id', g.id, 'record_id', g.record_id, 'score', g.score, 'distance', g.distance, 'cleared', g.cleared,
        'correct', g.correct, 'wrong', g.wrong, 'gates', g.gates, 'duration_ms', g.duration_ms,
        'wrong_items', g.wrong_items, 'created_at', g.created_at) order by g.created_at desc)
      from public.land_jr_games g join public.land_records x on x.id = g.record_id where x.run_id = p_run_id), '[]'::json),
    'trains', coalesce((select json_agg(json_build_object(
        'record_id', t.record_id, 'type', t.type, 'correct', t.correct, 'passed', t.passed, 'required', t.required,
        'created_at', t.created_at) order by t.created_at desc)
      from public.land_jr_trainings t join public.land_records x on x.id = t.record_id where x.run_id = p_run_id), '[]'::json));
end $$;

-- 훈련 면제
create or replace function public.land_t_jr_clear_training(p_record_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  update public.land_jr_state set train_due = '{}', updated_at = now() where record_id = p_record_id;
  if found then perform private.land_jr_refresh(p_record_id); end if;
  return found;
end $$;

-- 이상한 판 삭제(선생님이 직접 누를 때만)
create or replace function public.land_t_jr_delete_game(p_game_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  perform private.land_need_teacher();
  delete from public.land_jr_games where id = p_game_id returning record_id into v;
  if v is null then return false; end if;
  perform private.land_jr_refresh(v);
  return true;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5) 실행 권한
-- ─────────────────────────────────────────────────────────────
revoke all on function private.land_jr_ctx(text, bigint, boolean), private.land_jr_state_json(bigint),
  private.land_jr_me(bigint), private.land_jr_refresh(bigint) from public, anon, authenticated;

revoke all on function
  public.land_jr_state(text, bigint),
  public.land_jr_submit(text, bigint, integer, integer, boolean, integer, integer, integer, integer, text[], integer[]),
  public.land_jr_train_done(text, bigint, integer, integer), public.land_jr_top(text, bigint, text),
  public.land_jr_my_games(text, bigint),
  public.land_t_jr_data(bigint), public.land_t_jr_clear_training(bigint), public.land_t_jr_delete_game(bigint)
from public;

grant execute on function
  public.land_jr_state(text, bigint),
  public.land_jr_submit(text, bigint, integer, integer, boolean, integer, integer, integer, integer, text[], integer[]),
  public.land_jr_train_done(text, bigint, integer, integer), public.land_jr_top(text, bigint, text),
  public.land_jr_my_games(text, bigint)
to anon, authenticated;

grant execute on function
  public.land_t_jr_data(bigint), public.land_t_jr_clear_training(bigint), public.land_t_jr_delete_game(bigint)
to authenticated;
revoke execute on function
  public.land_t_jr_data(bigint), public.land_t_jr_clear_training(bigint), public.land_t_jr_delete_game(bigint)
from anon;
