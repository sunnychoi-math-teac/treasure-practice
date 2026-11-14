# 진행 상태 (current_status)

마지막 갱신: 2026-11-15 (새벽)

## 완료한 것
- **무리수 사냥: 경남이의 정글 탈출**(중3 제곱근과 실수): `jungle-run.html`, `jungle-run-teacher.html`. 3줄 러너, 로그인(학번 4자리·이름·비번 4자리), 랭킹, 훈련소(오답 5유형), 천천히 모드, 교사 현황판(탐험가 성취, CSV), Supabase 표 runner_* 와 함수
- **보물을 찾아라**(고1 도형의 방정식): 구글 앱스 스크립트 웹 앱. 수행평가용(미션 1~7, 테셀레이션, 8단계 채점, 반별 마감, 학생별·반별 PDF)과 연습용(별도 프로젝트)
- **Supabase 주간 깨우기** 예약 작업(매주 월 07:41, 서울)
- **통합 기획**(2026-11-11): 인터뷰 8문항 → 기획안 문서. 학년도 → 수업 → 운영 → 기록 구조, GitHub + Supabase로 통일
- **결정 사항**(2026-11-11~13):
  - 학생 명단을 미리 올리지 않음. 첫 접속 때 학생이 직접 등록
  - 저장소는 새로 만들지 않고 지금 것을 이어서 씀. 이름만 바꿈
  - Supabase는 math-treasure 하나에 공통 표를 더함
  - 학생 입구에는 열린 활동과 지금까지 한 활동을 모두 보여 줌
  - 세특 근거용 「학생 한 명 모아 보기」 만들기
  - 기록은 선생님이 원할 때만 지움. 공유·연수는 보류
  - 교사 홈에 모든 활동을 한 화면에 모음. 활동마다 주소로 공유
  - 현황판은 활동별로 두고 학년도를 골라 봄
  - 「자유 도전」 모드: 기한을 정해 두고 평상시에 자유롭게 하는 게임식 운영

- **첫 화면(index.html) v1** (2026-11-13): 앱 이름 Math Land Explorers(영문만). 디자인 C안 — 연보라 하늘에 고등학교 수학 구슬(∫ Σ π log lim sin θ ∞)이 굴러와 쌓이는 모션 + 검색창 + 왼쪽 분류 메뉴(전체/고등학교/중학교 복습/수행평가/자유 도전/준비 중) + 카드. 검색어·분류는 주소(?q=&cat=)에 남아 링크로 나눠 줄 수 있음. 글꼴 Baloo 2 + IBM Plex Sans KR. 「움직임 줄이기」 설정이면 움직임 없이 완성 화면. 디자인 시안 캔버스: https://claude.ai/artifact/6tsejeJbn5JtPwGp2QJ6v8
- 예전 index.html(보물 기록장 연습 예제)은 삭제함(선생님 결정). practice_records 표는 그대로 둠

- **1단계 ① 공통 틀** (2026-11-14):
  - Supabase 표 `land_students`(학년도별 학생, 학번 4자리) · `land_sessions`(하루짜리 로그인 표) · `land_runs`(운영: 학년도·버전·모드·기한·대상 반·반별 마감·열림/마감) · `land_records`(기록: 공통 칸 + detail JSON) · `land_activity_versions`. SQL: `supabase/migrations/20261114_land_core.sql` (실행 완료)
  - 학생 함수: land_login, land_logout, land_enter, land_save, land_my_records / 교사 함수: land_t_* (teachers 표 계정만)
  - `common/land.js`: 학생 로그인 창, Land.start(활동 들어가기·마감 안내), Land.saver(4초 모아 저장·자동 재시도·제출), 교사 로그인(Land.teacherGate)
  - `teacher/index.html` 활동 모음(반에 열기·운영 설정·반별 마감·전체 마감·주소 복사·카드 정보), `teacher/board.html?slug=` 활동별 현황판 틀(학년도·운영·반 고르기, 반별 요약, 진행 현황, 기록 자세히, CSV), `teacher/students.html` 학생 관리(비번 초기화·고치기·전출)
  - 첫 화면 [선생님] 버튼 → `teacher/` 로 연결. 옛 `teacher.html`(보물 기록장 현황판)은 그대로 둠
  - `.gitignore`: 학생 기록 폴더·엑셀·CSV는 GitHub에 올라가지 않게 막음(학생 기록은 Supabase에만)

