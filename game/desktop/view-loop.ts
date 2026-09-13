import type { DesktopView, Reply } from './types';

// One shared slot also covers a read still completing after a page/scene change.
export function pollViews(read: () => Promise<Reply<DesktopView>>, slot: { current: boolean },
  apply: (view: DesktopView) => void, fail: (error: string) => void, delay = 150): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    if (stopped) return;
    if (slot.current) { timer = setTimeout(tick, delay); return; }
    slot.current = true;
    try {
      const reply = await read();
      if (stopped) return;
      if (!reply.ok) { stopped = true; fail(reply.error); return; }
      apply(reply.data);
    } catch (error) {
      if (!stopped) { stopped = true; fail(error instanceof Error ? error.message : 'GET_VIEW_FAILED'); }
    } finally {
      slot.current = false;
      if (!stopped) timer = setTimeout(tick, delay);
    }
  };
  timer = setTimeout(tick, delay);
  return () => { stopped = true; clearTimeout(timer); };
}

export function ddText(raw: string): string {
  const value = BigInt(raw), whole = value / 6n, remainder = value % 6n;
  if (!remainder) return String(whole);
  const divisor = remainder % 3n === 0n ? 3n : remainder % 2n === 0n ? 2n : 1n;
  return `${whole ? `${whole}又` : ''}${remainder / divisor}/${6n / divisor}`;
}
