/**
 * OG 图片生成端点 — /og/[slug].png
 * 为每篇文章生成 1200×630 社交分享图
 */
import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getArticleBySlug, getSettings } from '../../lib/queries';

// 内存缓存：字体数据只下载一次
let _fontData: ArrayBuffer | null = null;

async function getFont(): Promise<ArrayBuffer> {
  if (_fontData) return _fontData;
  // Noto Sans SC Bold — 仅需标题用，文件较小
  const url = 'https://cdn.jsdelivr.net/npm/@aspect-build/aspect-fonts@0.1.0/NotoSansSC-Bold.ttf';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
  _fontData = await res.arrayBuffer();
  return _fontData;
}

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;
  if (!slug) return new Response('Missing slug', { status: 400 });

  const [article, settings] = await Promise.all([
    getArticleBySlug(slug),
    getSettings(),
  ]);

  if (!article) return new Response('Not found', { status: 404 });

  try {
    const fontData = await getFont();

    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            width: 1200,
            height: 630,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px 80px',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            color: '#ffffff',
            fontFamily: 'Noto Sans SC',
          },
          children: [
            // 标签
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: 22,
                  opacity: 0.85,
                },
                children: [
                  { type: 'span', props: { children: article.emoji || '📝' } },
                  { type: 'span', props: { children: article.tag || '博客', style: { padding: '4px 16px', borderRadius: 20, background: 'rgba(255,255,255,0.12)' } } },
                ],
              },
            },
            // 标题
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 52,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                  maxHeight: 220,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                },
                children: article.title,
              },
            },
            // 底部
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  fontSize: 20,
                  opacity: 0.6,
                },
                children: [
                  { type: 'span', props: { children: `${settings.nickname || 'scnario'} · 数字花园` } },
                  { type: 'span', props: { children: '🌱' } },
                ],
              },
            },
            // 底部色条
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 6,
                  background: 'linear-gradient(90deg, #e94560, #0f3460, #00b4d8)',
                },
              },
            },
          ],
        },
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Noto Sans SC',
            data: fontData,
            weight: 700,
            style: 'normal',
          },
        ],
      },
    );

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
    const png = resvg.render();
    const buffer = png.asPng();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  } catch (err) {
    console.error('[og] generation failed:', err);
    return new Response('OG generation failed', { status: 500 });
  }
};
