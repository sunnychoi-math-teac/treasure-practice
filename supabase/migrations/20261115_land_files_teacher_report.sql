-- Math Land Explorers · 보물 현황판 ③ — 실행 완료(2026-11-15)
-- 선생님 계정(teachers 표)이 현황판에서 다시 만든 보고서 PDF(…/report.pdf)만 보관함 land-files 에 올리기·덮어쓰기
-- 학생 권한·다른 파일·다른 표는 바꾸지 않습니다.
create policy "land-files: teachers write report" on storage.objects for insert to authenticated
  with check (bucket_id = 'land-files' and name like '%/report.pdf' and (select private.is_teacher()));
create policy "land-files: teachers update report" on storage.objects for update to authenticated
  using (bucket_id = 'land-files' and name like '%/report.pdf' and (select private.is_teacher()))
  with check (bucket_id = 'land-files' and name like '%/report.pdf' and (select private.is_teacher()));
