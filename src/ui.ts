// Assembles the four panels into the page. The shared header, theme toggle, and
// scripture footer are added later by the Parts 0 + A–E standardization pass —
// not here.

import { panelAdd } from './ui/panel-add';
import { panelHard } from './ui/panel-hard';
import { panelIntro } from './ui/panel-intro';
import { panelScalar } from './ui/panel-scalar';
import { el } from './ui/dom';

export function initApp(root: HTMLElement): void {
  // A plain <div>, not <header>: the shared topbar is the page's single banner
  // landmark, so this intro block must not also be one.
  const head = el('div', { class: 'page-head' }, [
    el('h1', {}, ['Elliptic Curve Point Arithmetic']),
    el('p', { class: 'tagline' }, [
      'The geometric group law over the reals, and the identical algebra over a finite field — ',
      'point addition and scalar multiplication, made visible.',
    ]),
  ]);

  root.append(head, panelIntro(), panelAdd(), panelScalar(), panelHard());
}