- **2단계 ② 보물을 찾아라 옮기기** (2026-11-14 밤):
  - 선생님 결정: 연습용·수행평가용을 **활동 두 개로 따로** 둠(문제 선택 기능은 만들지 않음)
    - `activities/treasure/` = 「보물을 찾아라」(수행평가 문제, slug `treasure`, v2.0) — 제출하면 **PDF 자동 생성**
    - `activities/treasure-practice/` = 「보물을 찾아라 (연습)」(연습 문제, slug `treasure-practice`, v2.0) — PDF 없이 제출 기록만. 그림은 `../treasure/img/` 같이 씀
  - 원본: 선생님이 보낸 앱스 스크립트 최신 코드(`treasure_src/`, GitHub에 안 올림). 미션·그래프·수식 자판·테셀레이션 코드는 그대로, 바뀐 곳은 로그인(Land.start)·저장(Land.saver)·그림 올리기·제출뿐
  - 첫 화면 그림·큰 보물상자 그림은 HTML에서 꺼내 `activities/treasure/img/title_cover.webp`, `chest_open.webp`로
  - 점수: 수행평가 `score`=환산 점수, `level`=「상-(49)」. 연습 `score`=해결 수, `level`=「n/7 해결」. `summary`=소감. 진행 내용은 `detail`(테셀레이션 선은 `detail.tessData`)
  - Supabase(실행 완료): 활동 `treasure-practice` 등록, 비공개 보관함 **`land-files`**(선생님 계정만 보기), 확인 함수 `land_file_check`(service_role만), 서버 작업(Edge Function) **`land-upload`**(학생 그림·PDF 올리기 + 자기 파일 10분 주소). 파일 위치 `<slug>/<학년도>/run<운영>/<학번>/m1.jpg · tess.png · report.pdf`. SQL `supabase/migrations/20261114_land_treasure_files.sql`, 코드 `supabase/functions/land-upload/index.ts`
  - 시험(Playwright, 시험 학생 3999·3학년 9반만 대상 운영): 로그인·이어하기·저장·미션 완성 화면 자동 저장·실제 미션3 풀이·PDF(3쪽) 생성·업로드·연습 제출·반 마감 안내·「내 기록 보기」 모두 확인

- **2단계 ③ 보물 교사 현황판** (2026-11-15):
  - `activities/treasure/teacher.html` (수행평가) · `activities/treasure/teacher.html?slug=treasure-practice` (연습, `activities/treasure-practice/teacher.html`이 여기로 보냄). 교사 홈 활동 카드에 「보물을 찾아라 현황판」 버튼 추가
  - 예전 앱스 스크립트 현황판 기능 그대로: 학년도·운영 고르기, 반별 보기(반 칩)·반별 요약표, 진행 현황(미션 1~7 ✓/✗·오답 수, 참고 수준(점수), 테셀레이션, 마지막 저장, PDF), 학생 자세히, 미션 완성 화면(미션별), 테셀레이션 작품 보기, 소감 모아 보기(이해도·만족 막대, 소감 복사), PDF 열기·다시 만들기(학생 1명 / 반 전체), 반 마감·풀기(두 번 눌러 확인), 비번 초기화. 30초마다 자동 새로 고침
  - 기록은 land_t_records + land_t_record_detail(저장 시각이 바뀐 기록만 다시 불러옴). 그림·PDF는 선생님 계정으로 10분짜리 주소를 만들어 봄
  - PDF 다시 만들기는 학생 화면과 같은 모양으로 선생님 브라우저에서 만들어 보관함에 덮어씀. 연습용은 PDF 없음(제출 시각만)
  - Supabase(선생님 허락 받고 실행): 보관함 land-files 에 선생님 계정의 `…/report.pdf` 올리기·덮어쓰기 권한. SQL `supabase/migrations/20261115_land_files_teacher_report.sql`
  - 시험: 가짜 자료로 화면·버튼 동작 확인(진행 현황·자세히·PDF 만들기·비번 초기화·반 마감·미션 화면·테셀레이션·소감). **실제 선생님 계정으로는 GitHub에 올린 뒤 확인 필요**

## 진행 중
- **Supabase 표 land_activities + 함수 land_list_activities()**: SQL 파일 `supabase/migrations/20261113_land_activities.sql` 작성 완료. 아직 실행 전. 실행 전까지 첫 화면은 코드 안의 기본 목록 3개를 보여 줌(「서버와 연결되지 않아 기본 목록을 보여 주고 있어요」 문구)
- 첫 화면에서 아직 비어 있는 것: 보물을 찾아라 입장 주소(entry_url, 앱스 스크립트 웹 앱 주소), 마감 날짜·도전 기한 글자(due_text), [내 기록 보기] 링크(공통 로그인 뒤 연결)

## 다음 단계
- 보물 ④ 2026 기록 옮기기(드라이브 내보내기 폴더 → Supabase) ⑤ 30명 동시 접속 시험

## 예전 1단계 목록 (참고)
1. 미결정 사항 정하기(아래)
2. Supabase 공통 표(land_*): land_activities는 SQL 준비됨 → 실행. 이어서 land_students·land_runs·land_records와 로그인·저장·운영 함수 설계 → 선생님 확인 후 만들기
3. `common/` 공통 코드: 로그인, 운영 상태·기한 확인, 기록 저장
4. 교사 홈(활동 카드 목록, 주소 복사, 운영 설정)
5. 활동별 현황판 공통 틀(학년도 선택, 반별 보기, 진행 현황)
6. 무리수 사냥을 공통 로그인·기록에 연결. 옛 주소 `jungle-run.html` 유지 또는 이동 안내
7. 저장소 이름 바꾸고 새 주소 안내

## 미결정 이슈
- 저장소 새 이름
- 1단계 시작 시기(제안: 2026 겨울방학)
- 화면 세부: 같은 활동을 한 해에 여러 번 열 때 표시 (카드 모양·학생 입구 꾸밈은 첫 화면 v1로 정함)
- 제목 글꼴 최종 선택(지금 Baloo 2; 후보 Lilita One, Luckiest Guy, Bungee, Fredoka, Titan One)
- 무리수 사냥 기존 기록(runner_*)을 공통 기록으로 옮길지, 그대로 둘지
