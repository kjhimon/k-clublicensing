/* 관리자 비밀번호 팝업
 * - 어느 페이지에서든 '관리자'를 누르면 비밀번호 팝업이 뜨고, 맞아야만 관리자 화면으로 넘어감
 * - admin.html 주소로 바로 들어와도 같은 팝업이 뜨고, 맞기 전에는 화면이 보이지 않음
 * 기억하지 않음: 누를 때마다, 관리자 화면을 새로 열 때마다 매번 물어봄
 * 비밀번호 원문은 저장하지 않고, 솔트를 붙여 여러 번 섞은 값(PBKDF2-SHA256)만 비교함. */
(() => {
  const SALT = 'b79d2add7fd4a87ebd5dbf93cf849eab';
  const ITER = 310000;
  const HASH = '95719ef553e861cf89d9ab28297decfbf1c29222291ae54d8ca4be8909b56e05';
  const PASS_KEY = 'ojt-admin-pass';   // 팝업 통과 직후 관리자 화면으로 넘어갈 때 한 번만 쓰는 표시
  const onAdmin = document.body.dataset.page === 'admin';

  // 팝업을 통과해 넘어온 경우인지 확인하고 표시는 바로 지움(새로고침·다시 열기 때는 다시 물어봄)
  const takePass = () => {
    try {
      const t = Number(sessionStorage.getItem(PASS_KEY)); sessionStorage.removeItem(PASS_KEY);
      return t && Date.now() - t < 15000;
    } catch (e) { return false; }
  };
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  async function check(pw) {
    const salt = new Uint8Array(SALT.match(/../g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256)) === HASH;
  }

  let dlg;
  function popup(onSuccess) {
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.className = 'pw-dialog';
      dlg.setAttribute('aria-labelledby', 'pw-title');
      dlg.innerHTML = `<form class="gate-box" method="dialog">
          <p class="eyebrow">ADMIN</p>
          <h2 id="pw-title">관리자 비밀번호</h2>
          <p class="small muted">관리자만 들어갈 수 있습니다. 비밀번호를 입력해 주세요.</p>
          <label class="sr-only" for="pw-input">비밀번호</label>
          <input type="password" id="pw-input" placeholder="비밀번호" autocomplete="current-password">
          <p class="pw-msg" id="pw-msg" aria-live="assertive"></p>
          <div class="pw-actions">
            <button type="button" class="btn" id="pw-cancel">취소</button>
            <button type="submit" class="btn btn-primary" id="pw-ok">확인</button>
          </div>
        </form>`;
      document.body.appendChild(dlg);
    }
    const input = dlg.querySelector('#pw-input');
    const msg = dlg.querySelector('#pw-msg');
    const okBtn = dlg.querySelector('#pw-ok');
    const cancel = () => { dlg.close(); if (onAdmin) location.replace('index.html'); };
    input.value = ''; msg.textContent = '';
    dlg.querySelector('#pw-cancel').onclick = cancel;
    dlg.oncancel = ev => { ev.preventDefault(); cancel(); };   // Esc 키
    dlg.querySelector('form').onsubmit = async ev => {
      ev.preventDefault();
      if (!input.value) { msg.textContent = '비밀번호를 입력해 주세요.'; input.focus(); return; }
      okBtn.disabled = true; msg.textContent = '확인 중…';
      let ok = false;
      try { ok = await check(input.value); } catch (e) {
        msg.textContent = '이 브라우저에서는 확인할 수 없습니다. 최신 크롬·엣지·사파리로 열어 주세요.';
        okBtn.disabled = false; return;
      }
      okBtn.disabled = false;
      if (!ok) { msg.textContent = '비밀번호가 틀렸습니다.'; input.select(); return; }
      dlg.close(); onSuccess();
    };
    dlg.showModal(); input.focus();
  }

  // 어느 페이지든 '관리자' 링크를 누르면 팝업부터
  document.addEventListener('click', ev => {
    const a = ev.target.closest && ev.target.closest('a[href="admin.html"]');
    if (!a) return;
    ev.preventDefault();
    if (onAdmin) return;   // 이미 관리자 화면 안이면 아무것도 하지 않음(잠겨 있으면 팝업이 이미 떠 있음)
    popup(() => {
      try { sessionStorage.setItem(PASS_KEY, String(Date.now())); } catch (e) { /* 무시 */ }
      location.href = a.href;
    });
  });

  // admin.html 주소로 바로 들어온 경우
  if (onAdmin) {
    if (takePass()) document.body.classList.remove('admin-locked');
    else popup(() => document.body.classList.remove('admin-locked'));
  }
})();
