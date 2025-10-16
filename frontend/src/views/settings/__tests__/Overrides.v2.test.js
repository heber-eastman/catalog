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
    const wrapper = mount(Overrides, { global: {} });
    await new Promise(r => setTimeout(r));
    expect(wrapper.html()).toContain('Overrides (V2)');
    // Create new override via toolbar
    const createBtn = wrapper.find('[data-cy="override-new-btn"]');
    expect(createBtn.exists()).toBe(true);
    await createBtn.trigger('click');
    await new Promise(r => setTimeout(r));
    // Click Publish in the dialog footer
    const publishBtn = wrapper.find('[data-cy="override-publish-btn"]');
    expect(publishBtn.exists()).toBe(true);
    await publishBtn.trigger('click');
    // Ensure publish API was invoked
    const { settingsAPI } = await import('@/services/api');
    expect(settingsAPI.v2.publishOverride).toHaveBeenCalled();
  });
});


