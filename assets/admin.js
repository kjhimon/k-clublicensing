/* 관리자 화면
 * 0) 구단 문의함: FAQ '질문하기'로 들어온 문의를 Google Apps Script(관리자 시트)에서 불러와 답변을 작성
 * 1~3) FAQ 편집: faq.json을 편집하고 새 파일을 만들어 줌. FAQ 편집 내용은 이 브라우저에만 임시 저장됨 */
(async () => {
  const { load, esc, normalizeCode, showError, copy } = OJT;
  const DRAFT_KEY = 'ojt-faq-draft-v2';
  const listEl = document.getElementById('a-list');
  let site, original;
  try {
    [site, original] = await Promise.all([load('site'), load('faq')]);
  } catch (e) {
    showError(listEl, e);
    return;
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  let data = clone(original);
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved && saved !== JSON.stringify(original)) { data = JSON.parse(saved); setTimeout(() => { document.getElementById('f-msg').textContent = '이 브라우저에 임시 저장된 편집 내용을 불러왔습니다. 처음부터 하려면 ①의 "사이트 원본으로 되돌리기"를 누르세요.'; }); }
  } catch (e) { /* 임시 저장을 못 쓰는 브라우저 */ }
  let editing = null;
  let fromInquiry = null;   // 문의함에서 '답변 작성'으로 연 문의

  const cats = [{ code: '공통', name: '공통 (CLAS·일정·언어)' }, ...site.areas.map(a => ({ code: a.code, name: `${a.code} ${a.name}` }))];
  const catSel = document.getElementById('f-category');
  catSel.innerHTML = cats.map(c => `<option value="${esc(c.code)}">${esc(c.name)}</option>`).join('');
  const $ = id => document.getElementById(id);

  function persist() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) { /* 무시 */ }
    $('out').value = JSON.stringify(data, null, 2);
  }

  function renderList() {
    $('a-count').textContent = `${data.faqs.length}개`;
    listEl.innerHTML = data.faqs.map((f, i) => `<div class="row">
        <div><span class="chip">${esc(f.category)}</span> <strong>${esc(f.q)}</strong>
          <div class="small muted">${esc(f.a)}</div></div>
        <div class="actions" style="margin:0">
          <button type="button" class="btn btn-sm" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="위로">↑</button>
          <button type="button" class="btn btn-sm" data-act="down" data-i="${i}" ${i === data.faqs.length - 1 ? 'disabled' : ''} aria-label="아래로">↓</button>
          <button type="button" class="btn btn-sm" data-act="edit" data-i="${i}">수정</button>
          <button type="button" class="btn btn-sm" data-act="del" data-i="${i}">삭제</button>
        </div>
      </div>`).join('') || '<p class="muted">Q&A가 없습니다.</p>';
    persist();
  }

  function clearForm() {
    editing = null;
    fromInquiry = null;
    $('a-form').reset();
    $('a-mode').textContent = '새 질문';
    $('f-submit').textContent = '목록에 추가';
    $('f-msg').textContent = '';
  }

  function fillForm(i) {
    const f = data.faqs[i];
    editing = i;
    catSel.value = f.category;
    $('f-q').value = f.q; $('f-a').value = f.a; $('f-detail').value = f.detail || ''; $('f-basis').value = f.basis;
    $('f-status').value = f.status || '연맹 답변';
    $('f-tags').value = (f.tags || []).join(', ');
    $('f-links').value = (f.manual_refs || []).map(r => `${r.label} | ${r.page}`).join('\n');
    $('a-mode').textContent = `수정 중: ${f.q}`;
    $('f-submit').textContent = '수정 내용 저장';
    $('a-form').scrollIntoView({ block: 'start' });
  }

  listEl.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    const i = Number(b.dataset.i);
    const act = b.dataset.act;
    if (act === 'edit') return fillForm(i);
    if (act === 'del') {
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = '정말 삭제'; return; }
      data.faqs.splice(i, 1);
      if (editing === i) clearForm();
    }
    if (act === 'up' && i > 0) [data.faqs[i - 1], data.faqs[i]] = [data.faqs[i], data.faqs[i - 1]];
    if (act === 'down' && i < data.faqs.length - 1) [data.faqs[i + 1], data.faqs[i]] = [data.faqs[i], data.faqs[i + 1]];
    renderList();
  });

  $('a-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const tags = $('f-tags').value.split(/[,\s]+/).filter(Boolean);
    const bad = tags.filter(t => !normalizeCode(t));
    if (bad.length) { $('f-msg').textContent = `기준 코드 형식을 확인해 주세요: ${bad.join(', ')}`; return; }
    const refRows = $('f-links').value.split('\n').map(l => l.split('|').map(s => s.trim())).filter(p => p[0]);
    const badRef = refRows.filter(p => !/^\d+$/.test(p[1] || ''));
    if (badRef.length) { $('f-msg').textContent = `매뉴얼 근거는 "설명 | 쪽수" 형식으로 적어 주세요 (예: P.07 제3항 | 35): ${badRef.map(p => p.join(' | ')).join(', ')}`; return; }
    const manual_refs = refRows.map(([label, page]) => ({ label, page: Number(page) }));
    const item = {
      id: editing !== null ? data.faqs[editing].id : `faq-${Date.now().toString(36)}`,
      category: catSel.value,
      q: $('f-q').value.trim(),
      a: $('f-a').value.trim(),
      detail: $('f-detail').value.trim(),
      basis: $('f-basis').value.trim(),
      status: $('f-status').value,
      tags: tags.map(normalizeCode),
      manual_refs
    };
    if (editing !== null) data.faqs[editing] = item; else data.faqs.push(item);
    const msg = editing !== null ? '수정했습니다.' : '목록에 추가했습니다.';
    const inq = fromInquiry;
    clearForm();
    if (inq) markInquiry(inq.id, '답변 완료', item.id);
    $('f-msg').textContent = `${msg} ③에서 faq.json을 저장해 GitHub에 올려야 사이트에 반영됩니다.`;
    renderList();
  });
  $('f-clear').addEventListener('click', clearForm);

  $('reset-btn').addEventListener('click', ev => {
    const b = ev.currentTarget;
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = '편집 내용을 버리고 되돌리기 (한 번 더 누르기)'; return; }
    b.dataset.confirm = ''; b.textContent = '사이트 원본으로 되돌리기';
    data = clone(original);
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* 무시 */ }
    clearForm(); renderList();
  });

  $('save-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'faq.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('copy-btn').addEventListener('click', ev => copy($('out').value, ev.currentTarget));


  // ── 0) 구단 문의함 ──
  const KEY_STORE = 'ojt-admin-key';
  const endpoint = (site.inquiry || {}).endpoint;
  let inbox = [];
  try { $('admin-key').value = localStorage.getItem(KEY_STORE) || ''; } catch (e) { /* 무시 */ }
  async function call(body) {
    const res = await fetch(endpoint, { method: 'POST', body: JSON.stringify({ ...body, key: $('admin-key').value.trim() }) });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || '요청 실패');
    return out;
  }
  function renderInbox() {
    const hide = $('inbox-hide-done').checked;
    const list = inbox.filter(q => !hide || q.status !== '답변 완료');
    const waiting = inbox.filter(q => q.status !== '답변 완료').length;
    $('inbox-count').textContent = `미처리 ${waiting}건 · 전체 ${inbox.length}건`;
    $('inbox-list').innerHTML = list.length ? list.map(q => `<div class="inbox-item${q.status === '답변 완료' ? ' done' : ''}">
        <div class="inbox-meta"><span class="chip ${q.status === '답변 완료' ? 'chip-ok' : 'chip-warn'}">${esc(q.status)}</span>
          <span>${esc(q.at)}</span> · <strong>${esc(q.club)}</strong> ${esc(q.name)} (${esc(q.dept)} / ${esc(q.position)}) ·
          <span>${esc(q.email)}</span>${q.faq_id ? ` · Q&A ${esc(q.faq_id)}` : ''}</div>
        <p class="inbox-q">${esc(q.question)}</p>
        <div class="actions" style="margin:0">
          <button type="button" class="btn btn-sm btn-primary" data-inq="answer" data-id="${esc(q.id)}">Q&A로 답변 작성</button>
          <button type="button" class="btn btn-sm" data-inq="copy" data-id="${esc(q.id)}">이메일 주소 복사</button>
          ${q.status === '답변 완료'
            ? `<button type="button" class="btn btn-sm" data-inq="reopen" data-id="${esc(q.id)}">미처리로 되돌리기</button>`
            : `<button type="button" class="btn btn-sm" data-inq="done" data-id="${esc(q.id)}">Q&A 없이 처리 완료</button>`}
        </div></div>`).join('') : '<p class="muted small">표시할 문의가 없습니다.</p>';
  }
  async function loadInbox() {
    if (!endpoint) { $('inbox-msg').textContent = '문의 접수 서버가 아직 연결되지 않았습니다. site.json의 inquiry.endpoint를 설정하세요(운영가이드 10장).'; return; }
    $('inbox-msg').textContent = '불러오는 중…';
    try {
      const out = await call({ action: 'list' });
      inbox = out.items || [];
      try { localStorage.setItem(KEY_STORE, $('admin-key').value.trim()); } catch (e) { /* 무시 */ }
      $('inbox-msg').textContent = `불러왔습니다. (${new Date().toLocaleTimeString('ko-KR')})`;
      renderInbox();
    } catch (e) { $('inbox-msg').textContent = `불러오지 못했습니다: ${e.message}`; }
  }
  async function markInquiry(id, status, faqId) {
    if (!endpoint) return;
    try {
      await call({ action: 'update', id, status, ...(faqId !== undefined ? { faq_id: faqId } : {}) });
      const q = inbox.find(x => x.id === id); if (q) { q.status = status; if (faqId !== undefined) q.faq_id = faqId; }
      renderInbox();
      $('f-msg').textContent += status === '답변 완료' ? ' 문의함에서 이 문의를 처리 완료로 표시했습니다.' : '';
    } catch (e) { $('inbox-msg').textContent = `상태를 바꾸지 못했습니다: ${e.message}`; }
  }
  $('inbox-load').addEventListener('click', loadInbox);
  $('inbox-hide-done').addEventListener('change', renderInbox);
  $('inbox-list').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-inq]');
    if (!b) return;
    const q = inbox.find(x => x.id === b.dataset.id);
    if (!q) return;
    if (b.dataset.inq === 'copy') return copy(q.email, b);
    if (b.dataset.inq === 'done') return markInquiry(q.id, '답변 완료');
    if (b.dataset.inq === 'reopen') return markInquiry(q.id, '접수');
    // Q&A로 답변 작성: 문의 내용을 질문 칸에 넣고, 문장 속 기준 코드로 분류·관련 기준을 채움
    clearForm();
    fromInquiry = q;
    const codes = [...new Set((q.question.match(/[SIPLFMR]\s*[.\-]?\s*\d{1,2}(?!\d)/gi) || []).map(normalizeCode).filter(Boolean))];
    $('f-q').value = q.question;
    $('f-tags').value = codes.join(', ');
    catSel.value = codes.length ? codes[0][0] : '공통';
    $('a-mode').textContent = `문의 답변 중: ${q.club} ${q.name}`;
    $('f-submit').textContent = 'Q&A에 추가하고 문의 처리 완료';
    $('f-msg').textContent = '질문 문장에서 구단명·이름 등 개인정보를 빼고 다듬은 뒤 답변을 작성하세요.';
    $('a-form').scrollIntoView({ block: 'start' });
  });

  renderList();
})();
