// Panel 4 — Why reversing is hard (ECDLP intuition).
//
// Computing Q = k·G is fast (Panel 3). Going backwards — recover k from G and Q —
// is the elliptic-curve discrete logarithm problem. This panel builds the
// intuition by walking the subgroup and showing how the multiples scatter, then
// contrasts the toy order with secp256k1's ~2²⁵⁶. It is deliberately NOT a real
// solver — Curve Lens does that; here we only make the difficulty felt.

import { add as fpAdd } from '../math/curve-fp';
import { TOY_FP_97 } from '../math/curves';
import { renderLattice, type Highlight } from '../render/field-grid';
import type { FpPoint } from '../math/types';
import { el, palette } from './dom';

export function panelHard(): HTMLElement {
  const preset = TOY_FP_97;
  const curve = preset.curve;
  const G = preset.G!;
  const order = preset.order!; // 99

  let secret = 37n; // hidden k
  let target: FpPoint = mul(secret); // Q = k·G
  let n = 0n;
  let acc: FpPoint = null;
  let revealed = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  function mul(k: bigint): FpPoint {
    let r: FpPoint = null;
    for (let i = 0n; i < k; i += 1n) r = fpAdd(curve, r, G);
    return r;
  }

  const canvas = el('canvas', { class: 'grid-canvas' });
  const status = el('div', { class: 'ecdlp-status' });

  const walkBtn = el('button', { class: 'btn', onclick: toggleWalk }, ['Walk the subgroup ▶']);
  const newBtn = el('button', { class: 'btn', onclick: newTarget }, ['🎲 New secret']);
  const stepBtn = el('button', { class: 'btn', onclick: stepWalk }, ['Step ▸']);

  function newTarget() {
    stop();
    // A fresh secret in [1, order). Deterministic-free: any value works.
    secret = 1n + BigInt(Math.floor(Math.random() * Number(order - 1n)));
    target = mul(secret);
    n = 0n;
    acc = null;
    revealed = false;
    render();
  }

  function stepWalk() {
    if (revealed) return;
    n += 1n;
    acc = fpAdd(curve, acc, G);
    if (acc && target && acc.x === target.x && acc.y === target.y) {
      revealed = true;
      stop();
    }
    if (n >= order) {
      stop();
    }
    render();
  }

  function toggleWalk() {
    if (timer) return stop();
    walkBtn.textContent = 'Pause ⏸';
    timer = setInterval(() => {
      stepWalk();
      if (revealed || n >= order) stop();
    }, 140);
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    walkBtn.textContent = 'Walk the subgroup ▶';
  }

  function render() {
    const pal = palette();
    const hl: Highlight[] = [
      { point: G, color: pal.accent2, label: 'G' },
      { point: target, color: pal.success, label: 'Q' },
    ];
    if (acc && !(acc.x === G.x && acc.y === G.y)) {
      hl.push({ point: acc, color: pal.accent, label: `${n}·G`, ring: true });
    }
    requestAnimationFrame(() => renderLattice(canvas, curve, hl));

    const rows: (Node | string)[] = [
      el('p', {}, [
        'Public: the generator ',
        el('b', { class: 'tag-g' }, ['G']),
        ' and the point ',
        el('b', { class: 'tag-q' }, ['Q = k·G']),
        '. The secret is the multiplier ',
        el('code', {}, ['k']),
        '. Recovering it is the ECDLP.',
      ]),
    ];
    if (revealed) {
      rows.push(
        el('p', { class: 'found' }, [
          el('span', { class: 'res-icon' }, ['✓']),
          ` Found after ${n} steps: k = ${n}. On this toy curve (order ${order}) brute force is trivial.`,
        ]),
      );
    } else if (n > 0n) {
      rows.push(
        el('p', { class: 'mono dim' }, [`Tried ${n} / ${order} multiples — no match yet.`]),
      );
    }
    status.replaceChildren(...rows);
    stepBtn.toggleAttribute('disabled', revealed);
  }

  const table = el('table', { class: 'cmp' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', {}, ['Curve']),
        el('th', {}, ['Subgroup order n']),
        el('th', {}, ['Best generic attack ≈ √n']),
      ]),
    ]),
    el('tbody', {}, [
      el('tr', {}, [
        el('td', {}, ['toy 𝔽₉₇']),
        el('td', { class: 'mono' }, ['99']),
        el('td', { class: 'mono' }, ['≈ 10 steps']),
      ]),
      el('tr', {}, [
        el('td', {}, ['secp256k1']),
        el('td', { class: 'mono' }, ['≈ 2²⁵⁶']),
        el('td', { class: 'mono' }, ['≈ 2¹²⁸ steps']),
      ]),
    ]),
  ]);

  const section = el('section', { class: 'panel', id: 'hard' }, [
    el('h2', {}, ['4 · Why you can’t go backwards (ECDLP)']),
    el('p', { class: 'lede' }, [
      'Forward (k → Q) is a handful of doublings. Backward (Q → k) means searching the subgroup. ',
      'Watch the multiples scatter with no pattern to exploit — then look at the numbers.',
    ]),
    el('div', { class: 'panel-body' }, [
      el('div', { class: 'canvas-wrap' }, [
        canvas,
        el('div', { class: 'control-row' }, [walkBtn, stepBtn, newBtn]),
      ]),
      el('div', { class: 'aside' }, [
        status,
        table,
        el('p', { class: 'note' }, [
          'Baby-step/giant-step and Pollard’s rho cut brute force from n to about √n — still ',
          el('b', {}, ['~2¹²⁸']),
          ' operations on secp256k1, far beyond any computer. Doubling the field size squares the work.',
        ]),
        el('p', { class: 'whatisnt' }, [
          'What this isn’t: an actual discrete-log solver. To brute-force a real (small) instance, see ',
          el('a', { href: 'https://systemslibrarian.github.io/crypto-lab-curve-lens/' }, [
            'Curve Lens',
          ]),
          '.',
        ]),
      ]),
    ]),
  ]);

  requestAnimationFrame(render);
  return section;
}
