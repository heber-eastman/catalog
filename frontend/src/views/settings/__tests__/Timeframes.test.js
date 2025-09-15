'use strict';

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Timeframes from '@/views/settings/Timeframes.vue';

describe('Settings Timeframes', () => {
  it('validates overlap and renders bands', async () => {
    const wrapper = mount(Timeframes);
    // Default is 08:00-09:00, with existing [07:00-08:00] and [09:00-11:00]
    expect(wrapper.find('.errors').exists()).toBe(false);
    const items = wrapper.findAll('li');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].text()).toContain('08:00');

    // Cause overlap 07:30-08:30
    await wrapper.find('input[placeholder="07:00"]').setValue('07:30');
    await wrapper.find('input[placeholder="10:00"]').setValue('08:30');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.errors').text()).toMatch(/Overlaps/);
  });
});


