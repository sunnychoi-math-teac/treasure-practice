-- Math Land Explorers · 초코볼 다이어그램 (2026-11-19) — 실행 완료(2026-11-19 선생님 허락)
-- 1) 활동 등록 + 버전 기록
-- 2) 풀이 사진 채점 표 land_grades (학생 저장 land_save 가 detail 을 통째로 덮어쓰므로 채점은 따로 둠)
-- 3) 교사 함수 land_t_grade(채점 저장), land_t_grades(채점 목록)
-- 학생 사진은 기존 land-upload 이름(m1 초코볼, m2 풀이①, m3 풀이②)을 씀 → 서버 작업·보관함 권한은 바꾸지 않음
-- 기존 표·함수는 바꾸지 않습니다.

insert into public.land_activities (slug, title, summary, grade_group, grade_label, unit, mode, mode_label, status,
                                    entry_url, art, theme, keywords, due_text, sort_order, current_version)
values ('choco-diagram', '초코볼 다이어그램', '초코볼 실험으로 보로노이 다이어그램을 만들고, 지도에서 사라진 옛 학교를 찾아요.',
        'high', '고1 공통수학2', '직선의 방정식', 'class', '수업', 'open',
        'activities/choco-diagram/', 'choco', '#FDEFE3',
        '초코볼 보로노이 수직이등분선 직선의 방정식 지도 폐교 공통수학2 고등학교 수업', null, 16, '1.0')
on conflict (slug) do nothing;

insert into public.land_activity_versions (activity_slug, version, changes) values
  ('choco-diagram', '1.0', '데스모스 보로노이 수업을 수학나라로 옮김: 초코볼 사진·수직이등분선 표·퀴즈 3문항·사라진 학교 찾기(5버전)·풀이 사진 2장과 교사 채점')
on conflict do nothing;

create table if not exists public.land_grades (
  record_id  bigint      not null references public.land_records(id) on delete cascade,
  key        text        not null check (key in ('sol1', 'sol2')),
  score      integer     not null,
  max        integer     not null check (max > 0),
  memo       text,
  marks      jsonb       not null default '[]'::jsonb,   -- 사진 위 펜 획 [{c,w,p:[[x,y]…]}], 좌표는 사진 기준 0~1
  graded_at  timestamptz not null default now(),
  primary key (record_id, key),
  check (score between 0 and max)
);
alter table public.land_grades enable row level security;
revoke all on table public.land_grades from anon, authenticated;

create or replace function public.land_t_grade(p_record_id bigint, p_key text, p_score integer, p_max integer,
                                               p_memo text, p_marks jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare v1 integer; v2 integer;
begin
  perform private.land_need_teacher();
  if p_key not in ('sol1', 'sol2') then return json_build_object('ok', false, 'code', 'bad_key'); end if;
  if p_score is null or p_max is null or p_max <= 0 or p_score < 0 or p_score > p_max then
    return json_build_object('ok', false, 'code', 'bad_score');
  end if;
  if octet_length(coalesce(p_marks, '[]'::jsonb)::text) > 300000 then return json_build_object('ok', false, 'code', 'too_big'); end if;
  if not exists (select 1 from public.land_records where id = p_record_id) then return json_build_object('ok', false, 'code', 'no_record'); end if;

  insert into public.land_grades (record_id, key, score, max, memo, marks, graded_at)
    values (p_record_id, p_key, p_score, p_max, nullif(btrim(p_memo), ''), coalesce(p_marks, '[]'::jsonb), now())
  on conflict (record_id, key) do update set score = excluded.score, max = excluded.max, memo = excluded.memo,
    marks = excluded.marks, graded_at = now();

  select max(score) filter (where key = 'sol1'), max(score) filter (where key = 'sol2') into v1, v2
    from public.land_grades where record_id = p_record_id;
  update public.land_records set score = coalesce(v1, 0) + coalesce(v2, 0),
    level = '① ' || coalesce(v1::text, '–') || ' · ② ' || coalesce(v2::text, '–')
   where id = p_record_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.land_t_grades(p_slug text, p_year integer)
returns json language plpgsql security definer set search_path = '' as $$
begin
  perform private.land_need_teacher();
  return coalesce((select json_agg(json_build_object('record_id', g.record_id, 'key', g.key, 'score', g.score, 'max', g.max,
      'memo', g.memo, 'marks', g.marks, 'graded_at', g.graded_at))
    from public.land_grades g
    join public.land_records x on x.id = g.record_id
    join public.land_runs r on r.id = x.run_id
   where r.activity_slug = p_slug and r.school_year = p_year), '[]'::json);
end $$;

revoke all on function public.land_t_grade(bigint, text, integer, integer, text, jsonb), public.land_t_grades(text, integer) from public;
grant execute on function public.land_t_grade(bigint, text, integer, integer, text, jsonb), public.land_t_grades(text, integer) to authenticated;
-- 2026-11-19 실행 후 추가: Supabase 기본 설정으로 생긴 익명(anon) 실행 권한도 뺌(로그인한 선생님 계정만)
revoke execute on function public.land_t_grade(bigint, text, integer, integer, text, jsonb), public.land_t_grades(text, integer) from anon;
