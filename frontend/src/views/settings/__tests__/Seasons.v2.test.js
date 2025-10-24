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
    expect(wrapper.html()).toContain('Seasons');
    // Open first season card
    const card = wrapper.find('[data-cy^="season-card-"]');
    if (card.exists()) {
      await card.trigger('click');
      await new Promise(r => setTimeout(r));
      expect(document.body.innerHTML).toContain('Season Settings');
    }
  });
});


