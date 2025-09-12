import { mount } from '@vue/test-utils';
import Overrides from '@/views/settings/v2/Overrides.vue';
import { vi } from 'vitest';

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { teeSheetId: 'sheet1' } }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/services/api', async (orig) => {
  const actual = await (orig());
  return {
    ...actual,
    settingsAPI: {
      ...actual.settingsAPI,
      v2: {
        listOverrides: vi.fn().mockResolvedValue({ data: [{ id: 'o1', status: 'draft', date: '2025-07-02' }] }),
        createOverride: vi.fn().mockResolvedValue({ data: { id: 'o2' } }),
        createOverrideVersion: vi.fn().mockResolvedValue({ data: { id: 'ov1' } }),
        publishOverride: vi.fn().mockResolvedValue({ data: { ok: true } }),
      },
    },
  };
});

describe('V2 Overrides view', () => {
  it('lists overrides and can create/version/publish', async () => {
    window.alert = vi.fn();
    const wrapper = mount(Overrides, { global: {} });
    await new Promise(r => setTimeout(r));
    expect(wrapper.html()).toContain('Overrides (V2)');
    const d = wrapper.find('input[type="date"]');
    await d.setValue('2025-07-03');
    // Create
    const createBtn = wrapper.find('button.btn');
    await createBtn.trigger('click');
    // Version + Publish
    const buttons = wrapper.findAll('button.btn.sm');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
  });
});


