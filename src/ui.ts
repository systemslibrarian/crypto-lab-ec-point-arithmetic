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
  // right. The shared topbar is the page's single banner landmark; the shared
  // header script demotes this <header> to role="group" so landmarks stay unique.
  const head = el('header', { class: 'cl-hero' }, [
    el('div', { class: 'cl-hero-main' }, [
      el('h1', { class: 'cl-hero-title' }, ['EC Point Arithmetic']),
      el('p', { class: 'cl-hero-sub' }, ['Group law · point addition · scalar multiplication']),
      el('p', { class: 'cl-hero-desc' }, [
        'Add points with the chord-and-tangent rule and multiply by a scalar, over ' +
          'the real plane and the identical algebra over a finite field 𝔽ₚ.',
      ]),
    ]),
    el('aside', { class: 'cl-hero-why', 'aria-label': 'Why it matters' }, [
      el('span', { class: 'cl-hero-why-label' }, ['WHY IT MATTERS']),
      el('p', { class: 'cl-hero-why-text' }, [
        'This one-way group law powers ECDSA, EdDSA, and X25519 — the signatures and key ' +
          'exchange securing TLS, SSH, and crypto wallets. Reversing scalar multiplication ' +
          '(ECDLP) is infeasible, so keys stay tiny yet strong.',
      ]),
    ]),
  ]);

  root.append(head, panelIntro(), panelAdd(), panelScalar(), panelHard());
}
