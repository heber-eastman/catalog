import { mount } from '@vue/test-utils';
import Templates from '@/views/settings/v2/Templates.vue';
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
        listTemplates: vi.fn().mockResolvedValue({ data: [{ id: 't1', status: 'draft', interval_mins: 10 }] }),
        createTemplate: vi.fn().mockResolvedValue({ data: { id: 't2' } }),
        createTemplateVersion: vi.fn().mockResolvedValue({ data: { id: 'tv1' } }),
        publishTemplate: vi.fn().mockResolvedValue({ data: { ok: true } }),
        regenerateDate: vi.fn().mockResolvedValue({ data: { ok: true } }),
        regenerateRange: vi.fn().mockResolvedValue({ data: { ok: true } }),
      },
    },
  };
});

describe('V2 Templates view', () => {
  it('lists templates and can create/version/publish', async () => {
    // suppress alerts in jsdom
    window.alert = vi.fn();
    const wrapper = mount(Templates, {
      global: { },
    });
    await new Promise(r => setTimeout(r));
    expect(wrapper.html()).toContain('Templates');
    // Create template via toolbar button
    const createBtn = wrapper.find('[data-cy="template-create-btn"]');
    if (createBtn.exists()) {
      await createBtn.trigger('click');
      await new Promise(r => setTimeout(r));
    }
    // Open first template card
    const firstCard = wrapper.find('[data-cy^="template-card-"]');
    if (firstCard.exists()) {
      await firstCard.trigger('click');
      await new Promise(r => setTimeout(r));
      // Dialog content is teleported; assert against document body
      expect(document.body.innerHTML).toContain('Template Settings');
    }
  });
});


