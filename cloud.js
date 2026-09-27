/* Optional account sync. Offline flight and local records do not depend on this file. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), cfg = window.BIRD_SUPABASE;
  const SESSION = 'candle-wings-auth-v1', prefix = 'candle-wings-account-best:';
  let session = null, epoch = 0, busy = false, syncing = false, wanted = 0, refreshPromise = null;
  const score = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  function message(text) { $('cloud-status').textContent = text; }
  function render() {
    $('auth-form').hidden = !!session; $('cloud-user').hidden = !session;
    $('cloud-name').textContent = session?.user?.user_metadata?.username || '已登录';
    $('cloud-best').textContent = String(wanted);
    $('auth-login').disabled = busy; $('auth-signup').disabled = busy; $('auth-logout').disabled = busy || syncing;
    $('cloud-sync').disabled = !session || busy || syncing;
  }
  async function request(path, method = 'GET', body, token) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const headers = { apikey: cfg.key, 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(cfg.url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const error = new Error(data.code || data.error_code || 'request_failed'); error.status = res.status; throw error; }
      return data;
    } finally { clearTimeout(timer); }
  }
  function saveSession(value) {
    session = value;
    // Keep tokens in this tab only. Passwords are never persisted.
    try { if (value) sessionStorage.setItem(SESSION, JSON.stringify(value)); else sessionStorage.removeItem(SESSION); } catch {}
  }
  async function access() {
    if (!session) throw new Error('signed_out');
    if (session.expires_at * 1000 > Date.now() + 60000) return session.access_token;
    if (!refreshPromise) {
      const generation = epoch, refreshToken = session.refresh_token;
      refreshPromise = request('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: refreshToken }).then(data => {
        if (epoch !== generation) throw new Error('signed_out');
        saveSession(data); return data.access_token;
      }).finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }
  function explain(error) {
    const labels = { account_not_found: '账号不存在', incorrect_password: '密码不正确', username_taken: '用户名已使用', rate_limited: '操作频繁，请稍后再试', invalid_username: '用户名需为 1–10 位英文字母', invalid_password: '密码需为至少 8 位数字' };
    return labels[error.message] || (error.status === 401 || error.status === 403 ? '登录已失效，请退出后重新登录' : '暂时无法连接云端，可继续本地游玩，稍后重试');
  }
  async function sync() {
    if (!session || syncing) return;
    syncing = true; const generation = epoch, userId = session.user.id; render(); message('正在同步最高分…');
    try {
      do {
        const token = await access(), user = await request('/auth/v1/user', 'GET', undefined, token);
        if (generation !== epoch || user.id !== userId) return;
        const remote = score(user.user_metadata?.bird_best_score);
        wanted = Math.max(wanted, remote, score(read(prefix + userId, 0)));
        if (wanted > remote) {
          // Only patch the bird field; never replace usernames or other games' metadata.
          const sent = wanted;
          const updated = await request('/auth/v1/user', 'PUT', { data: { bird_best_score: sent } }, token);
          if (generation !== epoch) return;
          if (score(updated.user_metadata?.bird_best_score) < sent) throw new Error('sync_failed');
          saveSession({ ...session, user: updated });
          write(prefix + userId, wanted);
          if (wanted > sent) continue;
        } else { saveSession({ ...session, user }); write(prefix + userId, wanted); }
        window.applyBirdCloudBest?.(wanted); message('云端已同步 · 最高 ' + wanted + ' 分'); break;
      } while (generation === epoch);
    } catch (error) { if (generation === epoch) message(explain(error)); }
    finally { syncing = false; render(); }
  }
  async function authenticate(kind) {
    if (busy || session) return;
    const username = $('auth-name').value.trim(), password = $('auth-password').value;
    if (!/^[A-Za-z]{1,10}$/.test(username)) return message('用户名需为 1–10 位英文字母');
    if (!/^\d{8,}$/.test(password)) return message('密码需为至少 8 位数字');
    busy = true; render(); message(kind === 'signup' ? '正在注册…' : '正在登录…');
    try {
      const result = await request('/functions/v1/auth-' + kind, 'POST', { username, password });
      if (!result.session?.user?.id || !result.session.access_token) throw new Error('invalid_session');
      epoch++; saveSession(result.session); wanted = Math.max(score(session.user.user_metadata?.bird_best_score), score(read(prefix + session.user.id, 0)));
      $('auth-password').value = ''; await sync();
    } catch (error) { message(explain(error)); }
    finally { busy = false; render(); }
  }
  window.birdCloud = { submit(value) {
    if (!session) return;
    wanted = Math.max(wanted, score(value)); write(prefix + session.user.id, wanted); render(); void sync();
  } };
  $('auth-form').addEventListener('submit', e => { e.preventDefault(); void authenticate('login'); });
  $('auth-signup').addEventListener('click', () => void authenticate('signup'));
  $('auth-panel').addEventListener('focusin', () => window.pauseBirdForAccount?.());
  $('auth-logout').addEventListener('click', async () => {
    if (syncing || busy) return;
    const old = session; epoch++; saveSession(null); wanted = 0; render(); message('已退出 · 本地游戏仍可继续');
    if (old) { try { await request('/auth/v1/logout?scope=local', 'POST', undefined, old.access_token); } catch {} }
  });
  $('cloud-sync').addEventListener('click', () => void sync());
  window.addEventListener('online', () => void sync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void sync(); });
  try { const saved = JSON.parse(sessionStorage.getItem(SESSION)); if (saved?.user?.id && saved.access_token && saved.refresh_token) session = saved; } catch {}
  if (session) { wanted = Math.max(score(session.user.user_metadata?.bird_best_score), score(read(prefix + session.user.id, 0))); void sync(); }
  render();
})();
