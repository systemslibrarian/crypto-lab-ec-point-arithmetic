// Panel 3 — Scalar multiplication. k·P two ways: naive repeated addition (the
// definition) and double-and-add (why it's efficient). Step through either and
// watch the operation count diverge — k−1 additions vs ~log₂k. Both costs are
// shown side by side at all times, since that gap is the whole lesson.

import { scalarMulDoubleAndAdd, scalarMulNaive, type ScalarStep } from '../math/curve-fp';
import { FP_PRESETS, type FpPreset } from '../math/curves';
import { renderLattice, type Highlight } from '../render/field-grid';
import type { FpPoint } from '../math/types';
import { el, palette } from './dom';

const bitLen = (k: bigint) => (k <= 0n ? 0 : k.toString(2).length);
const popcount = (k: bigint) => (k <= 0n ? 0 : (k.toString(2).match(/1/g)?.length ?? 0));

export function panelScalar(): HTMLElement {
  let preset: FpPreset = FP_PRESETS[0];
  let method: 'naive' | 'dbladd' = 'dbladd';
  let k = 9n;
  let steps: ScalarStep[] = [];
  let cursor = 0; // how many steps revealed (0 = not started yet)
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
  const resultCard = el('div', { class: 'result-card', role: 'status', 'aria-live': 'polite' });
  const bitTape = el('div', { class: 'bit-tape' });
  const compare = el('div', { class: 'compare' });
  const traceBox = el('div', { class: 'trace' });
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
        `k = ${k} is too large for repeated addition (it would take ${k} steps) — that is exactly ` +
          `the lesson. Double-and-add needs only about ${bitLen(k) + popcount(k)} operations.`,
      );
    } else {
      steps =
        method === 'naive'
          ? scalarMulNaive(preset.curve, k, G)
          : scalarMulDoubleAndAdd(preset.curve, k, G);
    }
    cursor = 0; // start in the neutral "ready" state — never show a half-built accumulator as the answer
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
    if (cursor >= steps.length) cursor = 0; // replay from the start
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

  const complete = () => steps.length > 0 && cursor >= steps.length;
  function currentResult(): FpPoint {
    if (!cursor) return null;
    return steps[cursor - 1].result;
  }

  function renderResultCard() {
    if (!preset.G) {
      resultCard.className = 'result-card';
      resultCard.replaceChildren(el('span', { class: 'dim' }, ['This curve has no generator.']));
      return;
    }
    if (cursor === 0) {
      resultCard.className = 'result-card ready';
      resultCard.replaceChildren(
        el('span', { class: 'rc-label' }, ['Ready']),
        el('span', {}, [`Press Step or Show all to compute ${k} · G.`]),
      );
    } else if (!complete()) {
      resultCard.className = 'result-card progress';
      resultCard.replaceChildren(
        el('span', { class: 'rc-label' }, ['current accumulator']),
        el('span', { class: 'mono' }, [ptStr(currentResult())]),
      );
    } else {
      resultCard.className = 'result-card done';
      resultCard.replaceChildren(
        el('span', { class: 'res-icon' }, ['✓']),
        el('span', { class: 'rc-label' }, [`${k} · G =`]),
        el('span', { class: 'mono' }, [ptStr(currentResult())]),
      );
    }
  }

  function renderBitTape() {
    bitTape.replaceChildren();
    if (method !== 'dbladd' || k <= 0n) {
      bitTape.hidden = true;
      return;
    }
    bitTape.hidden = false;
    const bits = k.toString(2);
    // Bits are consumed MSB→LSB, one per 'double' op. Count doublings revealed.
    const doublesSoFar = steps.slice(0, cursor).filter((s) => s.op === 'double').length;
    bitTape.append(el('span', { class: 'bt-label' }, ['k in binary:']));
    for (let i = 0; i < bits.length; i++) {
      const cls =
        i < doublesSoFar - 1 ? 'bt-bit done' : i === doublesSoFar - 1 ? 'bt-bit cur' : 'bt-bit';
      bitTape.append(el('span', { class: cls }, [bits[i]]));
    }
  }

  function renderCompare() {
    // Always show BOTH costs for the current k, so the gap is on screen even
    // while only one method animates. Live progress counts the selected method.
    const naiveOps = k > 0n ? k - 1n : 0n; // additions to add G to itself k−1 times
    const dblD = BigInt(bitLen(k));
    const dblA = BigInt(Math.max(0, popcount(k) - 1)); // first 1-bit needs no add
    const dblTotal = dblD + dblA;

    const liveAdds = steps.slice(0, cursor).filter((s) => s.op === 'add').length;
    const liveDbls = steps.slice(0, cursor).filter((s) => s.op === 'double').length;

    const card = (title: string, cost: string, live: string | null, selected: boolean) =>
      el('div', { class: selected ? 'cmp-card sel' : 'cmp-card' }, [
        el('div', { class: 'cmp-title' }, [title]),
        el('div', { class: 'cmp-cost mono' }, [cost]),
        live ? el('div', { class: 'cmp-live' }, [live]) : '',
      ]);

    compare.replaceChildren(
      card(
        'Repeated addition',
        `${fmtBig(naiveOps)} additions`,
        method === 'naive' ? `${liveAdds} done` : null,
        method === 'naive',
      ),
      card(
        'Double-and-add',
        `${dblD} doublings + ${dblA} adds = ${dblTotal} ops`,
        method === 'dbladd' ? `${liveDbls} dbl, ${liveAdds} add done` : null,
        method === 'dbladd',
      ),
    );
  }

  function render() {
    // Trace list.
    traceBox.replaceChildren(
      ...steps.slice(0, cursor).map((s, i) => {
        const label =
          s.op === 'double'
            ? `${i + 1}. double${s.bit !== undefined ? ` (bit ${s.bit})` : ''}`
            : `${i + 1}. add G`;
        return el('div', { class: i === cursor - 1 ? 'trace-row cur' : 'trace-row' }, [
          el('span', { class: 'mono' }, [label]),
          el('span', { class: 'mono dim' }, [ptStr(s.result)]),
        ]);
      }),
    );

    renderResultCard();
    renderBitTape();
    renderCompare();

    // Lattice (only for small, plottable curves).
    if (preset.plottable) {
      canvas.hidden = false;
      const pal = palette();
      const hl: Highlight[] = [];
      if (preset.G) hl.push({ point: preset.G, color: pal.accent2, label: 'G' });
      const res = currentResult();
      if (res) hl.push({ point: res, color: pal.success, label: complete() ? `${k}·G` : 'acc' });
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

  // One-click edge-case examples for scalar multiplication.
  const examples = el('div', { class: 'chips' }, [
    chip('k = 0 → O', () => setK(0n)),
    chip('k = order → O', () => {
      if (preset.order) setK(preset.order);
    }),
    chip('k = order + 1 → G', () => {
      if (preset.order) setK(preset.order + 1n);
    }),
  ]);
  function setK(v: bigint) {
    kInput.value = v.toString();
    recompute();
  }

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
        resultCard,
        bitTape,
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
        examples,
        compare,
        warn,
        traceBox,
      ]),
    ]),
  ]);

  requestAnimationFrame(() => recompute());
  return section;
}

function chip(label: string, onClick: () => void): HTMLElement {
  return el('button', { class: 'chip-btn', type: 'button', onclick: onClick }, [label]);
}

/** Compact big-number formatting for the cost comparison (e.g. ~2¹²⁸). */
function fmtBig(n: bigint): string {
  if (n < 100000n) return n.toString();
  const bits = n.toString(2).length;
  return `~2^${bits - 1}`;
}

function ptStr(p: FpPoint): string {
  if (!p) return 'O (∞)';
  const x = p.x.toString();
  const y = p.y.toString();
  const short = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s);
  return `(${short(x)}, ${short(y)})`;
}
