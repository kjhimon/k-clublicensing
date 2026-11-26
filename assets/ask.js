/* Ask CLAP: 말하듯 물어보면 규정·매뉴얼에서 근거 조항을 찾아 보여 줌
 * 지금은 AI 연결 전 단계 — 답변 문장 대신 근거 조항만 보여 줌.
 * 나중에 AI를 붙일 때: site.json의 ask.endpoint에 서버 주소를 넣고, 찾은 조항을 함께 보내 답변 문장을 받아 #a-answer에 표시 */
(async () => {
  const $ = id => document.getElementById(id);
  const EXAMPLES = ['ACL 홈 경기 때 볼보이는 몇 명 있어야 해?', '경기 전 회의는 언제 어디서 해?', '경기장 조명 기준이 어떻게 돼?', '원정팀 훈련장은 우리가 준비해야 해?'];
  $('a-examples').innerHTML = '<span class="small muted">예시 질문:</span> ' + EXAMPLES.map(q => `<button type="button" class="chip-btn">${OJT.esc(q)}</button>`).join('');
  let data;
  try { data = await ClauseSearch.init(); } catch (e) { OJT.showError($('a-answer'), e); $('a-out').hidden = false; return; }
  async function ask(q) {
    $('a-out').hidden = false;
    $('a-echo').innerHTML = `<span class="label">질문</span><p>${OJT.esc(q)}</p>`;
    const { terms, results } = await ClauseSearch.search(q, { limit: 8 });
    $('a-count').textContent = results.length ? `근거 후보 ${results.length}건` : '';
    if (!data.list.length) {
      $('a-answer').innerHTML = '<p class="muted">아직 규정·매뉴얼 본문이 등록되지 않아 근거를 찾을 수 없습니다. 자료가 올라오면 바로 답할 수 있습니다. 급한 문의는 연맹 클럽라이선스팀에 해 주세요.</p>';
      $('a-results').innerHTML = '';
    } else if (!results.length) {
      $('a-answer').innerHTML = '<p>관련 조항을 찾지 못했습니다. 다른 표현으로 물어보시거나 <a href="search.html">검색</a>에서 낱말로 찾아보세요. 규정에 없는 내용일 수 있으니 연맹에 문의해 주세요.</p>';
      $('a-results').innerHTML = '';
    } else {
      $('a-answer').innerHTML = `<p>질문과 관련된 조항을 찾았습니다. <strong>위에서부터 관련도가 높은 순서</strong>이며, 정확한 판단은 원문을 확인해 주세요.</p>`;
      $('a-results').innerHTML = results.map(a => ClauseSearch.card(a, terms)).join('');
    }
    $('a-out').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  $('a-form').addEventListener('submit', ev => { ev.preventDefault(); const q = $('a-q').value.trim(); if (q) ask(q); });
  $('a-q').addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); $('a-form').requestSubmit(); } });
  $('a-examples').addEventListener('click', ev => { const b = ev.target.closest('.chip-btn'); if (b) { $('a-q').value = b.textContent; ask(b.textContent); } });
})();
