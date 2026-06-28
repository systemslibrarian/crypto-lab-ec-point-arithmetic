// Panel 2 — Point Addition (the core interaction).
//
// Over ℝ: drag P and Q; the chord/tangent, third intersection, reflection, and
// the algebra (λ, x₃, y₃) all update in the same frame. Over 𝔽_p: click two
// lattice points; the SAME formulas run exactly in BigInt. One toggle switches
// worlds, so "the geometry and the algebra are one group" lands without a second
// mental model.

import { addConstruction, isSingular, rhs } from '../math/curve-real';
import { add as fpAdd, enumeratePoints, isOnCurve } from '../math/curve-fp';
import { FP_PRESETS, REAL_PRESETS, realPointAtX, type FpPreset } from '../math/curves';
import { mod, modInv } from '../math/field';
import { FieldGridRenderer } from '../render/field-grid';
import { PlaneRenderer } from '../render/plane';
import type { FpCurve, FpPoint, RealConstruction, RealCurve, RealPoint } from '../math/types';
import { el, onResize } from './dom';

const fmt = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(3);

// Only the plottable finite-field curves are interactive here.
const FP_PLOTTABLE = FP_PRESETS.filter((p) => p.plottable);

export function panelAdd(): HTMLElement {
  // ── Real-world state ──────────────────────────────────────────────────────
  let realIdx = 0;
  let realCurve: RealCurve = REAL_PRESETS[realIdx].curve;
  let P: RealPoint = realPointAtX(realCurve, REAL_PRESETS[realIdx].suggestedX[0]);
  let Q: RealPoint = realPointAtX(realCurve, REAL_PRESETS[realIdx].suggestedX[1]);
  let doubling = false;
  let showInverse = false;
  let dragging: 'p' | 'q' | null = null;

  // ── Finite-field state ────────────────────────────────────────────────────
  let fpIdx = 0;
  let fpCurve: FpCurve = FP_PLOTTABLE[fpIdx].curve;
  let fpP: FpPoint = FP_PLOTTABLE[fpIdx].G ?? null;
  let fpQ: FpPoint = null;
  let nextClick: 'p' | 'q' = 'q';

  let mode: 'real' | 'fp' = 'real';

  // ── DOM ───────────────────────────────────────────────────────────────────
  const realCanvas = el('canvas', {
    class: 'curve-canvas',
    tabindex: '0',
    role: 'img',
    'aria-label':
      'Elliptic curve over the reals. Drag points P and Q, or use arrow keys, to compute their sum. The result is reported in text below.',
  });
  // aria-live so screen readers announce the recomputed sum as points move.
  const realReadout = el('div', { class: 'readout', role: 'status', 'aria-live': 'polite' });
  const fpCanvas = el('canvas', {
    class: 'grid-canvas',
    role: 'img',
    'aria-label': 'Finite-field point lattice. Use the P and Q menus to choose points.',
  });
  const fpReadout = el('div', { class: 'readout', role: 'status', 'aria-live': 'polite' });

  // Keyboard-accessible point pickers for the 𝔽ₚ lattice (equivalent to clicking).
  const fpSelP = el('select', { 'aria-label': 'Point P' }) as HTMLSelectElement;
  const fpSelQ = el('select', { 'aria-label': 'Point Q' }) as HTMLSelectElement;

  const curveSelectReal = el(
    'select',
    { 'aria-label': 'Real teaching curve' },
    REAL_PRESETS.map((p, i) => el('option', { value: String(i) }, [p.label])),
  ) as HTMLSelectElement;

  const curveSelectFp = el(
    'select',
    { 'aria-label': 'Finite-field curve' },
    FP_PLOTTABLE.map((p, i) => el('option', { value: String(i) }, [p.label])),
  ) as HTMLSelectElement;

  const realView = el('div', { class: 'mode-view' });
  const fpView = el('div', { class: 'mode-view', hidden: true });

  let plane: PlaneRenderer | null = null;
  let grid: FieldGridRenderer | null = null;

  // ── Real rendering / interaction ──────────────────────────────────────────
  function realConstruction(): RealConstruction {
    return addConstruction(realCurve, P, doubling && P ? { ...P } : Q);
  }

  function drawReal() {
    if (!plane) return;
    const c = realConstruction();
    plane.draw({ construction: c, dragging, showInverse });
    realReadout.replaceChildren(renderRealReadout(realCurve, c));
  }

  function constrainToCurve(x: number, signY: number): RealPoint {
    const [x0, x1] = REAL_PRESETS[realIdx].xRange;
    const cx = Math.max(x0, Math.min(x1, x));
    const r = rhs(realCurve, cx);
    if (r < 0) return null;
    return { x: cx, y: signY >= 0 ? Math.sqrt(r) : -Math.sqrt(r) };
  }

  function pointerMove(clientX: number) {
    if (!plane || !dragging) return;
    const rect = realCanvas.getBoundingClientRect();
    const wx = plane.toWorldX(clientX - rect.left);
    const cur = dragging === 'p' ? P : Q;
    const sign = cur ? Math.sign(cur.y) || 1 : 1;
    const moved = constrainToCurve(wx, sign);
    if (!moved) return;
    if (dragging === 'p') P = moved;
    else Q = moved;
    drawReal();
  }

  realCanvas.addEventListener('pointerdown', (e) => {
    if (!plane) return;
    const rect = realCanvas.getBoundingClientRect();
    const hit = plane.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    // In doubling mode only P is draggable.
    dragging = doubling ? (hit ? 'p' : null) : hit;
    if (dragging) {
      realCanvas.setPointerCapture(e.pointerId);
      drawReal();
    }
  });
  realCanvas.addEventListener('pointermove', (e) => pointerMove(e.clientX));
  realCanvas.addEventListener('pointerup', () => {
    dragging = null;
    drawReal();
  });
  realCanvas.addEventListener('keydown', (e) => {
    const target = e.shiftKey && !doubling ? 'q' : 'p';
    const cur = target === 'p' ? P : Q;
    if (!cur) return;
    const stepPx = 6;
    const dx = e.key === 'ArrowLeft' ? -stepPx : e.key === 'ArrowRight' ? stepPx : 0;
    if (dx === 0) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Flip branch.
        const flipped = constrainToCurve(cur.x, -Math.sign(cur.y) || 1);
        if (flipped) {
          if (target === 'p') P = flipped;
          else Q = flipped;
          drawReal();
        }
        e.preventDefault();
      }
      return;
    }
    if (!plane) return;
    const worldStep = dx / 60;
    const moved = constrainToCurve(cur.x + worldStep, Math.sign(cur.y) || 1);
    if (moved) {
      if (target === 'p') P = moved;
      else Q = moved;
      drawReal();
    }
    e.preventDefault();
  });

  // ── Finite-field interaction ──────────────────────────────────────────────
  // The lattice (mouse) and the P/Q <select>s (keyboard) are two views of the
  // same fpP/fpQ state, kept in sync so the demo is fully keyboard-operable.
  let fpPoints: FpPoint[] = enumeratePoints(fpCurve);

  const fpPointLabel = (pt: FpPoint) => (pt ? `(${pt.x}, ${pt.y})` : 'O (∞)');
  const indexOfPoint = (pt: FpPoint) =>
    fpPoints.findIndex((q) =>
      q === null ? pt === null : pt !== null && q.x === pt.x && q.y === pt.y,
    );

  function populateFpSelects() {
    fpPoints = enumeratePoints(fpCurve);
    for (const sel of [fpSelP, fpSelQ]) {
      sel.replaceChildren(
        ...fpPoints.map((pt, i) => el('option', { value: String(i) }, [fpPointLabel(pt)])),
      );
    }
    syncFpSelects();
  }
  function syncFpSelects() {
    const ip = indexOfPoint(fpP);
    const iq = indexOfPoint(fpQ);
    if (ip >= 0) fpSelP.value = String(ip);
    if (iq >= 0) fpSelQ.value = String(iq);
  }

  function drawFp() {
    if (!grid) return;
    const c = fpConstruction(fpCurve, fpP, fpQ);
    grid.draw({ p: fpP, q: fpQ, sum: c.sum, thirdIntersection: c.third });
    fpReadout.replaceChildren(renderFpReadout(fpCurve, fpP, fpQ));
  }

  fpSelP.addEventListener('change', () => {
    fpP = fpPoints[Number(fpSelP.value)] ?? null;
    drawFp();
  });
  fpSelQ.addEventListener('change', () => {
    fpQ = fpPoints[Number(fpSelQ.value)] ?? null;
    drawFp();
  });

  fpCanvas.addEventListener('pointerdown', (e) => {
    if (!grid) return;
    const rect = fpCanvas.getBoundingClientRect();
    const hit = grid.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;
    if (nextClick === 'p') {
      fpP = hit;
      nextClick = 'q';
    } else {
      fpQ = hit;
      nextClick = 'p';
    }
    syncFpSelects();
    drawFp();
  });

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggle = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Arithmetic world' }, [
    segButton('Over ℝ (geometry)', true, () => switchMode('real')),
    segButton('Over 𝔽ₚ (real crypto)', false, () => switchMode('fp')),
  ]);

  function switchMode(m: 'real' | 'fp') {
    mode = m;
    realView.hidden = m !== 'real';
    fpView.hidden = m !== 'fp';
    for (const [i, btn] of Array.from(toggle.children).entries()) {
      const on = (i === 0) === (m === 'real');
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', String(on));
    }
    requestAnimationFrame(() => {
      if (m === 'real') {
        plane?.resize();
        drawReal();
      } else {
        grid?.resize();
        drawFp();
      }
    });
  }

  curveSelectReal.addEventListener('change', () => {
    realIdx = Number(curveSelectReal.value);
    realCurve = REAL_PRESETS[realIdx].curve;
    if (isSingular(realCurve)) return; // presets are nonsingular; guard anyway
    P = realPointAtX(realCurve, REAL_PRESETS[realIdx].suggestedX[0]);
    Q = realPointAtX(realCurve, REAL_PRESETS[realIdx].suggestedX[1]);
    plane?.setCurve(realCurve, REAL_PRESETS[realIdx].xRange);
    drawReal();
  });

  curveSelectFp.addEventListener('change', () => {
    fpIdx = Number(curveSelectFp.value);
    const preset: FpPreset = FP_PLOTTABLE[fpIdx];
    fpCurve = preset.curve;
    fpP = preset.G ?? null;
    fpQ = null;
    nextClick = 'q';
    grid?.setCurve(fpCurve);
    populateFpSelects();
    drawFp();
  });

  const doubleChk = checkbox('Doubling (P = Q): drag P, add it to itself', (on) => {
    doubling = on;
    dragging = null;
    drawReal();
  });
  const inverseChk = checkbox('Show −P (the reflection)', (on) => {
    showInverse = on;
    drawReal();
  });

  const randomBtn = el('button', { class: 'btn', onclick: randomizeReal }, ['🎲 Randomize']);
  const resetBtn = el('button', { class: 'btn', onclick: resetReal }, ['↺ Reset']);
  const invBtn = el('button', { class: 'btn', onclick: showVerticalDemo }, ['Show P + (−P) = O']);

  function randomizeReal() {
    P = randomOnCurve();
    Q = randomOnCurve();
    drawReal();
  }
  function resetReal() {
    P = realPointAtX(realCurve, REAL_PRESETS[realIdx].suggestedX[0]);
    Q = realPointAtX(realCurve, REAL_PRESETS[realIdx].suggestedX[1]);
    doubling = false;
    (doubleChk.querySelector('input') as HTMLInputElement).checked = false;
    drawReal();
  }
  function showVerticalDemo() {
    doubling = false;
    (doubleChk.querySelector('input') as HTMLInputElement).checked = false;
    if (P) Q = { x: P.x, y: -P.y };
    drawReal();
  }
  function randomOnCurve(): RealPoint {
    const [x0, x1] = REAL_PRESETS[realIdx].xRange;
    for (let i = 0; i < 64; i += 1) {
      const x = x0 + Math.random() * (x1 - x0);
      const r = rhs(realCurve, x);
      if (r >= 0) return { x, y: (Math.random() < 0.5 ? 1 : -1) * Math.sqrt(r) };
    }
    return realPointAtX(realCurve, (x0 + x1) / 2);
  }

  const fpHint = el('p', { class: 'hint' }, [
    'Click a lattice point (it fills P, then Q), or pick P and Q from the menus below — both work with the keyboard.',
  ]);
  const fpPickers = el('div', { class: 'control-row' }, [
    labelled('P', fpSelP),
    labelled('Q', fpSelQ),
  ]);

  // ── Assemble ──────────────────────────────────────────────────────────────
  realView.append(
    el('div', { class: 'panel-body' }, [
      el('div', { class: 'canvas-wrap' }, [
        realCanvas,
        el('p', { class: 'hint' }, [
          'Drag P or Q along the curve. Keyboard: focus the canvas, ← → move P (Shift for Q), ↑↓ flip branch.',
        ]),
      ]),
      el('div', { class: 'aside' }, [
        el('div', { class: 'control-row' }, [labelled('Curve', curveSelectReal)]),
        el('div', { class: 'control-row' }, [randomBtn, resetBtn, invBtn]),
        doubleChk,
        inverseChk,
        realReadout,
      ]),
    ]),
  );

  fpView.append(
    el('div', { class: 'panel-body' }, [
      el('div', { class: 'canvas-wrap' }, [fpCanvas, fpHint]),
      el('div', { class: 'aside' }, [
        el('div', { class: 'control-row' }, [labelled('Curve', curveSelectFp)]),
        fpPickers,
        el('p', { class: 'note' }, [
          'Same group law — but every coordinate is reduced mod p, so the smooth curve becomes a ',
          'scatter of points and the “line” wraps around. The algebra below is identical to the ℝ case.',
        ]),
        fpReadout,
      ]),
    ]),
  );

  const section = el('section', { class: 'panel', id: 'add' }, [
    el('h2', {}, ['2 · Point addition: the chord-and-tangent rule']),
    el('p', { class: 'lede' }, [
      'To add P and Q: draw the line through them, find where it meets the curve a third time, ',
      'and reflect that point across the x-axis. That reflection is ',
      el('code', {}, ['P + Q']),
      '. When P = Q, the “line” is the tangent. Try it:',
    ]),
    toggle,
    realView,
    fpView,
    el('p', { class: 'whatisnt' }, [
      'What this isn’t: key exchange or a full ECDLP solver — see ',
      el('a', { href: 'https://systemslibrarian.github.io/crypto-lab-curve-lens/' }, [
        'Curve Lens',
      ]),
      '.',
    ]),
  ]);

  requestAnimationFrame(() => {
    plane = new PlaneRenderer(realCanvas, realCurve, REAL_PRESETS[realIdx].xRange);
    grid = new FieldGridRenderer(fpCanvas, fpCurve);
    populateFpSelects();
    drawReal();
    drawFp();
    onResize(section, () => {
      if (mode === 'real') {
        plane?.resize();
        drawReal();
      } else {
        grid?.resize();
        drawFp();
      }
    });
  });

  return section;
}

