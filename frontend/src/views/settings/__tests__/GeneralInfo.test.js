import { mount } from '@vue/test-utils';
import GeneralInfo from '@/views/settings/v2/GeneralInfo.vue';
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
      listTeeSheets: vi.fn().mockResolvedValue({ data: [{ id: 'sheet1', name: 'Main', daily_release_local: '08:00' }] }),
      updateTeeSheet: vi.fn().mockResolvedValue({ data: { id: 'sheet1', name: 'Main', daily_release_local: '06:30' } }),
    },
  };
});

describe('GeneralInfo', () => {
  it('saves daily release time', async () => {
    const wrapper = mount(GeneralInfo, { global: {} });
    await new Promise(r => setTimeout(r));
    // Find save button
    const btns = wrapper.findAll('button');
    const saveBtn = btns.find(b => /save/i.test(b.text() || ''));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await new Promise(r => setTimeout(r));
    }
    const mod = await import('@/services/api');
    expect(mod.settingsAPI.updateTeeSheet).toHaveBeenCalled();
    const last = mod.settingsAPI.updateTeeSheet.mock.calls.at(-1);
    expect(last[1]).toMatchObject({ daily_release_local: expect.any(String) });
  });
});


