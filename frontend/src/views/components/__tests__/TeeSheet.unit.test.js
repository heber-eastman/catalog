'use strict';

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('@/services/api', () => {
  const get = vi.fn().mockImplementation(async (url) => {
    if (url.includes('/tee-times/available')) {
      return {
        data: [
          {
            id: 'tt1',
            tee_sheet_id: 'sheet1',
            side_id: 'side1',
            start_time: new Date().toISOString(),
            capacity: 4,
            remaining: 3,
            assignments: [
              { booking_id: 'b1', customer_name: 'Rory McIlroy', leg_index: 0, booking_leg_max_index: 0 },
              null, null, null,
            ],
          },
        ],
      };
    }
    return { data: [] };
  });
  const post = vi.fn().mockResolvedValue({ data: { success: true } });
  // Provide minimal settingsAPI surface used by component
  const settingsAPI = {
    listTeeSheets: vi.fn().mockResolvedValue({ data: [{ id: 'sheet1', name: 'Main' }] }),
    listSides: vi.fn().mockResolvedValue({ data: [{ id: 'side1', name: 'Front' }] }),
  };
  return {
    default: Object.assign(get, { get, post }),
    settingsAPI,
  };
});

import TeeSheet from '@/views/TeeSheet.vue';

describe('TeeSheet unit', () => {
  it('shows chips after load', async () => {
    window.localStorage.setItem('teeSheet:lastSheet', 'sheet1');
    window.localStorage.setItem('teeSheet:viewMode', 'side1');
    const wrapper = mount(TeeSheet);
    await new Promise(r => setTimeout(r, 0));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.booking-chip').exists()).toBe(true);
  });
});