// ── Finite-field construction + readouts ──────────────────────────────────────

function fpConstruction(curve: FpCurve, P: FpPoint, Q: FpPoint): { sum: FpPoint; third: FpPoint } {
  if (!P || !Q) return { sum: null, third: null };
  const sum = fpAdd(curve, P, Q);
  const third = sum ? { x: sum.x, y: mod(-sum.y, curve.p) } : null;
  return { sum, third };
}

function renderFpReadout(curve: FpCurve, P: FpPoint, Q: FpPoint): HTMLElement {
  if (!P || !Q) {
    return el('div', { class: 'readout-inner' }, [
      el('p', { class: 'muted' }, ['Pick points P and Q on the lattice.']),
    ]);
  }
  if (!isOnCurve(curve, P) || !isOnCurve(curve, Q)) {
    return el('div', { class: 'readout-inner' }, [el('p', {}, ['Point is not on the curve.'])]);
  }
  const { p, a } = curve;
  const rows: (Node | string)[] = [dl('P', `(${P.x}, ${P.y})`), dl('Q', `(${Q.x}, ${Q.y})`)];

  if (P.x === Q.x && mod(P.y + Q.y, p) === 0n) {
    rows.push(
      resultRow(
        'P + Q = O',
        'The vertical line has no third point — the sum is the point at infinity.',
      ),
    );
    return el('div', { class: 'readout-inner' }, rows);
  }

  let lambda: bigint;
  if (P.x === Q.x && P.y === Q.y) {
    lambda = mod((3n * P.x * P.x + a) * modInv(2n * P.y, p), p);
    rows.push(dl('λ (tangent)', `(3·${P.x}² + ${a}) · (2·${P.y})⁻¹ mod ${p} = ${lambda}`));
  } else {
    lambda = mod((Q.y - P.y) * modInv(Q.x - P.x, p), p);
    rows.push(dl('λ (chord)', `(${Q.y} − ${P.y}) · (${Q.x} − ${P.x})⁻¹ mod ${p} = ${lambda}`));
  }
  const x3 = mod(lambda * lambda - P.x - Q.x, p);
  const y3 = mod(lambda * (P.x - x3) - P.y, p);
  rows.push(dl('x₃', `λ² − x_P − x_Q mod ${p} = ${x3}`));
  rows.push(dl('y₃', `λ(x_P − x₃) − y_P mod ${p} = ${y3}`));
  rows.push(resultRow(`P + Q = (${x3}, ${y3})`));
  return el('div', { class: 'readout-inner' }, rows);
}

