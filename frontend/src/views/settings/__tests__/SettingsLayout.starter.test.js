import { mount } from '@vue/test-utils';
import SettingsLayout from '../../settings/SettingsLayout.vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock vue-router composables used by the component
const mockRoute = {
  name: 'SettingsTeeSheetsSides',
  params: { teeSheetId: 'sheet-1' },
};
const mockRouter = { push: vi.fn(), replace: vi.fn() };
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}));

vi.mock('@/services/api', () => {
  return {
    settingsAPI: {
      listTeeSheets: vi.fn().mockResolvedValue({ data: [{ id: 'sheet-1', name: 'Demo Sheet' }] }),
      v2: {
        starterPreset: vi.fn().mockResolvedValue({ data: { ok: true } }),
        listOverrides: vi.fn().mockResolvedValue({ data: [] }),
        listSeasons: vi.fn().mockResolvedValue({ data: [] }),
      },
    },
    teeTimesAPI: {
      available: vi.fn().mockResolvedValue({ data: [] }),
    },
  };
});

describe('SettingsLayout Starter Preset', () => {
  let dispatchSpy;
  beforeEach(() => {
    dispatchSpy = vi.fn();
    vi.spyOn(window, 'dispatchEvent').mockImplementation(dispatchSpy);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render Starter button in simplified calendar panel', async () => {
    const wrapper = mount(SettingsLayout, {
      global: { stubs: ['router-link', 'router-view'] },
    });
    await wrapper.vm.$nextTick();
    const btn = wrapper.find('[data-cy="cal-btn-starter"]');
    expect(btn.exists()).toBe(false);
  });
});
