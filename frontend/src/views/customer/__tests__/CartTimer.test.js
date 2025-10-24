'use strict';

import { describe, it, expect, vi } from 'vitest';

describe('Cart hold timer', () => {
  it('computes remaining seconds from created_at', () => {
    const created = Date.now() - 120000; // 2 minutes ago
    const remaining = Math.max(0, 300 - Math.floor((Date.now() - created) / 1000));
    expect(remaining).toBeGreaterThanOrEqual(178);
    expect(remaining).toBeLessThanOrEqual(180);
  });
});


