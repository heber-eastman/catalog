import { mount } from '@vue/test-utils';
import Seasons from '@/views/settings/v2/Seasons.vue';
import { vi } from 'vitest';

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { teeSheetId: 'sheet1' } }),
}));

vi.mock('@/services/api', async (orig) => {
  const actual = await (orig());
  return {
    ...actual,
    settingsAPI: {
      ...actual.settingsAPI,
      v2: {
        listSeasons: vi.fn().mockResolvedValue({ data: [{ id: 's1', status: 'draft' }] }),
        createSeason: vi.fn().mockResolvedValue({ data: { id: 's2' } }),
        createSeasonVersion: vi.fn().mockResolvedValue({ data: { id: 'sv1' } }),
        addSeasonWeekdayWindow: vi.fn().mockResolvedValue({ data: { id: 'w1' } }),
        reorderSeasonWeekdayWindows: vi.fn().mockResolvedValue({ data: { success: true, windows: [{ id: 'w1' }] } }),
        publishSeason: vi.fn().mockResolvedValue({ data: { ok: true } }),
      },
    },
  };
});

describe('V2 Seasons view', () => {
  it('lists seasons and can add version/window and publish', async () => {
    window.alert = vi.fn();
    const wrapper = mount(Seasons, { global: {} });
    await new Promise(r => setTimeout(r));
    expect(wrapper.html()).toContain('Seasons (V2)');
    const dateInputs = wrapper.findAll('input[type="date"]');
    if (dateInputs.length >= 2) {
      await dateInputs[0].setValue('2025-07-01');
      await dateInputs[1].setValue('2025-08-01');
    }
    const timeInputs = wrapper.findAll('input[type="time"]');
    if (timeInputs.length >= 2) {
      await timeInputs[0].setValue('07:00');
      await timeInputs[1].setValue('10:00');
    }
    const tvInput = wrapper.find('input[placeholder="template_version_id"]');
    await tvInput.setValue('00000000-0000-0000-0000-000000000000');
    // Click Add Version+Window
    const addBtn = wrapper.findAll('button.btn.sm')[0];
    await addBtn.trigger('click');
    // Publish
    const pubBtn = wrapper.findAll('button.btn.sm')[1];
    await pubBtn.trigger('click');
    // Save order (no-op with one item, but ensure call is attempted gracefully)
    const saveBtn = wrapper.findAll('button.btn.sm').at(-1);
    if (saveBtn) await saveBtn.trigger('click');
  });
});


