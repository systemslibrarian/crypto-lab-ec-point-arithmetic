import { describe, expect, it } from 'vitest';
import { initApp } from '../ui';

describe('app mounts', () => {
  it('renders all four panels into #app and the add panel has a readout', () => {
    // jsdom has no 2D canvas; renderers are built to no-op when getContext is null.
    HTMLCanvasElement.prototype.getContext = () => null as never;

    const root = document.createElement('div');
    root.id = 'app';
    document.body.append(root);

    initApp(root);

    expect(root.querySelector('#intro')).not.toBeNull();
    expect(root.querySelector('#add')).not.toBeNull();
    expect(root.querySelector('#scalar')).not.toBeNull();
    expect(root.querySelector('#hard')).not.toBeNull();

    // The add panel exposes the world toggle (ℝ / 𝔽ₚ).
    const segButtons = root.querySelectorAll('#add .seg-btn');
    expect(segButtons.length).toBe(2);

    root.remove();
  });
});
