/* 규정 & 양식 페이지: 규정·매뉴얼 PDF, 기준별 제출서류와 양식 내려받기
 * 연맹이 올린 양식(forms.json)이 있는 서류만 내려받기 버튼, 나머지는 '구단 자체 양식 사용' */
(async () => {
  const { load, esc, anchor, gradeBadge, showError, flash, circledToNum } = OJT;
  let site, crit, formData;
  try {
    [site, crit, formData] = await Promise.all([load('site'), load('criteria'), load('forms')]);
  } catch (e) {
    showError(document.getElementById('lib-list'), e);
    return;
  }
  const byCode = Object.fromEntries(crit.criteria.map(c => [c.code, c]));

  // 1. 규정·매뉴얼 — 파일이 있는 것만
  const docs = site.library.filter(l => l.file);
  const cur = docs.filter(l => l.current);
  const old = docs.filter(l => !l.current);
  const libRow = l => `<div class="lib-item">
      <div><span class="chip">${esc(l.type || '')}</span> <strong>${esc(l.title)}</strong> <span class="chip">${esc(l.year)}</span> ${l.version ? `<span class="chip">${esc(l.version)}</span>` : ''}
      ${l.published ? `<div class="small muted">게시일 ${esc(l.published)}</div>` : ''}</div>
      <div class="actions" style="margin:0"><a class="btn btn-sm" href="${esc(l.file)}" target="_blank" rel="noopener">PDF 보기</a> <a class="btn btn-sm btn-primary" href="${esc(l.file)}" download>내려받기</a></div>
    </div>`;
  document.getElementById('lib-list').innerHTML =
    (cur.length ? cur.map(libRow).join('') : '<p class="empty"><strong>게시된 파일이 없습니다</strong></p>') +
    (old.length ? `<details class="group" style="margin-top:12px"><summary>지난 버전 (${old.length})</summary><div class="group-body">${old.map(libRow).join('')}</div></details>` : '');

  // 2. 양식 — forms.json에 등록된 것만
  const allFiles = formData.forms.filter(f => f.file);
  const forms = allFiles.filter(f => !f.ref);          // 매뉴얼 제출서류용 양식
  const refsAll = allFiles.filter(f => f.ref);         // 참고 자료(가이드라인 등)
  const zip = site.zip || {};
  const zipBtns = [['all', '전체 내려받기 (zip)'], ...site.areas.map(a => [a.code, `${a.code} ${a.name} (zip)`])]
    .filter(([k]) => zip[k])
    .map(([k, label]) => `<a class="btn btn-sm ${k === 'all' ? 'btn-primary' : ''}" href="${esc(zip[k])}" download>${esc(label)}</a>`);
  const zipEl = document.getElementById('zip-buttons');
  if (zipBtns.length) zipEl.innerHTML = zipBtns.join(''); else zipEl.remove();

  // 매뉴얼 제출서류 중 '서류'를 내는 항목(숫자·날짜 등 입력만 하는 항목은 제외)
  const isDocument = d => /양식|자체|사본|업로드|제출|교안|결과표|서류|증권|다운로드|공문/.test(d.method);
  const ext = f => (f.file.split('.').pop() || '').toUpperCase();
  const formsFor = (code, no) => forms.filter(f => f.code === code && (f.doc_no || '').includes(no));
  let docTotal = 0;
  document.getElementById('forms-list').innerHTML = site.areas.map(a => {
    const list = crit.criteria.filter(c => c.code[0] === a.code);
    const nForms = forms.filter(f => f.code[0] === a.code).length;
    const body = list.map(c => {
      // 서류를 내는 항목 + 연맹 양식이 올라온 항목은 모두 표에 보임
      const docs = (c.documents || []).filter(d => isDocument(d) || formsFor(c.code, d.no).length);
      const refs = refsAll.filter(f => f.code === c.code);
      if (!docs.length && !refs.length) return '';
      docTotal += docs.length;
      const rows = docs.map(d => {
        const fs = formsFor(c.code, d.no);
        const cell = fs.length
          ? fs.map(f => `<div class="dl-cell"><a class="btn btn-sm btn-primary" href="${esc(f.file)}" download>${esc(ext(f))} 내려받기</a>${fs.length > 1 ? ` <span class="small muted">${esc(f.title)}</span>` : ''}</div>`).join('')
          : '<span class="chip">구단 자체 양식 사용</span>';
        const idAttr = fs.length ? ` id="form-${esc(fs[0].id)}"` : '';
        return `<tr${idAttr}>
            <td>${esc(d.no)}</td>
            <td class="pre"><strong>${esc(d.requirement)}</strong>${fs.length ? `<br><code class="small">${fs.map(f => esc(f.file.split('/').pop())).join('<br>')}</code>` : ''}</td>
            <td>${cell}</td>
          </tr>`;
      }).join('');
      // 기준(S.01 등)도 처음에는 닫힌 상태. 제목줄을 누르면 제출서류 표가 펼쳐짐
      const nCritForms = forms.filter(f => f.code === c.code).length;
      return `<details class="form-crit crit-group" id="form-${c.code.replace('.', '')}">
        <summary><span class="fc-code">${esc(c.code)}</span> <span class="fc-name">${esc(c.name_ko)}</span> ${gradeBadge(c.grade.K1, 'K리그1')}
          <span class="count">${nCritForms ? `연맹 양식 ${nCritForms}개` : '구단 자체 양식'} · 서류 ${docs.length}건${refs.length ? ` · 참고 ${refs.length}` : ''}</span>
          <span class="toggle-btn" aria-hidden="true"></span></summary>
        <div class="crit-group-body">
          ${nCritForms ? `<p class="small" style="margin:0 0 8px"><a href="ojt.html#${anchor(c.code)}">이 기준의 작성 방법 보기 →</a></p>` : ''}
          <div class="table-wrap"><table class="dl-table">
          <thead><tr><th>번호</th><th>제출서류</th><th>양식</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
          ${refs.length ? `<h5 class="ref-title">참고 자료</h5><ul class="ref-list">${refs.map(f => `<li id="form-${esc(f.id)}"><span>${esc(f.title)}</span> <a class="btn btn-sm" href="${esc(f.file)}" download>${esc(ext(f))} 내려받기</a></li>`).join('')}</ul>` : ''}
        </div></details>`;
    }).join('');
    // 처음에는 모두 닫힌 상태. 분야 제목줄의 '열기'를 눌러 필요한 분야만 펼침
    return `<details class="group area-group" id="forms-${a.code}">
      <summary>${esc(a.code)} · ${esc(a.name)} <span class="count">${nForms ? `연맹 양식 ${nForms}개` : '연맹 양식 없음 · 구단 자체 양식 사용'}</span><span class="toggle-btn" aria-hidden="true"></span></summary>
      <div class="group-body">${body}</div></details>`;
  }).join('');
  document.getElementById('forms-count').textContent = `연맹 양식 ${forms.length}개 · 제출서류 ${docTotal}건`;

  function openHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id && document.getElementById(id);
    if (!target) return;
    // 바로가기로 들어오면 그 위치를 감싼 분야·기준을 모두 펼침
    for (let d = target.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
    requestAnimationFrame(() => { target.scrollIntoView({ block: 'start' }); flash(target); });
  }
  window.addEventListener('hashchange', openHash);
  openHash();
})();
