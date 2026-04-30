/**
 * Motion 工具层 — 浏览器侧动效统一入口
 *
 * 设计要点：
 * - 仅在浏览器执行；SSR 阶段不引入（所有 export 都假设 `window` 存在）
 * - 全部尊重 prefers-reduced-motion：命中时函数 noop，元素直接保持终态
 * - 不引入客户端框架，只用原生 IntersectionObserver + Motion One 的 animate()
 * - 已有的 `:hover { transform: ... }` CSS 不替换，本文件只补"入场"和"组合动效"
 */
import { animate, stagger } from 'motion';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface InViewStaggerOpts {
  /** 入场起点 y 偏移，默认 18 */
  y?: number;
  /** 单项相对延迟，默认 60ms */
  staggerMs?: number;
  /** 单项动画时长，默认 480ms */
  duration?: number;
  /** rootMargin，默认 0px 0px -10% 0px（提前一点触发） */
  rootMargin?: string;
}

/**
 * 让选中的一组元素在进入视口时按 stagger 入场。
 * 第一次进入触发后即取消 observe，避免来回滚动反复播放。
 *
 * 用法：
 * ```ts
 * inViewStagger('.bento-card');
 * inViewStagger(document.querySelectorAll('.list .card'), { staggerMs: 80 });
 * ```
 */
export function inViewStagger(
  target: string | NodeListOf<Element> | Element[],
  opts: InViewStaggerOpts = {}
): void {
  if (typeof window === 'undefined') return;

  const els: Element[] =
    typeof target === 'string'
      ? Array.from(document.querySelectorAll(target))
      : Array.from(target);

  if (!els.length) return;

  const {
    y = 18,
    staggerMs = 60,
    duration = 0.48,
    rootMargin = '0px 0px -10% 0px',
  } = opts;

  // reduced-motion：直接全部立刻显示，不绑 Observer
  if (prefersReducedMotion()) {
    els.forEach((el) => {
      (el as HTMLElement).style.opacity = '1';
      (el as HTMLElement).style.transform = 'none';
    });
    return;
  }

  // 先把元素藏起来（即便 SSR 没注入起始样式也保险）
  els.forEach((el) => {
    const e = el as HTMLElement;
    e.style.opacity = '0';
    e.style.transform = `translateY(${y}px)`;
    e.style.willChange = 'opacity, transform';
  });

  // 一次性触发：把同一批进入视口的元素一起 stagger
  const pending = new Set<Element>(els);
  const io = new IntersectionObserver(
    (entries) => {
      const batch: Element[] = [];
      for (const entry of entries) {
        if (entry.isIntersecting && pending.has(entry.target)) {
          batch.push(entry.target);
          pending.delete(entry.target);
          io.unobserve(entry.target);
        }
      }
      if (!batch.length) return;
      animate(
        batch,
        { opacity: [0, 1], transform: [`translateY(${y}px)`, 'translateY(0)'] },
        {
          duration,
          delay: stagger(staggerMs / 1000),
          easing: [0.2, 0.8, 0.2, 1],
        }
      ).finished.then(() => {
        batch.forEach((el) => ((el as HTMLElement).style.willChange = 'auto'));
      });
    },
    { rootMargin, threshold: 0.1 }
  );

  els.forEach((el) => io.observe(el));
}

/**
 * 简单的"按需 hoverLift" — 当 CSS 不够、需要 JS 协调多个属性时使用。
 * 当前 CSS `transform: translateY(-3px)` 已足够，本函数留作扩展点（光晕等）。
 */
export function hoverLift(_el: Element): void {
  /* placeholder for future composite hover effects */
}
