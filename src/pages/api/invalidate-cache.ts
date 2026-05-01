/**
 * 缓存失效端点 — 控制台保存后调用
 *
 * 为什么需要：
 * src/lib/queries.ts 给 settings/posts/diaries/tags 都加了 5 分钟内存缓存。
 * 控制台写入 PB 后，不调用这个端点的话，下一次刷新仍然看到老数据。
 *
 * 安全：
 * - 只允许同源 JSON POST，避免爬虫 / 预取 / 外站表单触发缓存清理
 * - 本端点不接触数据库，只清空进程内缓存
 */
import type { APIRoute } from 'astro';
import { invalidateCache } from '../../lib/queries';

export const POST: APIRoute = async ({ request, url }) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return json({ ok: false, error: 'application/json required' }, 415);
  }

  let prefix: string | undefined;
  try {
    const body = await request.json();
    prefix = typeof body?.prefix === 'string' ? body.prefix : undefined;
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400);
  }

  invalidateCache(prefix);
  return json({ ok: true, cleared: prefix ?? 'all' });
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
