// Assembles the four panels into the page. The shared header, theme toggle, and
// scripture footer are added later by the Parts 0 + A–E standardization pass —
// not here.

import { panelAdd } from './ui/panel-add';
import { panelHard } from './ui/panel-hard';
import { panelIntro } from './ui/panel-intro';
import { panelScalar } from './ui/panel-scalar';
import { el } from './ui/dom';

export function initApp(root: HTMLElement): void {
  // Fleet-standard hero: title block on the left, "why it matters" box on the
  // right. The shared topbar is the page's single banner landmark; this <header>
  // sits inside the <main> below, so it never maps to a second banner landmark
  // (the shared header script only demotes <header>s that are direct children
  // of <body>, which this one is not).
  const head = el('header', { class: 'cl-hero' }, [
    el('div', { class: 'cl-hero-main' }, [
      el('h1', { class: 'cl-hero-title' }, ['EC Point Arithmetic']),
      el('p', { class: 'cl-hero-sub' }, ['Group law · point addition · scalar multiplication']),
      el('p', { class: 'cl-hero-desc' }, [
        'Add points and multiply by a scalar over the real plane or a finite field 𝔽ₚ. ' +
          'The addition formulas have the same form, but these are different groups.',
      ]),
    ]),
    el('aside', { class: 'cl-hero-why', 'aria-label': 'Why it matters' }, [
      el('span', { class: 'cl-hero-why-label' }, ['WHY IT MATTERS']),
      el('p', { class: 'cl-hero-why-text' }, [
        'Elliptic-curve groups underlie ECDSA, EdDSA, and X25519, though their curve forms differ. ' +
          'Point addition can be undone when a summand is known. In a suitable large subgroup, ' +
          'recovering k from P and Q = k·P is the hard discrete-log problem (ECDLP).',
      ]),
    ]),
  ]);

  // All of the lab's own content lives in a <main> landmark (WCAG 1.3.1 /
  // 2.4.1); the scripture <footer> in index.html stays outside it.
  const main = el('main', { id: 'main-content', tabindex: '-1' }, [
    head,
    panelIntro(),
    panelAdd(),
    panelScalar(),
    panelHard(),
  ]);

  root.append(main);
}
