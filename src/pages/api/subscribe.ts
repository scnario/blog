/**
 * 邮件订阅 API — POST { email } -> 转发到 SUBSCRIBE_PROVIDER 对应的上游。
 *
 * 支持的 provider：
 *  - 'buttondown' (推荐，最简单)：SUBSCRIBE_API_KEY 必填
 *  - 'resend'    : SUBSCRIBE_API_KEY + SUBSCRIBE_LIST_ID
 *  - 'mailchimp' : SUBSCRIBE_API_KEY + SUBSCRIBE_LIST_ID（API key 中需带 -us21 之类的 dc 后缀）
 *  - 'pb'        : 写入 PocketBase 的 subscribers 表，等同于自建（无需 API key）
 *
 * 没配置 provider 时返回 503，前端展示「订阅暂未开放」并提示走 RSS。
 *
 * 反垃圾：
 *  - 内存级 60s/IP rate limit（多实例下不够，但够个人博客）
 *  - email 必须语法合法 + 长度 < 254
 *  - honeypot 字段 `_hp` 若有值则视作机器人，静默返回 204
 */
import type { APIRoute } from 'astro';
import pb from '../../lib/pb';

const HITS = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  // 清扫过期项，避免内存无限增长
  for (const [k, t] of HITS) if (now - t > RATE_LIMIT_MS) HITS.delete(k);
  const hit = HITS.get(ip);
  if (hit && now - hit < RATE_LIMIT_MS) return true;
  HITS.set(ip, now);
  return false;
}

function validEmail(s: string): boolean {
  if (!s || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress || 'unknown';
  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ ok: false, error: '请稍后再试' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: '请求体无效' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // honeypot — 真用户拿不到的字段，被填了就当机器人
  if (typeof body._hp === 'string' && body._hp.length > 0) {
    return new Response(null, { status: 204 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!validEmail(email)) {
    return new Response(JSON.stringify({ ok: false, error: '邮箱格式不正确' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const provider = process.env.SUBSCRIBE_PROVIDER;
  const apiKey = process.env.SUBSCRIBE_API_KEY;
  const listId = process.env.SUBSCRIBE_LIST_ID;

  if (!provider) {
    return new Response(JSON.stringify({ ok: false, error: '订阅暂未开放，欢迎用 RSS' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    if (provider === 'buttondown') {
      if (!apiKey) throw new Error('SUBSCRIBE_API_KEY 未设置');
      const r = await fetch('https://api.buttondown.email/v1/subscribers', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_address: email }),
      });
      // 200/201 = 新增，409 = 已订阅，都视作成功
      if (!r.ok && r.status !== 409) {
        const msg = await r.text().catch(() => '');
        throw new Error(`buttondown ${r.status}: ${msg.slice(0, 120)}`);
      }
    } else if (provider === 'resend') {
      if (!apiKey || !listId) throw new Error('SUBSCRIBE_API_KEY / LIST_ID 未设置');
      const r = await fetch(`https://api.resend.com/audiences/${listId}/contacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      });
      if (!r.ok && r.status !== 409) {
        const msg = await r.text().catch(() => '');
        throw new Error(`resend ${r.status}: ${msg.slice(0, 120)}`);
      }
    } else if (provider === 'mailchimp') {
      if (!apiKey || !listId) throw new Error('SUBSCRIBE_API_KEY / LIST_ID 未设置');
      // mailchimp api key 末尾的 -us21 是 datacenter，必须从中提取
      const dc = apiKey.split('-').pop();
      if (!dc) throw new Error('mailchimp API key 缺少 datacenter 后缀');
      const r = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_address: email, status: 'pending' }), // pending = double opt-in
      });
      if (!r.ok && r.status !== 400) { // 400 通常是已订阅
        const msg = await r.text().catch(() => '');
        throw new Error(`mailchimp ${r.status}: ${msg.slice(0, 120)}`);
      }
    } else if (provider === 'pb') {
      // 自建：写到 PocketBase subscribers 表（需先在 PB 建表 email/created）
      try {
        await pb.collection('subscribers').create({ email });
      } catch (e: any) {
        // 409 / unique 冲突视作已订阅成功
        const msg = String(e?.message ?? '');
        if (!/unique|exists|409/i.test(msg)) throw e;
      }
    } else {
      throw new Error(`未知 provider: ${provider}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[subscribe] failed', e);
    return new Response(JSON.stringify({ ok: false, error: '订阅失败，请稍后再试' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};
