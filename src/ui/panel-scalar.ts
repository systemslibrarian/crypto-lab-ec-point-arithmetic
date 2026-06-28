// Panel 3 — Scalar multiplication. k·P two ways: naive repeated addition (the
// definition) and double-and-add (why it's efficient). Step through either and
// watch the operation count diverge — k−1 additions vs ~log₂k.

import { scalarMulDoubleAndAdd, scalarMulNaive, type ScalarStep } from '../math/curve-fp';
import { FP_PRESETS, type FpPreset } from '../math/curves';
import { renderLattice, type Highlight } from '../render/field-grid';
import type { FpPoint } from '../math/types';
import { el, palette } from './dom';

export function panelScalar(): HTMLElement {
  let preset: FpPreset = FP_PRESETS[0];
  let method: 'naive' | 'dbladd' = 'dbladd';
  let k = 9n;
  let steps: ScalarStep[] = [];
  let cursor = 0; // how many steps revealed
  let timer: ReturnType<typeof setInterval> | null = null;

  const presetSel = el(
    'select',
    { 'aria-label': 'Curve' },
    FP_PRESETS.map((p, i) => el('option', { value: String(i) }, [p.label])),
  ) as HTMLSelectElement;

  const kInput = el('input', {
    type: 'text',
    value: '9',
    'aria-label': 'Scalar k',
    inputmode: 'numeric',
  }) as HTMLInputElement;

  const methodSel = el('select', { 'aria-label': 'Method' }, [
    el('option', { value: 'dbladd' }, ['Double-and-add (efficient)']),
    el('option', { value: 'naive' }, ['Repeated addition (definition)']),
  ]) as HTMLSelectElement;
  methodSel.value = 'dbladd';

  const canvas = el('canvas', { class: 'grid-canvas' });
  const traceBox = el('div', { class: 'trace' });
  const counts = el('div', { class: 'counts' });
  const warn = el('div', { class: 'warn', hidden: true });

  const stepBtn = el('button', { class: 'btn', onclick: () => stepOnce() }, ['Step ▸']);
  const playBtn = el('button', { class: 'btn', onclick: () => togglePlay() }, ['Play ▶']);
  const resetBtn = el('button', { class: 'btn', onclick: () => recompute() }, ['↺ Reset']);
  const allBtn = el('button', { class: 'btn', onclick: () => revealAll() }, ['Show all']);

  function naiveAllowed(): boolean {
    // Repeated addition is O(k); cap it so we never freeze the page.
    return k <= 2000n;
  }

  function recompute() {
    stopPlay();
    const raw = kInput.value.trim().replace(/[^0-9]/g, '');
    k = raw ? BigInt(raw) : 0n;
    const G = preset.G;
    warn.hidden = true;
    if (!G) {
      steps = [];
    } else if (method === 'naive' && !naiveAllowed()) {
      steps = [];
      warn.hidden = false;
      warn.replaceChildren(
        el('span', { class: 'warn-icon' }, ['!']),
        `k = ${k} is too large for repeated addition (it would take ${k} steps). ` +
          'Switch to double-and-add, which needs about ' +
          `${k.toString(2).length} doublings instead.`,
      );
    } else {
      steps =
        method === 'naive'
          ? scalarMulNaive(preset.curve, k, G)
          : scalarMulDoubleAndAdd(preset.curve, k, G);
    }
    cursor = steps.length ? 1 : 0;
    render();
  }

  function stepOnce() {
    if (cursor < steps.length) cursor += 1;
    render();
  }
  function revealAll() {
    cursor = steps.length;
    render();
  }
  function togglePlay() {
    if (timer) return stopPlay();
    playBtn.textContent = 'Pause ⏸';
    timer = setInterval(() => {
      if (cursor >= steps.length) return stopPlay();
      cursor += 1;
      render();
    }, 450);
  }
  function stopPlay() {
    if (timer) clearInterval(timer);
    timer = null;
    playBtn.textContent = 'Play ▶';
  }

  function currentResult(): FpPoint {
    if (!cursor) return null;
    return steps[cursor - 1].result;
  }

  function render() {
    // Trace list.
    traceBox.replaceChildren(
      ...steps.slice(0, cursor).map((s, i) => {
        const label =
          s.op === 'double'
            ? `${i + 1}. double${s.bit !== undefined ? ` (bit ${s.bit})` : ''}`
            : `${i + 1}. add P`;
        return el('div', { class: i === cursor - 1 ? 'trace-row cur' : 'trace-row' }, [
          el('span', { class: 'mono' }, [label]),
          el('span', { class: 'mono dim' }, [ptStr(s.result)]),
        ]);
      }),
    );

    // Counts.
    const adds = steps.slice(0, cursor).filter((s) => s.op === 'add').length;
    const doubles = steps.slice(0, cursor).filter((s) => s.op === 'double').length;
    counts.replaceChildren(
      el('div', { class: 'count-card' }, [el('b', {}, [String(doubles)]), ' doublings']),
      el('div', { class: 'count-card' }, [el('b', {}, [String(adds)]), ' additions']),
      el('div', { class: 'count-card accent' }, [
        el('b', {}, [`${k} · G`]),
        ' = ',
        el('span', { class: 'mono' }, [ptStr(currentResult())]),
      ]),
    );

    // Lattice (only for small, plottable curves).
    if (preset.plottable) {
      canvas.hidden = false;
      const pal = palette();
      const hl: Highlight[] = [];
      if (preset.G) hl.push({ point: preset.G, color: pal.accent2, label: 'G' });
      const res = currentResult();
      if (res) hl.push({ point: res, color: pal.success, label: `${k}·G` });
      requestAnimationFrame(() => renderLattice(canvas, preset.curve, hl));
    } else {
      canvas.hidden = true;
    }

    stepBtn.toggleAttribute('disabled', cursor >= steps.length);
  }

  presetSel.addEventListener('change', () => {
    preset = FP_PRESETS[Number(presetSel.value)];
    recompute();
  });
  methodSel.addEventListener('change', () => {
    method = methodSel.value as 'naive' | 'dbladd';
    recompute();
  });
  kInput.addEventListener('change', () => recompute());

  const section = el('section', { class: 'panel', id: 'scalar' }, [
    el('h2', {}, ['3 · Scalar multiplication: k · P']),
    el('p', { class: 'lede' }, [
      'Scalar multiplication is just adding a point to itself k times. Doing it ',
      el('em', {}, ['naively']),
      ' takes k−1 additions. ',
      el('em', {}, ['Double-and-add']),
      ' reaches the same point in about log₂k steps — the gap between these two is exactly why ECC is practical.',
    ]),
    el('div', { class: 'panel-body' }, [
      el('div', { class: 'canvas-wrap' }, [
        canvas,
        counts,
        el('div', { class: 'control-row' }, [stepBtn, playBtn, allBtn, resetBtn]),
      ]),
      el('div', { class: 'aside' }, [
        el('div', { class: 'control-row' }, [
          el('label', { class: 'field' }, [el('span', {}, ['Curve']), presetSel]),
        ]),
        el('div', { class: 'control-row' }, [
          el('label', { class: 'field' }, [el('span', {}, ['Method']), methodSel]),
          el('label', { class: 'field small' }, [el('span', {}, ['k']), kInput]),
        ]),
        warn,
        traceBox,
      ]),
    ]),
  ]);

  requestAnimationFrame(() => recompute());
  return section;
}

function ptStr(p: FpPoint): string {
  if (!p) return 'O (∞)';
  const x = p.x.toString();
  const y = p.y.toString();
  const short = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s);
  return `(${short(x)}, ${short(y)})`;
}
