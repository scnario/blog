import PocketBase from 'pocketbase';

declare global {
  interface Window {
    __PB_URL__?: string;
  }
}

const PB_URL = window.__PB_URL__ || import.meta.env.PUBLIC_PB_URL || 'https://db.91917788.xyz';

export const pb = new PocketBase(PB_URL);

type FormElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type UnknownRecord = Record<string, unknown>;

export function $(id: string) {
  return document.getElementById(id);
}

export function val(id: string): string {
  const el = $(id) as FormElement | null;
  return el ? el.value : '';
}

export function checked(id: string): boolean {
  const el = $(id) as HTMLInputElement | null;
  return el ? el.checked : false;
}

export function setVal(id: string, v: unknown) {
  const el = $(id) as FormElement | null;
  if (el) el.value = String(v ?? '');
}

export function setChecked(id: string, v: boolean) {
  const el = $(id) as HTMLInputElement | null;
  if (el) el.checked = !!v;
}

export function status(id: string, msg: string, kind: 'success' | 'error' | 'pending' | '' = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'muted ' + (kind ? 'status-' + kind : '');
}

export function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1] ?? '') : null;
}

export function setCookie(name: string, value: string, days = 365) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${days * 86400}; SameSite=Lax`;
}

export function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

/**
 * 让 SSR 端的 5 分钟缓存立刻失效，下一次刷新立即取到 PB 最新值
 * 不阻塞 UI，失败也不影响保存成功的语义
 */
export async function bustCache() {
  try {
    // GET 简单可靠（Astro 默认 CSRF 会拒非 JSON POST）；端点支持两种方法
    await fetch('/api/invalidate-cache?t=' + Date.now(), { method: 'GET' });
  } catch { /* 没事 */ }
}

export async function fetchPostsByType(kind: 'article' | 'note') {
  try {
    const filter = kind === 'note' ? "type = 'note'" : "type = 'article' || type = ''";
    return await pb.collection('posts').getList(1, 50, { sort: '-created', filter });
  } catch {
    // schema 没 type 字段：article tab 全显示，note tab 空
    if (kind === 'article') {
      return await pb.collection('posts').getList(1, 50, { sort: '-created' });
    }
    return { items: [] };
  }
}

let currentSettingsId: string | null = null;

export function getCurrentSettingsId() {
  return currentSettingsId;
}

export function setCurrentSettingsId(id: string | null) {
  currentSettingsId = id;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

export function isUnknownFieldError(error: unknown, field: string) {
  const message = errorMessage(error);
  return new RegExp(`unknown field|${field}`, 'i').test(message);
}

export function escapeHtml(s: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return (s || '').replace(/[&<>"']/g, c => entities[c] ?? c);
}

function stringValue(record: UnknownRecord, key: string, fallback = ''): string {
  const value = record[key];
  return typeof value === 'string' ? value : fallback;
}

const sidecarCounts = { posts: 0, notes: 0, diaries: 0 };

export function updateSidecar(next: Partial<typeof sidecarCounts>) {
  Object.assign(sidecarCounts, next);
  const total = sidecarCounts.posts + sidecarCounts.notes + sidecarCounts.diaries;
  const totalEl = $('sidecar-total');
  const postsEl = $('sidecar-posts');
  const notesEl = $('sidecar-notes');
  if (totalEl) totalEl.textContent = String(total);
  if (postsEl) postsEl.textContent = String(sidecarCounts.posts);
  if (notesEl) notesEl.textContent = String(sidecarCounts.notes);
  const activity = $('sidecar-activity');
  if (activity) {
    activity.innerHTML = [
      ['post', `${sidecarCounts.posts} 篇文章可管理`, 'now'],
      ['note', `${sidecarCounts.notes} 条便签笔记`, 'now'],
      ['diary', `${sidecarCounts.diaries} 篇日记记录`, 'now'],
      ['theme', '全局变量写入 settings 表', 'live'],
    ].map(([who, text, when], i) => `
      <div class="ed-c-act"><span class="dot" style="background:${['#B8311E','#A78BFA','#6EE7B7','#FBBF24'][i]}"></span><div><span class="who">${who}</span> ${text}</div><span class="when">${when}</span></div>
    `).join('');
  }
}

export async function loadSettings() {
  try {
    const result = await pb.collection('settings').getList(1, 1, { sort: '-created' });
    const r = result.items[0] as UnknownRecord | undefined;
    if (r) {
      setCurrentSettingsId(stringValue(r, 'id'));
      setVal('set-nickname', r.nickname);
      setVal('set-tagline', r.tagline);
      setVal('set-bio', r.bio);
      setVal('set-github', r.social_github);
      setVal('set-email', r.social_email);
      setVal('set-music-url', r.music_url);
      setVal('set-music-title', r.music_title);
      setVal('set-music-artist', r.music_artist);
      setVal('set-theme-color', r.theme_color || '#A8E6CF');
      setVal('set-glass-opacity', r.glass_opacity ?? 0.8);
      setVal('set-glass-blur', r.glass_blur ?? 10);
      setVal('set-toc-blur', r.toc_text_blur ?? 5);
      setChecked('set-particles', !!r.particles_enabled);
      setVal('set-visual-paper', r.visual_paper || '#F8F4EC');
      setVal('set-visual-ink', r.visual_ink || '#1A1814');
      setVal('set-visual-mint', r.visual_mint || '#A8E6CF');
      setVal('set-visual-coral', r.visual_coral || '#FFCCBC');
      setVal('set-visual-lilac', r.visual_lilac || '#E0BBE4');
      setVal('set-visual-cream', r.visual_cream || '#FFE082');
      setVal('set-visual-dot-size', r.visual_dot_size ?? 24);
      setVal('set-visual-shadow', r.visual_shadow || '4px 4px 0 #1A1814');
      setVal('set-console-accent', r.console_accent || '#B8311E');
      // 主题
      const radio = document.querySelector<HTMLInputElement>(`input[name="active-theme"][value="${stringValue(r, 'active_theme', 'bento')}"]`);
      if (radio) radio.checked = true;
      // 布局预设
      const layout = r.bento_layout as UnknownRecord | undefined;
      const preset = (layout && stringValue(layout, 'preset')) || stringValue(r, 'bento_layout_preset', 'default');
      const presetRadio = document.querySelector<HTMLInputElement>(`input[name="bento-preset"][value="${preset}"]`);
      if (presetRadio) presetRadio.checked = true;
      const sideTheme = $('sidecar-theme');
      if (sideTheme) sideTheme.textContent = stringValue(r, 'active_theme', 'bento-webui');
    }
  } catch {
    // 表不存在，由用户首次保存创建
  }
}

export function refreshCookieTheme() {
  const el = $('cookie-theme-current');
  if (el) el.textContent = getCookie('site_theme') || '(未设置)';
}

type ConsoleLoader = () => Promise<void> | void;
type ConsoleLoaderWindow = Window & { __consoleLoaders?: Record<string, ConsoleLoader> };

export function registerConsoleLoader(name: string, loader: ConsoleLoader) {
  const target = window as ConsoleLoaderWindow;
  target.__consoleLoaders = target.__consoleLoaders || {};
  target.__consoleLoaders[name] = loader;
}

export async function runConsoleLoaders() {
  const loaders = (window as ConsoleLoaderWindow).__consoleLoaders || {};
  await Promise.allSettled([
    loaders.posts?.(),
    loaders.notes?.(),
    loaders.diary?.(),
    loadSettings(),
    refreshCookieTheme(),
  ]);
}
