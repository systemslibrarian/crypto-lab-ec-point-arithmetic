// Panel 1 — Introduction. The Weierstrass equation, a static look at one smooth
// curve over the reals, and the one-sentence bridge to finite fields.

import { PlaneRenderer } from '../render/plane';
import { REAL_PRESETS, realPointAtX } from '../math/curves';
import { addConstruction } from '../math/curve-real';
import { el, onResize } from './dom';

export function panelIntro(): HTMLElement {
  const preset = REAL_PRESETS[0];
  const canvas = el('canvas', { class: 'curve-canvas', 'aria-hidden': 'true' });

  const section = el('section', { class: 'panel', id: 'intro' }, [
    el('h2', {}, ['1 · What an elliptic curve is']),
    el('p', { class: 'lede' }, [
      'An elliptic curve in short Weierstrass form is the set of points (x, y) satisfying ',
      el('code', {}, ['y² = x³ + ax + b']),
      ', together with one extra point ',
      el('code', {}, ['O']),
      ' — the “point at infinity”. The remarkable fact is that these points form a ',
      el('strong', {}, ['group']),
      ': there is a way to “add” any two points and get a third point on the same curve. ',
      'This whole demo is about that one operation.',
    ]),
    el('div', { class: 'panel-body' }, [
      el('div', { class: 'canvas-wrap' }, [canvas]),
      el('div', { class: 'aside' }, [
        el('p', {}, [
          'The curve is symmetric across the x-axis, so each point ',
          el('code', {}, ['P']),
          ' has a mirror ',
          el('code', {}, ['−P']),
          '. That symmetry is what makes the group law work.',
        ]),
        el('p', { class: 'note' }, [
          'Real cryptography uses elliptic curves over a ',
          el('strong', {}, ['finite field']),
          '. The addition formulas have the same form, evaluated mod a prime ',
          el('code', {}, ['p']),
          '. The next panel lets you compare these different groups, one smooth and one finite.',
        ]),
      ]),
    ]),
    el('p', { class: 'note' }, [
      'Sources: ',
      el('a', { href: 'https://www.secg.org/sec1-v2.pdf' }, [
        'SEC 1, version 2.0, §§2.2.1 and 3.2.1 (2009)',
      ]),
      '; ',
      el('a', { href: 'https://link.springer.com/book/10.1007/978-3-662-69007-9' }, [
        'Paar, Pelzl, and Güneysu, Understanding Cryptography, 2nd ed. (2024), ch. 9',
      ]),
      '.',
    ]),
  ]);

  // Draw once mounted (needs layout for sizing).
  requestAnimationFrame(() => {
    const renderer = new PlaneRenderer(canvas, preset.curve, preset.xRange);
    const p = realPointAtX(preset.curve, preset.suggestedX[0]);
    const q = realPointAtX(preset.curve, preset.suggestedX[1]);
    renderer.draw({ construction: addConstruction(preset.curve, p, q) });
    onResize(canvas, () => {
      renderer.resize();
      renderer.draw({ construction: addConstruction(preset.curve, p, q) });
    });
  });

  return section;
}
