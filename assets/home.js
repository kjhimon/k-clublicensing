/* 홈: 코드 검색, 이번 달 마감, 최근 공지 */
(async () => {
  const { load, esc, anchor, normalizeCode, gradeBadge, today, toDate, showError } = OJT;
  const monthEl = document.getElementById('month-list');
  const noticeEl = document.getElementById('notice-list');
  let criteria = [];

  try {
    criteria = (await load('criteria')).criteria;
  } catch (e) {
    showError(monthEl, e);
  }

  // 1) 기준 코드 검색
  const form = document.getElementById('code-form');
  const input = document.getElementById('code-input');
  const msg = document.getElementById('code-msg');
  if (form) form.addEventListener('submit', ev => {   // 검색창은 2026-11 개편 때 홈에서 뺐음(있을 때만 작동)
    ev.preventDefault();
    const code = normalizeCode(input.value);
    if (!code) {
      msg.textContent = '코드 형식을 확인해 주세요. 예: F.01, S.08, P.07';
      return;
    }
    if (criteria.length && !criteria.some(c => c.code === code)) {
      msg.textContent = `${code} 기준을 찾을 수 없습니다. (S.01~S.08, I.01~I.07, P.01~P.26, L.01~L.06, F.01~F.11, M.01~M.03, R.01~R.05)`;
      return;
    }
    location.href = `ojt.html#${anchor(code)}`;
  });

  // 2) 이번 달 마감 기준
  if (criteria.length) {
    const now = today();
    const y = now.getFullYear(), m = now.getMonth();
    const rows = [];
    criteria.forEach(c => (c.deadlines || []).forEach(d => {
      const end = toDate(d.date);
      const start = d.start ? toDate(d.start) : end;
      const inMonth = (end.getFullYear() === y && end.getMonth() === m) || (start.getFullYear() === y && start.getMonth() === m);
      if (inMonth) rows.push({ c, d, end });
    }));
    rows.sort((a, b) => a.end - b.end || a.c.code.localeCompare(b.c.code));
    let html = `<p class="small muted">${y}년 ${m + 1}월 기준 · 제출기한은 2026 매뉴얼 기준입니다.</p>`;
    if (rows.length) {
      html += '<ul class="list-plain">' + rows.map(({ c, d, end }) => {
        const past = end < now;
        const dleft = Math.round((end - now) / 86400000);
        const tag = past ? '<span class="chip">마감 지남</span>' : (dleft === 0 ? '<span class="chip chip-warn">오늘 마감</span>' : `<span class="chip chip-warn">D-${dleft}</span>`);
        return `<li class="dl-row">
          <a class="code" href="ojt.html#${anchor(c.code)}">${esc(c.code)}</a>
          <span>${esc(c.name_ko)}</span>
          ${gradeBadge(c.grade.K1, 'K리그1')}
          <span class="muted small">${esc(d.label ? d.label + ' ' : '')}${esc(c.deadline)}</span>
          ${tag}
        </li>`;
      }).join('') + '</ul>';
    } else {
      html += '<p>이번 달에 마감되는 기준이 없습니다.</p>';
    }
    // 다음 마감
    const upcoming = [];
    criteria.forEach(c => (c.deadlines || []).forEach(d => { if (toDate(d.date) >= now) upcoming.push({ c, d }); }));
    upcoming.sort((a, b) => toDate(a.d.date) - toDate(b.d.date));
    if (upcoming.length) {
      const first = upcoming[0].d.date;
      const same = upcoming.filter(u => u.d.date === first);
      html += `<p class="small" style="margin-top:12px">다음 마감: <strong>${esc(first)}</strong> · ${same.length}건 (${same.map(u => `<a href="ojt.html#${anchor(u.c.code)}">${esc(u.c.code)}</a>`).join(', ')}) · <a href="ojt.html?sort=deadline">마감일순 전체 보기</a></p>`;
    } else {
      html += '<p class="notice-box small" style="margin-top:12px">2026 라이선싱 제출기한이 모두 지났습니다. 다음 사이클 일정은 연맹 공지 후 갱신됩니다.</p>';
    }
    monthEl.innerHTML = html;
  }

  // 3) 최근 공지
  try {
    const { notices } = await load('notices');
    const list = [...notices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    noticeEl.innerHTML = list.length ? '<ul class="list-plain">' + list.map(n => `<li>
      <div class="small muted">${esc(n.date)}</div>
      <strong>${n.link ? `<a href="${esc(n.link)}">${esc(n.title)}</a>` : esc(n.title)}</strong>
      ${n.body ? `<div class="small">${esc(n.body)}</div>` : ''}
    </li>`).join('') + '</ul>' : '<p class="muted">등록된 공지가 없습니다.</p>';
  } catch (e) {
    showError(noticeEl, e);
  }
})();
