/* 관리자 화면 잠금: 비밀번호를 맞게 넣어야 화면이 보임.
 * 비밀번호 원문은 저장하지 않고, 솔트를 붙여 여러 번 섞은 값(PBKDF2-SHA256)만 비교함.
 * 비밀번호를 바꾸려면 운영가이드 '관리자 비밀번호 바꾸기'를 보세요. */
(() => {
  const SALT = 'b79d2add7fd4a87ebd5dbf93cf849eab';
  const ITER = 310000;
  const HASH = '95719ef553e861cf89d9ab28297decfbf1c29222291ae54d8ca4be8909b56e05';
  const OK_KEY = 'ojt-admin-ok';
  const unlock = () => document.body.classList.remove('admin-locked');
  try { if (sessionStorage.getItem(OK_KEY) === HASH) { unlock(); return; } } catch (e) { /* 무시 */ }

  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  async function derive(pw) {
    const salt = new Uint8Array(SALT.match(/../g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256));
  }

  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-pw');
  const msg = document.getElementById('gate-msg');
  const btn = form.querySelector('button');
  input.focus();
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!input.value) { msg.textContent = '비밀번호를 입력해 주세요.'; return; }
    btn.disabled = true; msg.textContent = '확인 중…';
    try {
      if (await derive(input.value) === HASH) {
        try { sessionStorage.setItem(OK_KEY, HASH); } catch (e) { /* 무시 */ }
        unlock();
      } else {
        msg.textContent = '비밀번호가 맞지 않습니다.';
        input.select();
      }
    } catch (e) {
      msg.textContent = '이 브라우저에서는 확인할 수 없습니다. 최신 크롬·엣지·사파리로 열어 주세요.';
    }
    btn.disabled = false;
  });
})();
