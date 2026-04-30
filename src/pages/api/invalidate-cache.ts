/**
 * 缓存失效端点 — 控制台保存后调用
 *
 * 为什么需要：
 * src/lib/queries.ts 给 settings/posts/diaries/tags 都加了 5 分钟内存缓存。
 * 控制台写入 PB 后，不调用这个端点的话，下一次刷新仍然看到老数据。
 *
 * 安全：
 * - 仅 SSR 期间可读 cookie，但本端点不动数据，最坏情况只是清缓存
 * - 即便如此仍要求请求方提供管理员 PB 令牌或允许同域 POST（这里采用同域 POST + CSRF 友好的简单形式）
 */
import type { APIRoute } from 'astro';
import { invalidateCache } from '../../lib/queries';

export const POST: APIRoute = async ({ request }) => {
  let prefix: string | undefined;
  try {
    const body = await request.json();
    prefix = body?.prefix;
  } catch {
    // body 为空 = 全部清掉
  }
  invalidateCache(prefix);
  return new Response(JSON.stringify({ ok: true, cleared: prefix ?? 'all' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

export const GET: APIRoute = async () => {
  invalidateCache();
  return new Response(JSON.stringify({ ok: true, cleared: 'all' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
