'use strict';

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: [
        { id: 'tt1', start_time: new Date().toISOString(), capacity: 4, remaining: 2 },
      ],
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

import TeeSheet from '@/views/TeeSheet.vue';

describe('TeeSheet unit', () => {
  it('shows chips after load', async () => {
    window.localStorage.setItem('teeSheet:lastSheet', 'sheet1');
    const wrapper = mount(TeeSheet);
    await new Promise(r => setTimeout(r, 0));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.chip').exists()).toBe(true);
  });
});


