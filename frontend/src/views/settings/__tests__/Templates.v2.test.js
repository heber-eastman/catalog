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
    expect(wrapper.html()).toContain('Templates (V2)');
    // Create template
    await wrapper.find('button.btn').trigger('click');
    // Enter notes and create version on first template
    const inputs = wrapper.findAll('input');
    if (inputs.length) {
      await inputs[0].setValue('v1 notes');
    }
    const buttons = wrapper.findAll('button.btn.sm');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    // Add Version
    await buttons[0].trigger('click');
    // Publish
    await buttons[1].trigger('click');
  });
});


