/**
 * 클럽라이선싱 통합 플랫폼 — 구단 문의 접수용 Google Apps Script
 *
 * 하는 일
 *  - FAQ 페이지의 '질문하기'에서 보낸 문의를 이 스프레드시트의 '문의' 시트에 한 줄씩 저장
 *  - 관리자 화면(admin.html)이 관리자 키로 문의 목록을 불러오고, 처리 상태를 바꿈
 *  - 첨부파일(선택)은 구글 드라이브 '구단 문의 첨부파일' 폴더에 저장하고, 시트에는 링크를 남김
 *    (파일은 이 계정만 볼 수 있게 비공개로 저장됨)
 *
 * 설치 방법은 사이트 폴더의 운영가이드.md '10. 구단 문의 접수 설정'을 따라 주세요.
 * 관리자 키는 [프로젝트 설정 → 스크립트 속성]에 ADMIN_KEY 로 저장합니다(코드에 적지 않음).
 */
const SHEET_NAME = '문의';
const HEADERS = ['id', '접수일시', '구단', '부서', '이름', '직급', '이메일', '문의내용', '상태', '답변 FAQ', '처리일시', '메모', '첨부파일'];
const FIELDS = ['club', 'dept', 'name', 'position', 'email', 'question'];
const LABELS = { club: '구단', dept: '부서', name: '이름', position: '직급', email: '이메일 주소', question: '문의 내용' };
const MAX_LEN = { question: 3000 };

// 첨부파일 조건 (사이트 화면의 안내와 같게 유지)
const FILE_FOLDER_NAME = '구단 문의 첨부파일';
const FILE_MAX_COUNT = 3;
const FILE_MAX_TOTAL = 10 * 1024 * 1024;   // 합계 10MB
const FILE_EXT = ['pdf', 'xls', 'xlsx', 'hwp', 'hwpx', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'heic'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < HEADERS.length) {
    // 예전 버전으로 만든 시트에는 '첨부파일' 제목이 없으므로 맨 오른쪽에 추가
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 시트 수식으로 해석되지 않도록 = + - @ 로 시작하는 값 앞에 ' 를 붙임
function clean_(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

// 첨부파일 검사: 문제가 있으면 오류 문장, 없으면 '' 를 돌려줌
function checkFiles_(files) {
  if (!files) return '';
  if (!Array.isArray(files)) return '첨부파일 형식이 올바르지 않습니다.';
  if (files.length > FILE_MAX_COUNT) return '첨부파일은 ' + FILE_MAX_COUNT + '개까지 올릴 수 있습니다.';
  let total = 0;
  for (const f of files) {
    const ext = String(f && f.name || '').split('.').pop().toLowerCase();
    if (!f || !f.name || !f.data || FILE_EXT.indexOf(ext) < 0) return '올릴 수 없는 파일 형식입니다: ' + (f && f.name || '');
    total += Math.floor(String(f.data).length * 3 / 4);
  }
  if (total > FILE_MAX_TOTAL) return '첨부파일은 합계 10MB까지 올릴 수 있습니다.';
  return '';
}

function fileFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FILE_FOLDER_ID');
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (err) { /* 폴더가 지워졌으면 새로 만듦 */ }
  }
  const folder = DriveApp.createFolder(FILE_FOLDER_NAME);
  props.setProperty('FILE_FOLDER_ID', folder.getId());
  return folder;
}

// 파일을 드라이브에 저장하고 '파일이름 | 링크' 줄 목록을 돌려줌
function saveFiles_(files, inquiryId, club) {
  if (!files || !files.length) return '';
  const folder = fileFolder_();
  return files.map(f => {
    const safe = String(f.name).replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 120);
    const bytes = Utilities.base64Decode(String(f.data));
    const blob = Utilities.newBlob(bytes, f.type || 'application/octet-stream', inquiryId + '_' + safe);
    const file = folder.createFile(blob);
    file.setDescription('구단 문의 ' + inquiryId + ' · ' + club);
    return safe + ' | ' + file.getUrl();
  }).join('\n');
}

function isAdmin_(key) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!real && key === real;
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: '요청 형식이 올바르지 않습니다.' }); }

  // 1) 구단 문의 접수 (누구나)
  if (d.action === 'submit') {
    if (d.website) return json_({ ok: true });             // 스팸 방지용 숨은 칸이 채워졌으면 무시
    for (const k of FIELDS) {
      if (!d[k] || !String(d[k]).trim()) return json_({ ok: false, error: '빈 칸이 있습니다: ' + LABELS[k] });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email).trim())) return json_({ ok: false, error: '이메일 주소를 확인해 주세요.' });
    if (d.agree !== true) return json_({ ok: false, error: '개인정보 수집·이용에 동의해 주세요.' });
    const fileErr = checkFiles_(d.files);
    if (fileErr) return json_({ ok: false, error: fileErr });
    const id = Utilities.getUuid().slice(0, 8);
    let fileCell = '';
    try { fileCell = saveFiles_(d.files, id, clean_(d.club)); }
    catch (err) { return json_({ ok: false, error: '첨부파일을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }); }
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sheet_().appendRow([id, new Date()].concat(FIELDS.map(k => clean_(d[k], MAX_LEN[k]))).concat(['접수', '', '', '', fileCell]));
      return json_({ ok: true, id: id });
    } finally {
      lock.releaseLock();
    }
  }

  // 2) 이하 관리자 전용
  if (!isAdmin_(d.key)) return json_({ ok: false, error: '관리자 키가 맞지 않습니다.' });

  if (d.action === 'list') {
    const values = sheet_().getDataRange().getValues();
    const items = values.slice(1).map(r => ({
      id: r[0], at: r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : String(r[1]),
      club: r[2], dept: r[3], name: r[4], position: r[5], email: r[6], question: r[7],
      status: r[8] || '접수', faq_id: r[9], done_at: r[10] instanceof Date ? Utilities.formatDate(r[10], 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : String(r[10] || ''), memo: r[11],
      files: String(r[12] || '').split('\n').filter(Boolean).map(line => {
        const i = line.lastIndexOf(' | ');
        return i < 0 ? { name: line, url: '' } : { name: line.slice(0, i), url: line.slice(i + 3) };
      })
    })).reverse();
    return json_({ ok: true, items: items });
  }

  if (d.action === 'update') {
    const sh = sheet_();
    const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(r => String(r[0]));
    const i = ids.indexOf(String(d.id));
    if (i < 0) return json_({ ok: false, error: '문의를 찾을 수 없습니다.' });
    const row = i + 2;
    if (d.status) sh.getRange(row, 9).setValue(clean_(d.status));
    if (d.faq_id !== undefined) sh.getRange(row, 10).setValue(clean_(d.faq_id));
    if (d.memo !== undefined) sh.getRange(row, 12).setValue(clean_(d.memo, 1000));
    sh.getRange(row, 11).setValue(new Date());
    return json_({ ok: true });
  }

  return json_({ ok: false, error: '알 수 없는 요청입니다.' });
}

// 처음 한 번 편집기에서 직접 실행: 드라이브 권한을 승인하고 첨부파일 폴더를 만듦
function setupFiles() {
  const folder = fileFolder_();
  sheet_();
  Logger.log('첨부파일 폴더 준비 완료: ' + folder.getName() + ' → ' + folder.getUrl());
}

// 주소를 브라우저로 열었을 때 동작 확인용
function doGet() {
  return json_({ ok: true, message: '클럽라이선싱 문의 접수 서버가 작동 중입니다.' });
}
