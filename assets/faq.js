/* FAQ 페이지: 분류, 키워드 검색, #faq-id 바로가기, 문의 버튼 */
(async () => {
  const { load, esc, normalizeCode, statusChip, showError, flash } = OJT;
  const listEl = document.getElementById('faq-list');
  let site, faqData, crit;
  try {
    [site, faqData, crit] = await Promise.all([load('site'), load('faq'), load('criteria')]);
  } catch (e) {
    showError(listEl, e);
    return;
  }
  const faqs = faqData.faqs;
  // 근거 링크는 매뉴얼 PDF의 해당 쪽으로 연결
  const manual = site.library.find(l => l.current && l.file && l.type === '매뉴얼');
  const critPage = Object.fromEntries(crit.criteria.map(c => [c.code, c.page]));
  const manualHref = page => manual ? `${manual.file}#page=${page}` : '';
  const cats = [{ code: 'all', name: '전체' }, { code: '공통', name: '공통 (CLAS·일정·언어)' }, ...site.areas.map(a => ({ code: a.code, name: `${a.name} ${a.code}` }))];
  const state = { cat: 'all', q: '' };

  // 분류 탭은 없앴음(검색창만 사용). 검색하면 '질문 & 답변' 구역이 자동으로 열림
  const qaZone = document.getElementById('qa-zone');
  document.getElementById('faq-search').addEventListener('input', ev => {
    state.q = ev.target.value.trim(); render();
    if (state.q && qaZone) qaZone.open = true;
  });

  function refs(f) {
    const list = (f.manual_refs || []).filter(r => r.page);
    const tagOnly = (f.tags || []).filter(t => critPage[t] && !list.some(r => r.page === critPage[t]));
    if (!manual || (!list.length && !tagOnly.length)) return '';
    return `<div class="actions" style="margin-top:6px">${list.map(r =>
      `<a class="btn btn-sm" href="${esc(manualHref(r.page))}" target="_blank" rel="noopener">${esc(r.label)} · p.${r.page} →</a>`).join('')}${tagOnly.map(t =>
      `<a class="btn btn-sm" href="${esc(manualHref(critPage[t]))}" target="_blank" rel="noopener">${esc(t)} 기준 · p.${critPage[t]} →</a>`).join('')}</div>
      <p class="small muted" style="margin-top:6px">${esc(manual.title)} (${esc(manual.version || manual.year)}) PDF가 새 창에서 해당 쪽으로 열립니다.</p>`;
  }

  function item(f) {
    const r = refs(f);
    return `<details class="faq-item" id="${esc(f.id)}">
      <summary><span class="q">Q.</span><span>${esc(f.q)}</span></summary>
      <div class="faq-body">
        <span class="label">답변 ${statusChip(f.status)}</span>
        <p class="conclusion">${esc(f.a)}</p>
        ${f.detail ? `<p class="pre">${esc(f.detail)}</p>` : ''}
        ${f.tags && f.tags.length ? `<span class="label">관련 기준</span><p>${f.tags.map(t => `<span class="chip">${esc(t)}</span>`).join(' ')}</p>` : ''}
        ${r ? `<span class="label">매뉴얼 원문에서 확인</span>${r}` : ''}
      </div>
    </details>`;
  }

  function matches(f) {
    if (state.cat !== 'all' && f.category !== state.cat) return false;
    if (!state.q) return true;
    const code = normalizeCode(state.q);
    if (code) return (f.tags || []).includes(code);
    const hay = [f.q, f.a, f.detail || '', f.basis, ...(f.tags || [])].join(' ').toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every(w => hay.includes(w));
  }

  function render() {
    const list = faqs.filter(matches);
    document.getElementById('faq-count').textContent = `${list.length}개 질문`;
    listEl.innerHTML = list.length ? list.map(item).join('') : '<p class="muted">검색 결과가 없습니다. 아래 "질문하기"로 문의해 주세요.</p>';
  }

  // 질문하기: 입력한 문의를 Google Apps Script(관리자 시트)로 보냄 — site.json의 inquiry.endpoint
  const inq = site.inquiry || {};
  const pv = inq.privacy || {};
  document.getElementById('ask-privacy').innerHTML = `<strong>개인정보 수집·이용 안내</strong><br>
    수집 항목: ${esc(pv.items || '')}<br>이용 목적: ${esc(pv.purpose || '')}<br>보유 기간: ${esc(pv.retention || '')}<br>${esc(pv.note || '')}`;
  const form = document.getElementById('ask-form');
  const msg = document.getElementById('ask-msg');
  const submitBtn = document.getElementById('ask-submit');
  if (!inq.endpoint) {
    msg.textContent = '문의 접수 기능은 준비 중입니다. (관리자 설정 후 사용할 수 있습니다)';
    submitBtn.disabled = true;
  }
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const val = id => document.getElementById(id).value.trim();
    const data = { action: 'submit', club: val('ask-club'), name: val('ask-name'), dept: val('ask-dept'), position: val('ask-position'),
      email: val('ask-email'), question: val('ask-question'), website: val('ask-website'), agree: document.getElementById('ask-agree').checked };
    const missing = [['club', '구단'], ['name', '이름'], ['dept', '부서'], ['position', '직급'], ['email', '이메일 주소'], ['question', '문의 내용']].filter(([k]) => !data[k]).map(([, l]) => l);
    if (missing.length) { msg.textContent = `다음 칸을 채워 주세요: ${missing.join(', ')}`; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { msg.textContent = '이메일 주소 형식을 확인해 주세요.'; return; }
    if (!data.agree) { msg.textContent = '개인정보 수집·이용에 동의해 주세요.'; return; }
    if (!inq.endpoint) return;
    submitBtn.disabled = true; msg.textContent = '보내는 중…';
    try {
      // text/plain 으로 보내야 Apps Script가 추가 확인 요청 없이 받음
      const res = await fetch(inq.endpoint, { method: 'POST', body: JSON.stringify(data) });
      const out = await res.json();
      if (!out.ok) throw new Error(out.error || '접수에 실패했습니다.');
      form.innerHTML = `<p class="ask-ok">문의가 접수되었습니다. 입력하신 이메일(${esc(data.email)})로 답변드리겠습니다.</p>`;
    } catch (e) {
      msg.textContent = `접수하지 못했습니다: ${e.message} 잠시 뒤 다시 시도해 주세요.`;
      submitBtn.disabled = false;
    }
  });

  render();
  function openHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    let el = document.getElementById(id);
    if (!el) { state.cat = 'all'; state.q = ''; document.getElementById('faq-search').value = ''; render(); el = document.getElementById(id); }
    if (!el || !el.matches('details')) return;
    // 바로가기로 들어오면 그 질문을 감싼 구역(질문 & 답변)까지 함께 펼침
    for (let d = el; d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
    requestAnimationFrame(() => { el.scrollIntoView({ block: 'start' }); flash(el); });
  }
  window.addEventListener('hashchange', openHash);
  openHash();
})();
