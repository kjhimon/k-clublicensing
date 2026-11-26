/* 조항 검색 페이지 */
(async () => {
  const $ = id => document.getElementById(id);
  let data;
  try { data = await ClauseSearch.init(); } catch (e) { OJT.showError($('s-results'), e); return; }
  $('s-doc').innerHTML += (data.docs || []).map(d => `<option value="${OJT.esc(d.id)}">${OJT.esc((d.org ? d.org + ' · ' : '') + d.title)}</option>`).join('');
  if (!data.list.length) {
    $('s-msg').textContent = '아직 검색할 규정·매뉴얼 본문이 등록되지 않았습니다. 연맹에서 자료를 올리는 대로 검색할 수 있습니다.';
  }
  async function run() {
    const q = $('s-q').value.trim();
    const url = new URL(location.href); url.searchParams.set('q', q); history.replaceState(null, '', url);
    if (!q) { $('s-results').innerHTML = ''; $('s-count').textContent = ''; return; }
    const { terms, results } = await ClauseSearch.search(q, { doc: $('s-doc').value });
    $('s-count').textContent = `${results.length}건`;
    $('s-results').innerHTML = results.length ? results.map(a => ClauseSearch.card(a, terms)).join('')
      : `<li class="muted">${data.list.length ? '찾는 조항이 없습니다. 다른 낱말(영문 포함)로 검색해 보세요.' : '등록된 본문이 아직 없습니다.'}</li>`;
  }
  $('s-form').addEventListener('submit', ev => { ev.preventDefault(); run(); });
  $('s-doc').addEventListener('change', run);
  const q0 = new URL(location.href).searchParams.get('q');
  if (q0) { $('s-q').value = q0; run(); }
})();
