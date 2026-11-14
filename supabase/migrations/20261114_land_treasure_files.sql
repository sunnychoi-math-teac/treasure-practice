-- Math Land Explorers · 보물을 찾아라 옮기기 (2단계 ②)  — 실행 완료(2026-11-14)
-- 1) 연습 버전을 따로 된 활동(treasure-practice)으로 등록
-- 2) 학생 그림·PDF 보관함 land-files (비공개). 학생은 서버 작업 land-upload(supabase/functions/land-upload)로만 올리고,
--    선생님 계정(teachers 표)만 볼 수 있음
-- 기존 표·함수는 바꾸지 않습니다.

insert into public.land_activities (slug, title, summary, grade_group, grade_label, unit, mode, mode_label, status,
                                    entry_url, art, theme, keywords, due_text, sort_order, current_version)
values ('treasure-practice', '보물을 찾아라 (연습)', '수행평가 전에 연습 문제로 일곱 개의 미션을 미리 풀어 봐요.',
        'high', '고1 공통수학', '도형의 방정식', 'class', '연습', 'open',
        'activities/treasure-practice/', 'treasure', '#E3F1E6',
        '보물 연습 도형의 방정식 원 직선 고1 공통수학 고등학교 미션', null, 11, '2.0')
on conflict (slug) do nothing;

update public.land_activities set current_version = '2.0', entry_url = 'activities/treasure/', updated_at = now()
 where slug = 'treasure';

insert into public.land_activity_versions (activity_slug, version, changes) values
  ('treasure', '2.0', '구글 앱스 스크립트에서 수학나라로 옮김: 공통 로그인·저장, 그림·PDF는 Supabase 보관함, 제출하면 PDF 자동 생성'),
  ('treasure-practice', '2.0', '연습 버전을 수학나라로 옮김(미션3 별 3개·x축 방향 이동, 미션4 돌 2개·거리 조건 없음). PDF 없이 제출 기록만')
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('land-files', 'land-files', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf', 'application/json'])
on conflict (id) do nothing;

create policy "land-files: teachers read" on storage.objects for select to authenticated
  using (bucket_id = 'land-files' and (select private.is_teacher()));

-- 서버 작업 land-upload 가 올리기 전에 학생·운영(마감·기한·대상 반)을 확인 (service_role 만 실행)
create or replace function public.land_file_check(p_token text, p_run_id bigint)
returns json language plpgsql security definer set search_path = '' as $$
declare
  s public.land_students := private.land_student_of(p_token);
  r public.land_runs;
  v_state text;
begin
  if s.id is null then return json_build_object('ok', false, 'code', 'no_session'); end if;
  select * into r from public.land_runs where id = p_run_id;
  if r.id is null then return json_build_object('ok', false, 'code', 'no_run'); end if;
  v_state := private.land_run_state(r, s);
  if v_state <> 'ok' then return json_build_object('ok', false, 'code', v_state); end if;
  return json_build_object('ok', true, 'slug', r.activity_slug, 'year', r.school_year, 'run_id', r.id,
                           'no', s.student_no, 'student_id', s.id);
end $$;
revoke all on function public.land_file_check(text, bigint) from public, anon, authenticated;
grant execute on function public.land_file_check(text, bigint) to service_role;
