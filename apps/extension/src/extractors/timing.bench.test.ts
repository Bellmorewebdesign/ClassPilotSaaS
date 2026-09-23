import { Window } from 'happy-dom';
import { describe, expect, it, vi } from 'vitest';
import { awaitReady } from './readiness.js';

const COURSE = 'Njk5MjMxMjM';

/** Per-navigation cost on a page that is ready but never stops mutating. */
describe('sync cost on a live-like page', () => {
  async function measure(label: string, html: string, url: string, target: never, churnMs: number) {
    vi.useRealTimers();
    const w = new Window();
    vi.stubGlobal('MutationObserver', w.MutationObserver);
    const doc = w.document as unknown as Document;
    doc.body.innerHTML = html + '<div id="n"></div>';
    const n = doc.getElementById('n')!;
    let i = 0;
    const churn = setInterval(() => {
      n.setAttribute('role', i++ % 2 ? 'presentation' : 'none');
      n.append(doc.createElement('span'));
    }, churnMs);

    const t0 = Date.now();
    const r = await awaitReady(doc, () => url, target, { settleMs: 400, timeoutMs: 20_000 });
    const ms = Date.now() - t0;
    clearInterval(churn);
    vi.unstubAllGlobals();
    console.log(`  ${label.padEnd(24)} ${r.state.padEnd(8)} ${String(ms).padStart(5)}ms  (${r.mutations} mutations)`);
    return ms;
  }

  it('costs hundreds of milliseconds per navigation, not the full timeout', async () => {
    const times = [
      await measure('home (7 classes)', `<main>${Array.from({ length: 7 }, (_, i) => `<a href="/c/${COURSE}${i}">C</a>`).join('')}</main>`, 'https://classroom.google.com/h', 'home' as never, 16),
      await measure('classwork (12 items)', `<main>${Array.from({ length: 12 }, (_, i) => `<a href="/c/${COURSE}/a/NTQzMjE5O${i}/details">A</a>`).join('')}</main>`, `https://classroom.google.com/w/${COURSE}/t/all`, 'classwork' as never, 16),
      await measure('assignment detail', '<main><h1>Titration Lab</h1></main>', `https://classroom.google.com/c/${COURSE}/a/NTQzMjE5OA/details`, 'assignment' as never, 16),
      await measure('stream', '<main><div role="article">Quiz Friday</div></main>', `https://classroom.google.com/c/${COURSE}`, 'stream' as never, 16),
      await measure('very chatty (4ms churn)', `<main><a href="/c/${COURSE}">C</a></main>`, 'https://classroom.google.com/h', 'home' as never, 4),
    ];
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`\n  mean ${Math.round(mean)}ms/navigation -> a 55-navigation sync ~= ${(((mean + 600) * 55) / 60000).toFixed(1)} min`);
    console.log(`  before the fix each navigation cost the full 20000ms -> ~19 min\n`);
    expect(mean).toBeLessThan(1500);
  }, 60_000);
});
