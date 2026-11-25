/* AFC·FIFA 페이지: data/intl.json의 구역별 자료 목록을 보여 줌 */
(async () => {
  const { load, esc, showError, flash } = OJT;
  const box = document.getElementById('intl-list');
  let data;
  try { data = await load('intl'); } catch (e) { showError(box, e); return; }

  const item = it => `<li class="intl-item">
      <div class="intl-meta">${it.org ? `<span class="chip">${esc(it.org)}</span>` : ''}${it.date ? `<span>${esc(it.date)}</span>` : ''}${it.no ? `<span>${esc(it.no)}</span>` : ''}</div>
      <strong class="intl-title">${esc(it.title)}</strong>
      ${it.note ? `<p class="small muted">${esc(it.note)}</p>` : ''}
      <div class="actions" style="margin:6px 0 0">
        ${it.file ? `<a class="btn btn-sm btn-primary" href="${esc(it.file)}" target="_blank" rel="noopener">원문 PDF</a>` : ''}
        ${it.url ? `<a class="btn btn-sm" href="${esc(it.url)}" target="_blank" rel="noopener">원문 사이트 →</a>` : ''}
        ${it.translation ? `<a class="btn btn-sm" href="${esc(it.translation)}" target="_blank" rel="noopener">국문 번역본</a>` : ''}
      </div></li>`;

  box.innerHTML = data.sections.map((s, i) => {
    const items = [...(s.items || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return `<details class="zone zone-toggle" id="${esc(s.id)}" open>
      <summary class="zone-head"><span class="zone-no">${i + 1}</span><h2>${esc(s.title)}</h2><span class="zone-sub">${esc(s.en)}</span>
        <span class="count">${items.length}건</span><span class="toggle-btn" aria-hidden="true"></span></summary>
      <div class="zone-body">
        <p class="small muted" style="margin-top:0">${esc(s.desc)}</p>
        ${items.length ? `<ul class="intl-items">${items.map(item).join('')}</ul>` : '<p class="muted">아직 등록된 자료가 없습니다. 연맹에서 자료를 정리해 올릴 예정입니다.</p>'}
      </div></details>`;
  }).join('');

  function openHash() {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!el || !el.matches('details')) return;
    el.open = true;
    requestAnimationFrame(() => { el.scrollIntoView({ block: 'start' }); flash(el); });
  }
  window.addEventListener('hashchange', openHash);
  openHash();
})();
