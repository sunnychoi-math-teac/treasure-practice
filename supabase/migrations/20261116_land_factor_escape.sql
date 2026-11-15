-- Math Land Explorers · FACTOR ESCAPE — 소피 제르맹의 비밀 (인수분해 방탈출) 등록  — 실행 완료(2026-11-16)
-- 새 표·함수는 만들지 않고, 활동 목록에 한 줄 + 버전 기록 한 줄만 더합니다.
-- 학생 로그인·저장은 공통 함수(land_enter, land_save), 풀이 사진은 기존 서버 작업 land-upload(m4.jpg·m5.jpg 이름)를 그대로 씁니다.

insert into public.land_activities (slug, title, summary, grade_group, grade_label, unit, mode, mode_label, status,
                                    entry_url, art, theme, keywords, due_text, sort_order, current_version)
values ('factor-escape', 'FACTOR ESCAPE · 소피 제르맹의 비밀', '소피 제르맹의 흔적을 따라 인수분해로 잠긴 여섯 개의 방을 탈출해요.',
        'high', '고1 공통수학1', '다항식의 인수분해', 'class', '수업', 'open',
        'activities/factor-escape/', 'escape', '#1C2547',
        '방탈출 인수분해 소피 제르맹 소인수분해 다항식 고1 공통수학 고등학교 수업', null, 15, '2.0')
on conflict (slug) do nothing;

insert into public.land_activity_versions (activity_slug, version, changes) values
  ('factor-escape', '2.0', '구글 앱스 스크립트 버전을 수학나라로 옮김: 공통 로그인·저장·이어하기, 선수학습 선 잇기(30초 지나도 계속), 방1 4지선다, 방2 문구 수정, 방3 그림 크게, 연구실 화면 삭제, 방4·5 수식 입력 + 풀이 사진, 방6 힌트 크게, 오답 두 번 세기 고침, 정리·소감 화면 정리, 교사 현황판')
on conflict do nothing;
