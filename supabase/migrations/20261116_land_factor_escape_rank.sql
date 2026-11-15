-- Math Land Explorers · FACTOR ESCAPE 탈출 순위 (2026-11-16, 선생님 허락)
-- 학생 화면 「정원」에서 우리 반의 탈출 순서를 보여 줍니다.
--  · 같은 운영 + 같은 반 학생 중 방7(오늘의 비밀)을 통과한 학생만, 먼저 탈출한 순서대로
--  · 다른 학생 이름은 가림(김*수), 본인 이름만 그대로
--  · 표는 바꾸지 않고 읽기만 하는 함수 하나만 더함

create or replace function public.land_fe_rank(p_token text, p_run_id bigint)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  s public.land_students := private.land_student_of(p_token);
  r public.land_runs;
begin
  if s.id is null then return json_build_object('ok', false, 'code', 'no_session'); end if;
  select * into r from public.land_runs where id = p_run_id and activity_slug = 'factor-escape';
  if r.id is null then return json_build_object('ok', false, 'code', 'no_run'); end if;

  return json_build_object('ok', true, 'grade', s.grade, 'class_no', s.class_no, 'list', coalesce((
    select json_agg(json_build_object('rank', q.rk, 'name', case when q.me then q.nm else q.mask end, 'at', q.at, 'me', q.me) order by q.rk)
    from (
      select row_number() over (order by (x.detail #>> '{rooms,7,at}')::timestamptz, x.id) as rk,
             st.name as nm, st.id = s.id as me, x.detail #>> '{rooms,7,at}' as at,
             case when char_length(st.name) <= 1 then st.name
                  when char_length(st.name) = 2 then left(st.name, 1) || '*'
                  else left(st.name, 1) || repeat('*', char_length(st.name) - 2) || right(st.name, 1) end as mask
        from public.land_records x
        join public.land_students st on st.id = x.student_id
       where x.run_id = r.id
         and st.grade = s.grade and st.class_no = s.class_no and st.status = 'active'
         and x.detail #>> '{rooms,7,solved}' = 'true'
         and coalesce(x.detail #>> '{rooms,7,at}', '') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
    ) q), '[]'::json));
end $$;

revoke all on function public.land_fe_rank(text, bigint) from public;
grant execute on function public.land_fe_rank(text, bigint) to anon, authenticated;

-- 활동 버전 2.1: 저택 스토리·방 7개·탈출 순위
update public.land_activities set current_version = '2.1', updated_at = now() where slug = 'factor-escape';
insert into public.land_activity_versions (activity_slug, version, changes) values
  ('factor-escape', '2.1', '저택 스토리(200년 전 이야기·초대장·저택 지도·문 장면), 방 7개(방7 금고실 = 오늘의 비밀, 단계별 힌트), 방6 풀이 사진, 정원에서 우리 반 탈출 순위(이름 가림)')
on conflict do nothing;
