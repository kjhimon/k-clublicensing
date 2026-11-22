/* K리그 클럽라이선싱 OJT — 공통 스크립트
 * 데이터는 data/*.json 에서 읽습니다. 화면 문구를 바꾸려면 JSON 파일을 고치세요(운영가이드.md 참고).
 */
const OJT = (() => {
  const cache = {};

  async function load(name) {
    if (cache[name]) return cache[name];
    const res = await fetch(`data/${name}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`data/${name}.json (${res.status})`);
    cache[name] = await res.json();
    return cache[name];
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // "F.01" → "F-01" (주소창 #F-01 용)
  const anchor = code => code.replace('.', '-');
  // "F.01" → "F01" (양식 위치 #form-F01 용)
  const compact = code => code.replace('.', '');

  // 사용자가 입력한 코드를 표준형으로: f01, F-01, F 1, F.1 → F.01
  function normalizeCode(input) {
    const m = String(input || '').trim().toUpperCase().match(/^([SIPLFMR])\s*[.\-_ ]?\s*(\d{1,2})$/);
    if (!m) return null;
    return `${m[1]}.${m[2].padStart(2, '0')}`;
  }

  const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚';
  const circledToNum = c => CIRCLED.indexOf(c) + 1;

  function gradeBadge(g, label) {
    if (!g) return '<span class="muted">-</span>';
    const t = label ? `${label} ${g}등급` : `${g}등급`;
    return `<span class="grade grade-${esc(g)}" title="${esc(t)}" aria-label="${esc(t)}">${esc(g)}</span>`;
  }

  // 오늘 날짜 (테스트용으로 ?date=2026-04-15 를 붙이면 그 날짜로 계산)
  function today() {
    const q = new URLSearchParams(location.search).get('date');
    const d = q ? new Date(q + 'T00:00:00') : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const toDate = s => new Date(s + 'T00:00:00');
  const lastDeadline = c => (c.deadlines && c.deadlines.length) ? c.deadlines[c.deadlines.length - 1].date : null;
  const firstDeadline = c => (c.deadlines && c.deadlines.length) ? c.deadlines[0].date : null;

  function pending(text = '연맹 작성 예정') {
    return `<span class="pending">${esc(text)}</span>`;
  }

  function statusChip(status) {
    if (!status) return '';
    if (status === '확인됨') return '<span class="chip chip-ok">근거 확인됨</span>';
    if (status === '연맹 답변') return '<span class="chip chip-ok">연맹 답변</span>';
    if (status === '연맹 안내') return '<span class="chip chip-ok">연맹 안내</span>';
    return `<span class="chip chip-warn">${esc(status)}</span>`;
  }

  function showError(el, err) {
    const isFile = location.protocol === 'file:';
    el.innerHTML = `<div class="error-box"><strong>데이터를 불러오지 못했습니다.</strong><br>
      ${isFile ? '파일을 더블클릭해서 열면 브라우저 보안 때문에 데이터가 보이지 않습니다. GitHub Pages 등에 올린 주소로 열거나, 운영가이드.md의 「내 PC에서 미리 보기」를 따라 주세요.' : esc(err.message)}</div>`;
  }

  async function initChrome() {
    try {
      const site = await load('site');
      document.querySelectorAll('[data-updated]').forEach(el => { el.textContent = site.last_updated; });
      document.querySelectorAll('[data-year]').forEach(el => { el.textContent = site.license_year; });
    } catch (e) { /* 상단 날짜만 비게 됨 */ }
    const page = document.body.dataset.page;
    document.querySelectorAll('.nav a').forEach(a => {
      if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
    });
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove('highlight');
    void el.offsetWidth;
    el.classList.add('highlight');
  }

  async function copy(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* 무시 */ }
      ta.remove();
    }
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '복사됨 ✓';
      setTimeout(() => { btn.textContent = old; }, 1500);
    }
  }

  const pageUrl = (file, hash) => new URL(file + (hash ? '#' + hash : ''), location.href).href;

  document.addEventListener('DOMContentLoaded', initChrome);

  return { load, esc, anchor, compact, normalizeCode, circledToNum, gradeBadge, today, toDate, lastDeadline, firstDeadline, pending, statusChip, showError, flash, copy, pageUrl };
})();