function renderRealReadout(curve: RealCurve, c: RealConstruction): HTMLElement {
  const rows: (Node | string)[] = [];
  if (c.p) rows.push(dl('P', `(${fmt(c.p.x)}, ${fmt(c.p.y)})`));
  if (c.kind !== 'double' && c.q) rows.push(dl('Q', `(${fmt(c.q.x)}, ${fmt(c.q.y)})`));

  if (c.kind === 'identity') {
    rows.push(
      resultRow('P + O = P', 'O is the identity: adding the point at infinity changes nothing.'),
    );
  } else if (c.kind === 'vertical') {
    rows.push(
      resultRow(
        'P + Q = O',
        'P and Q are reflections, so the line is vertical and meets the curve at no third affine point. The sum is the point at infinity O.',
      ),
    );
  } else if (c.lambda !== null && c.p && c.sum) {
    if (c.kind === 'double') {
      rows.push(dl('λ (tangent)', `(3·x_P² + a) / (2·y_P) = ${fmt(c.lambda)}`));
    } else if (c.q) {
      rows.push(dl('λ (chord)', `(y_Q − y_P) / (x_Q − x_P) = ${fmt(c.lambda)}`));
    }
    rows.push(dl('x₃', `λ² − x_P − x_Q = ${fmt(c.sum.x)}`));
    rows.push(dl('y₃', `λ(x_P − x₃) − y_P = ${fmt(c.sum.y)}`));
    rows.push(resultRow(`P + Q = (${fmt(c.sum.x)}, ${fmt(c.sum.y)})`));
  }
  return el('div', { class: 'readout-inner' }, rows);
}

// ── Small DOM builders ────────────────────────────────────────────────────────

function dl(term: string, value: string): HTMLElement {
  return el('div', { class: 'dl' }, [
    el('span', { class: 'dt' }, [term]),
    el('span', { class: 'dd mono' }, [value]),
  ]);
}
function resultRow(text: string, note?: string): HTMLElement {
  return el('div', { class: 'result' }, [
    el('span', { class: 'res-icon' }, ['✓']),
    el('div', {}, [
      el('div', { class: 'res-main mono' }, [text]),
      note ? el('div', { class: 'res-note' }, [note]) : '',
    ]),
  ]);
}
function labelled(text: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'field' }, [el('span', {}, [text]), control]);
}
function checkbox(label: string, onChange: (on: boolean) => void): HTMLElement {
  const input = el('input', {
    type: 'checkbox',
    onchange: (e) => onChange((e.target as HTMLInputElement).checked),
  });
  return el('label', { class: 'check' }, [input, label]);
}
function segButton(label: string, on: boolean, onClick: () => void): HTMLElement {
  return el(
    'button',
    {
      class: on ? 'seg-btn on' : 'seg-btn',
      role: 'tab',
      'aria-selected': String(on),
      onclick: onClick,
    },
    [label],
  );
}
