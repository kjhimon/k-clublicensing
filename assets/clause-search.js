/* 규정·매뉴얼 조항 검색 엔진 (검색 메뉴와 Ask CLAP이 함께 씀)
 * - 모든 계산은 사용자 브라우저 안에서 함 (서버·유료 서비스 없음)
 * - 한국어 질문은 data/intl-synonyms.json의 낱말 짝으로 영문 원문 낱말도 함께 찾음 */
const ClauseSearch = (() => {
  let data, syn, ready;
  const PARTICLE = /(으로|에서|에게|한테|까지|부터|이랑|하고|이나|이요|은|는|이|가|을|를|에|의|로|도|만|과|와|요)$/;
  const norm = s => String(s || '').toLowerCase().replace(/[“”"'’‘()\[\]{}<>.,;:!?·…~/\\|]/g, ' ').replace(/\s+/g, ' ').trim();

  function init() {
    if (!ready) ready = Promise.all([OJT.load('intl-articles'), OJT.load('intl-synonyms')]).then(([a, s]) => {
      data = a; syn = s;
      const docs = Object.fromEntries((a.docs || []).map(d => [d.id, d]));
      data.list = (a.articles || []).map(x => ({ ...x, docObj: docs[x.doc] || { title: x.doc }, _t: norm(x.title), _b: norm(x.text), _n: norm(x.no) }));
      return data;
    });
    return ready;
  }

  // 질문 → 찾을 낱말 목록 (조사 떼기, 뜻 없는 말 빼기, 한국어→영어 낱말 더하기)
  function terms(q) {
    const stop = new Set((syn.stop || []).map(norm));
    const raw = norm(q).split(' ').filter(Boolean);
    const out = new Map();   // 낱말 → 가중치
    const add = (t, w) => { t = norm(t); if (t && t.length > 1 - /[a-z0-9]/.test(t) && !stop.has(t)) out.set(t, Math.max(out.get(t) || 0, w)); };
    for (let w of raw) {
      if (stop.has(w)) continue;
      const base = /[가-힣]/.test(w) ? w.replace(PARTICLE, '') : w;
      if (!base || stop.has(base)) continue;
      add(base, 1);
    }
    const qn = norm(q).replace(/\s+/g, '');
    for (const [ko, ens] of Object.entries(syn.words || {})) {
      if (qn.includes(norm(ko).replace(/\s+/g, ''))) { add(ko, 1); ens.forEach(e => add(e, 1)); }
    }
    return [...out.entries()].map(([t, w]) => ({ t, w }));
  }

  const count = (hay, t) => { let n = 0, i = 0; while ((i = hay.indexOf(t, i)) !== -1) { n++; i += t.length; } return n; };

  async function search(q, opt = {}) {
    await init();
    const ts = terms(q);
    if (!ts.length) return { terms: [], results: [] };
    const results = [];
    for (const a of data.list) {
      if (opt.doc && a.doc !== opt.doc) continue;
      let score = 0, hit = 0;
      for (const { t, w } of ts) {
        const c = count(a._t, t) * 3 + count(a._n, t) * 3 + Math.min(count(a._b, t), 5);
        if (c) { hit++; score += c * w * (t.includes(' ') ? 1.5 : 1); }
      }
      if (hit) results.push({ a, score: score * (1 + hit / ts.length) });
    }
    results.sort((x, y) => y.score - x.score);
    return { terms: ts.map(x => x.t), results: results.slice(0, opt.limit || 30).map(r => r.a) };
  }

  // 본문에서 찾은 낱말 근처만 잘라 보여 주고 강조
  function snippet(text, ts, len = 220) {
    const s = String(text || '');
    const low = s.toLowerCase();
    let pos = -1;
    for (const t of ts) { const i = low.indexOf(t); if (i !== -1 && (pos === -1 || i < pos)) pos = i; }
    const start = Math.max(0, pos - 60);
    let cut = s.slice(start, start + len);
    return (start > 0 ? '…' : '') + highlight(cut, ts) + (start + len < s.length ? '…' : '');
  }
  function highlight(s, ts) {
    let html = OJT.esc(s);
    const sorted = [...ts].filter(t => t.length > 1).sort((a, b) => b.length - a.length);
    if (!sorted.length) return html;
    const re = new RegExp('(' + sorted.map(t => OJT.esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return html.replace(re, '<mark>$1</mark>');
  }

  function link(a) {
    const d = a.docObj || {};
    if (d.file) return d.file + (a.page ? `#page=${a.page}` : '');
    return d.url || '';
  }

  function card(a, ts) {
    const d = a.docObj || {};
    const href = link(a);
    return `<li class="clause">
      <div class="clause-meta">${d.org ? `<span class="chip">${OJT.esc(d.org)}</span>` : ''}<span>${OJT.esc(d.title || '')}</span></div>
      <strong class="clause-title">${OJT.esc(a.no || '')}${a.title ? ` · ${highlight(a.title, ts)}` : ''}</strong>
      <p class="clause-text">${snippet(a.text, ts)}</p>
      <div class="actions" style="margin:4px 0 0">
        ${href ? `<a class="btn btn-sm" href="${OJT.esc(href)}" target="_blank" rel="noopener">원문 보기${a.page ? ` · p.${a.page}` : ''} →</a>` : ''}
        ${d.translation ? `<a class="btn btn-sm" href="${OJT.esc(d.translation)}" target="_blank" rel="noopener">국문 번역본</a>` : ''}
      </div></li>`;
  }

  return { init, search, terms, card };
})();
