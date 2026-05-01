/**
 * 把 samples/ 下的 3 篇长样本一键导入 PocketBase
 *
 * 用法（PowerShell / bash）：
 *   PB_EMAIL=admin@example.com PB_PASSWORD=xxx npx tsx scripts/seed-samples.ts
 *
 * 可选环境变量：
 *   PB_URL       默认 https://db.91917788.xyz
 *   DRY_RUN=1    只解析、不写入（验证 frontmatter / 连接）
 *   FORCE=1      已存在同 slug 时覆盖（默认跳过）
 *
 * 解析规则：每个 .md 顶部是 blockquote 形式的字段指引，独立 `---` 分隔后是正文。
 *   > - **type**: article
 *   > - **title**: ...
 *   ---
 *   [content here]
 */
import PocketBase from 'pocketbase';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PB_URL = process.env.PB_URL || 'https://db.91917788.xyz';
const PB_EMAIL = process.env.PB_EMAIL;
const PB_PASSWORD = process.env.PB_PASSWORD;
const DRY_RUN = process.env.DRY_RUN === '1';
const FORCE = process.env.FORCE === '1';

if (!DRY_RUN && (!PB_EMAIL || !PB_PASSWORD)) {
  console.error('缺少 PB_EMAIL / PB_PASSWORD 环境变量。');
  console.error('用法：PB_EMAIL=... PB_PASSWORD=... npx tsx scripts/seed-samples.ts');
  console.error('或 DRY_RUN=1 仅解析样本：DRY_RUN=1 npx tsx scripts/seed-samples.ts');
  process.exit(1);
}

interface SampleMeta { [key: string]: string }

function parseSample(filePath: string): { meta: SampleMeta; content: string } {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  // 找第一个独立的 `---` 作为 frontmatter / 正文的分隔
  let dividerIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { dividerIdx = i; break; }
  }
  if (dividerIdx === -1) throw new Error(`No --- divider in ${filePath}`);

  const top = lines.slice(0, dividerIdx).join('\n');
  const content = lines.slice(dividerIdx + 1).join('\n').trim();

  // 解析 blockquote 里的 `> - **key**: value`
  const meta: SampleMeta = {};
  const re = /^>\s*-\s*\*\*(\w+)\*\*\s*:\s*(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(top)) !== null) {
    meta[m[1]] = m[2].trim();
  }
  return { meta, content };
}

async function ensureNotExists(
  pb: PocketBase,
  collection: string,
  slug: string
): Promise<{ exists: boolean; id?: string }> {
  try {
    const r = await pb.collection(collection).getFirstListItem(`slug = "${slug}"`);
    return { exists: true, id: r.id };
  } catch {
    return { exists: false };
  }
}

async function upsertPost(pb: PocketBase, sample: { meta: SampleMeta; content: string }) {
  const { meta, content } = sample;
  const data: Record<string, unknown> = {
    type: meta.type,
    title: meta.title,
    slug: meta.slug,
    tag: meta.tag,
    emoji: meta.emoji,
    excerpt: meta.excerpt,
    content,
    is_published: meta.is_published === 'true',
  };

  const existing = await ensureNotExists(pb, 'posts', meta.slug);
  if (existing.exists && !FORCE) {
    console.log(`  ⏭  posts/${meta.slug} 已存在，跳过（FORCE=1 可覆盖）`);
    return;
  }
  if (existing.exists && FORCE) {
    await pb.collection('posts').update(existing.id!, data);
    console.log(`  ✓ 已覆盖 posts/${meta.slug}`);
    return;
  }

  // 优先带 type 创建；如果 PB schema 还没加 type 字段就回退
  try {
    await pb.collection('posts').create(data);
    console.log(`  ✓ 已创建 posts/${meta.slug} (type=${meta.type})`);
  } catch (e: any) {
    if (e?.status === 400) {
      const fallback = { ...data };
      delete fallback.type;
      await pb.collection('posts').create(fallback);
      console.log(`  ⚠ 已创建 posts/${meta.slug}（schema 没有 type 字段，已回退）`);
    } else {
      throw e;
    }
  }
}

async function upsertDiary(pb: PocketBase, sample: { meta: SampleMeta; content: string }) {
  const { meta, content } = sample;
  const data: Record<string, unknown> = {
    title: meta.title,
    slug: meta.slug,
    mood: meta.mood,
    weather: meta.weather,
    date: meta.date,
    content,
    is_public: meta.is_public === 'true',
  };

  const existing = await ensureNotExists(pb, 'diaries', meta.slug);
  if (existing.exists && !FORCE) {
    console.log(`  ⏭  diaries/${meta.slug} 已存在，跳过（FORCE=1 可覆盖）`);
    return;
  }
  if (existing.exists && FORCE) {
    await pb.collection('diaries').update(existing.id!, data);
    console.log(`  ✓ 已覆盖 diaries/${meta.slug}`);
    return;
  }

  await pb.collection('diaries').create(data);
  console.log(`  ✓ 已创建 diaries/${meta.slug}`);
}

// 文章类样本（samples/ 下所有 type=article 或 type=note 的文件）
const POST_SAMPLES = [
  'samples/article-sample.md',
  'samples/note-sample.md',
  'samples/webhook-auto-deploy.md',
  'samples/vaultwarden-deploy.md',
  'samples/xanmod-bbrv3.md',
];
const DIARY_SAMPLES = [
  'samples/diary-sample.md',
];

async function main() {
  const root = resolve(process.cwd());

  const postPaths = POST_SAMPLES.map(p => join(root, p));
  const diaryPaths = DIARY_SAMPLES.map(p => join(root, p));
  const allPaths = [...postPaths, ...diaryPaths];

  for (const p of allPaths) {
    if (!existsSync(p)) {
      console.error(`找不到样本文件：${p}`);
      process.exit(1);
    }
  }

  const posts = postPaths.map(parseSample);
  const diaries = diaryPaths.map(parseSample);

  console.log('解析结果：');
  for (const s of posts) {
    console.log(`  [${s.meta.type || 'post'}] ${s.meta.slug} | 字数 = ${s.content.length}`);
  }
  for (const s of diaries) {
    console.log(`  [diary]  ${s.meta.slug} | 字数 = ${s.content.length}`);
  }

  if (DRY_RUN) {
    console.log('\nDRY_RUN=1，不写入 PB，退出。');
    return;
  }

  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  console.log(`\n登录 PB（${PB_URL}）…`);
  await pb.collection('_superusers').authWithPassword(PB_EMAIL!, PB_PASSWORD!);
  console.log('登录成功。\n');

  console.log('写入：');
  for (const s of posts) await upsertPost(pb, s);
  for (const s of diaries) await upsertDiary(pb, s);

  console.log('\n完成。访问：');
  for (const s of posts) {
    const section = s.meta.type === 'note' ? 'notes' : 'articles';
    console.log(`  /${section}/${s.meta.slug}`);
  }
  for (const s of diaries) {
    console.log(`  /diary/${s.meta.slug}`);
  }
  console.log('\n提示：dev 服务有 5 分钟内存缓存。强刷或 GET /api/invalidate-cache 立即生效。');
}

main().catch((e) => {
  console.error('失败：', e?.message || e);
  if (e?.response) console.error('PB 响应：', e.response);
  process.exit(1);
});
