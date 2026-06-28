// Tiny DOM helpers — no framework, just terse element construction.

type Attrs = Record<string, string | number | boolean | EventListener>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (typeof v === 'boolean') {
      if (v) node.setAttribute(k, '');
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of children) node.append(c);
  return node;
}

/** Observe size changes, no-op where ResizeObserver is unavailable (e.g. jsdom). */
export function onResize(target: Element, cb: () => void): void {
  if (typeof ResizeObserver === 'undefined') return;
  new ResizeObserver(cb).observe(target);
}

/** Resolve the current theme palette from CSS variables (so canvas tracks theme). */
export function palette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    accent: v('--accent', '#9f88ff'),
    accent2: v('--accent-2', '#35d6bb'),
    ink: v('--text', '#e8edf2'),
    muted: v('--text-muted', '#8a97a6'),
    grid: v('--grid', '#243140'),
    axis: v('--axis', '#3a4a5c'),
    curve: v('--curve', '#c7d2dd'),
    success: v('--success', '#4ade80'),
    panel: v('--panel', '#141b22'),
  };
}
