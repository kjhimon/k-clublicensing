/* OJT 페이지: 등록된 양식(data/forms.json)이 있는 기준만 보여 주고,
 * 펼치면 양식 미리보기 + 작성 설명을 보여 줍니다. 주소 #F-01 로 바로 열립니다. */
(async () => {
  const { load, esc, anchor, normalizeCode, gradeBadge, statusChip, showError, flash, copy, pageUrl } = OJT;
  const listEl = document.getElementById('crit-list');
  let site, crit, formData, guide;
  try {
    [site, crit, formData, guide] = await Promise.all([load('site'), load('criteria'), load('forms'), load('guide')]);
  } catch (e) {
    showError(listEl, e);
    return;
  }
  const refs = formData.forms.filter(f => f.file && f.ref);   // 참고 자료
  const forms = formData.forms.filter(f => f.file && !f.ref);
  const withForms = new Set(forms.map(f => f.code));
  const criteria = crit.criteria.filter(c => withForms.has(c.code));
  const manual = site.library.find(l => l.current && l.file && l.type === '매뉴얼');

  // ── 1. 처음이신가요? ──
  if (guide.guide && guide.guide.length) {
    document.getElementById('guide-body').innerHTML = guide.guide.map(g => `
      <div class="g-item">
        <h3>${esc(g.title)} ${statusChip(g.status)}</h3>
        <p class="pre">${esc(g.body)}</p>
        ${g.note ? `<p class="small notice-box">${esc(g.note)}</p>` : ''}
        <p class="small muted">근거: ${esc(g.source)}</p>
      </div>`).join('');
  } else {
    document.getElementById('guide-zone').remove();
  }

  // ── 2. 목록 ──
  const params = new URLSearchParams(location.search);
  const areas = site.areas.filter(a => criteria.some(c => c.code[0] === a.code));
  const state = {
    view: params.get('dept') ? 'dept' : 'area',
    area: areas[0] ? areas[0].code : 'S',
    dept: params.get('dept') || site.departments[0],
    sort: params.get('sort') === 'deadline' ? 'deadline' : 'code'
  };

  if (!criteria.length) {
    document.querySelector('.controls').remove();
    document.getElementById('area-tabs').remove();
    listEl.innerHTML = '<div class="empty"><strong>아직 등록된 양식이 없습니다</strong>연맹이 양식과 작성 설명을 등록하면 이곳에 기준별로 나타납니다.</div>';
    document.getElementById('list-count').textContent = '0개 기준';
    hashNotice(normalizeCode(decodeURIComponent(location.hash.slice(1))));
    return;
  }

  const tabsEl = document.getElementById('area-tabs');
  tabsEl.innerHTML = areas.map(a => {
    const n = criteria.filter(c => c.code[0] === a.code).length;
    return `<button type="button" role="tab" data-area="${a.code}">${esc(a.name)} ${a.code} <span class="count">(${n})</span></button>`;
  }).join('');
  tabsEl.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-area]');
    if (b) { state.area = b.dataset.area; render(); }
  });
  const deptSel = document.getElementById('dept-select');
  deptSel.innerHTML = site.departments.map(d => `<option>${esc(d)}</option>`).join('');
  deptSel.value = state.dept;
  deptSel.addEventListener('change', () => { state.dept = deptSel.value; render(); });
  const sortSel = document.getElementById('sort-select');
  sortSel.value = state.sort;
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; render(); });
  document.getElementById('view-area').addEventListener('click', () => { state.view = 'area'; render(); });
  document.getElementById('view-dept').addEventListener('click', () => { state.view = 'dept'; render(); });

  const fileExt = p => (p.split('?')[0].split('.').pop() || '').toLowerCase();
  const list = items => items && items.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '';

  function formBlock(c, f, i) {
    const docs = (c.documents || []).filter(d => (f.doc_no || '').includes(d.no));
    const ext = fileExt(f.file);
    return `<div class="form-block" id="${anchor(c.code)}-form-${i}">
      <div class="form-block-head">
        <span class="chip">${esc(f.doc_no || '양식')}</span>
        <h4>${esc(f.title)}</h4>
        ${f.self_form_allowed ? '<span class="chip chip-ok">자체양식 가능</span>' : ''}
        ${f.explain_status ? `<span class="chip chip-warn" title="연맹 검토 전 설명입니다">설명 ${esc(f.explain_status)}</span>` : ''}
        <div class="actions"><a class="btn btn-sm btn-primary" href="${esc(f.file)}" download>${esc(ext.toUpperCase())} 내려받기</a></div>
      </div>
      <div class="form-grid">
        <div class="form-preview" data-form-id="${esc(f.id)}"><p class="muted small">미리보기 불러오는 중…</p></div>
        <div class="form-explain">
          ${f.description ? `<h5>이 양식은</h5><p>${esc(f.description)}</p>` : ''}
          ${f.steps && f.steps.length ? `<h5>작성 순서</h5><ol>${f.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
          ${f.cautions && f.cautions.length ? `<h5>주의할 점</h5>${list(f.cautions)}` : ''}
          ${docs.length ? `<h5>매뉴얼 제출서류 목록 (${esc(c.code)})</h5>${docs.map(doc => `
            <p class="small"><strong>${esc(doc.no)} ${esc(doc.requirement)}</strong><br>평가 방식: ${esc(doc.evaluation || '-')}</p>`).join('')}` : ''}
          ${f.updated ? `<p class="small muted">양식 최종 수정일 ${esc(f.updated)}</p>` : ''}
        </div>
      </div>
    </div>`;
  }

  function detail(c) {
    const fs = forms.filter(f => f.code === c.code);
    const pdf = manual ? `<a class="btn btn-sm" href="${esc(manual.file)}#page=${c.page}" target="_blank" rel="noopener">매뉴얼 원문 p.${c.page}</a>` : '';
    const rs = refs.filter(f => f.code === c.code);
    return `${fs.map((f, i) => formBlock(c, f, i + 1)).join('')}
      ${rs.length ? `<h5 class="ref-title">참고 자료</h5><ul class="ref-list">${rs.map(f => `<li><span>${esc(f.title)}</span> <a class="btn btn-sm" href="${esc(f.file)}" download>${esc(fileExt(f.file).toUpperCase())} 내려받기</a></li>`).join('')}</ul>` : ''}
      <div class="actions">
        <a class="btn btn-sm" href="rules.html#form-${c.code.replace('.', '')}">규정 &amp; 양식 페이지에서 받기</a>
        ${pdf}
        <button type="button" class="btn btn-sm" data-copy="${anchor(c.code)}">링크 복사</button>
      </div>`;
  }

  // 미리보기: 엑셀은 표로, PDF는 화면 안에, 이미지는 그대로 / 한글·워드는 preview 칸에 PDF·이미지를 넣으면 보임
  let xlsxReady;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    if (!xlsxReady) xlsxReady = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    return xlsxReady;
  }
  function renderSheets(box, names, htmlOf) {
    const show = name => {
      box.querySelector('.sheet-view').innerHTML = htmlOf(name);
      box.querySelectorAll('.sheet-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.sheet === name));
    };
    box.innerHTML = `${names.length > 1 ? `<div class="sheet-tabs">${names.map(n => `<button type="button" data-sheet="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <div class="sheet-view"></div><p class="small muted">미리보기는 값만 보여 줍니다. 서식·수식은 내려받은 파일에서 확인하세요.</p>`;
    box.querySelectorAll('.sheet-tabs button').forEach(b => b.addEventListener('click', () => show(b.dataset.sheet)));
    show(names[0]);
  }

  async function fillPreview(box) {
    const f = forms.find(x => x.id === box.dataset.formId);
    const pv = f.preview;
    // 한글·워드·PPT 양식: 미리 만들어 둔 페이지 그림(images)과 PDF
    if (pv && typeof pv === 'object' && pv.images && pv.images.length) {
      box.innerHTML = pv.images.map((src, i) => `<a href="${esc(src)}" target="_blank" rel="noopener" title="크게 보기"><img class="preview-img" src="${esc(src)}" alt="양식 미리보기 ${i + 1}쪽" loading="lazy" style="margin-bottom:8px"></a>`).join('') +
        `<p class="small">${pv.note ? esc(pv.note) + ' ' : ''}${pv.pages > pv.images.length ? `전체 ${pv.pages}쪽 중 ${pv.images.length}쪽만 보입니다. ` : ''}${pv.pdf ? `<a href="${esc(pv.pdf)}" target="_blank" rel="noopener">PDF로 크게 보기</a> · ` : ''}실제 작성은 내려받은 원본 파일로 하세요.</p>`;
      return;
    }
    // 엑셀 양식: 미리 만들어 둔 시트 표(sheets JSON)가 있으면 그것을, 없으면 원본 엑셀을 직접 읽음
    if (pv && typeof pv === 'object' && pv.sheets) {
      try {
        const data = await (await fetch(pv.sheets)).json();
        renderSheets(box, data.names, n => data.html[n]);
      } catch (e) {
        box.innerHTML = '<p class="small muted">미리보기를 불러오지 못했습니다. 내려받기 버튼으로 파일을 열어 주세요.</p>';
      }
      return;
    }
    const src = (typeof pv === 'string' && pv) ? pv : f.file;
    const ext = fileExt(src);
    try {
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
        box.innerHTML = `<img class="preview-img" src="${esc(src)}" alt="양식 미리보기">`;
      } else if (ext === 'pdf') {
        box.innerHTML = `<iframe class="preview-frame" src="${esc(src)}#view=FitH" title="양식 미리보기"></iframe>
          <p class="small"><a href="${esc(src)}" target="_blank" rel="noopener">새 탭에서 크게 보기</a></p>`;
      } else if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
        await loadXlsx();
        const buf = await (await fetch(src)).arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        renderSheets(box, wb.SheetNames, n => XLSX.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' }));
      } else {
        box.innerHTML = '<div class="empty small"><strong>미리보기를 지원하지 않는 파일입니다</strong>오른쪽 위 내려받기 버튼으로 파일을 열어 주세요.</div>';
      }
    } catch (e) {
      box.innerHTML = '<p class="small muted">미리보기를 불러오지 못했습니다. 내려받기 버튼으로 파일을 열어 주세요.</p>';
    }
  }

  function row(c) {
    const n = forms.filter(f => f.code === c.code).length;
    return `<details class="crit" id="${anchor(c.code)}" data-code="${esc(c.code)}">
      <summary>
        <span class="c-code">${esc(c.code)}</span>
        <span class="c-name"><strong>${esc(c.name_ko)}</strong><span>${esc(c.name_en)} · 양식 ${n}개</span></span>
        <span>${gradeBadge(c.grade.K1, 'K리그1')}</span>
        <span class="c-dl">${esc(c.deadline)}</span>
      </summary>
      <div class="crit-body" data-loaded="0"></div>
    </details>`;
  }

  const sortKey = c => c.deadlines && c.deadlines.length ? c.deadlines[0].date : '9999-12-31';
  function visible() {
    let l = state.view === 'area' ? criteria.filter(c => c.code[0] === state.area) : criteria.filter(c => c.departments.includes(state.dept));
    l = [...l];
    if (state.sort === 'deadline') l.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.code.localeCompare(b.code));
    return l;
  }

  function render(openCode) {
    document.getElementById('view-area').setAttribute('aria-pressed', state.view === 'area');
    document.getElementById('view-dept').setAttribute('aria-pressed', state.view === 'dept');
    document.getElementById('dept-wrap').hidden = state.view !== 'dept';
    tabsEl.hidden = state.view !== 'area';
    tabsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.area === state.area));
    const l = visible();
    document.getElementById('list-count').textContent = `${l.length}개 기준`;
    listEl.innerHTML = l.length ? l.map(row).join('') : '<div class="empty"><strong>이 부서에 해당하는 양식이 아직 없습니다</strong></div>';
    if (openCode) openOne(openCode);
  }

  listEl.addEventListener('toggle', ev => {
    const d = ev.target;
    if (!d.matches || !d.matches('details.crit') || !d.open) return;
    const body = d.querySelector('.crit-body');
    if (body.dataset.loaded === '1') return;
    body.innerHTML = detail(criteria.find(c => c.code === d.dataset.code));
    body.dataset.loaded = '1';
    body.querySelectorAll('[data-form-id]').forEach(fillPreview);
  }, true);
  listEl.addEventListener('click', ev => {
    const b = ev.target.closest('[data-copy]');
    if (b) copy(pageUrl('ojt.html', b.dataset.copy), b);
  });

  function openOne(code) {
    const el = document.getElementById(anchor(code));
    if (!el) return;
    el.open = true;
    requestAnimationFrame(() => { el.scrollIntoView({ block: 'start' }); flash(el); });
  }

  // #F-01 처리. 등록된 양식이 없는 기준이면 안내 문구를 보여 줌
  function hashNotice(code) {
    const msg = document.getElementById('hash-msg');
    if (!code) { msg.hidden = true; return; }
    msg.hidden = false;
    msg.textContent = `${code}는 아직 OJT에 등록된 양식이 없습니다.`;
  }
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h === 'guide') { const g = document.getElementById('guide'); if (g) { g.open = true; g.scrollIntoView(); } return false; }
    const code = normalizeCode(h);
    if (!code) return false;
    if (!criteria.some(c => c.code === code)) { hashNotice(code); return false; }
    hashNotice();
    if (state.view === 'dept' && !criteria.find(c => c.code === code).departments.includes(state.dept)) state.view = 'area';
    state.area = code[0];
    render(code);
    return true;
  }
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) render();
})();
