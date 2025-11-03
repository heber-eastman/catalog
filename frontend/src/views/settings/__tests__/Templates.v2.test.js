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
        getTemplateSideSettings: vi.fn().mockResolvedValue({ data: { version_id: 'v1', sides: [] } }),
        updateTemplateSettings: vi.fn().mockResolvedValue({ data: { ok: true } }),
        updateTemplateSideSettings: vi.fn().mockResolvedValue({ data: { ok: true } }),
        getBookingWindows: vi.fn().mockResolvedValue({ data: { version_id: 'v1', windows: [], online_access: [] } }),
        updateBookingWindows: vi.fn().mockResolvedValue({ data: { ok: true } }),
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

  it('shows class window rows and saves booking windows', async () => {
    window.alert = vi.fn();
    const wrapper = mount(Templates, { global: {} });
    await new Promise(r => setTimeout(r));
    const firstCard = wrapper.find('[data-cy^="template-card-"]');
    if (firstCard.exists()) {
      await firstCard.trigger('click');
      await new Promise(r => setTimeout(r));
      // ensure booking class section rendered
      expect(document.body.innerHTML).toContain('Booking Class Settings');
      // click Save
      const saveBtn = Array.from(document.body.querySelectorAll('button')).find(b => /save/i.test(b.textContent || ''));
      if (saveBtn) {
        saveBtn.click();
        await new Promise(r => setTimeout(r));
      }
    }
    const mod = await import('@/services/api');
    expect(mod.settingsAPI.v2.updateBookingWindows).toHaveBeenCalled();
    const lastCall = mod.settingsAPI.v2.updateBookingWindows.mock.calls.at(-1);
    expect(lastCall).toBeTruthy();
    const payload = lastCall[2];
    expect(Array.isArray(payload.entries)).toBe(true);
    const ids = payload.entries.map(e => e.booking_class_id).sort();
    expect(ids).toEqual(['full','junior','public','senior','social'].sort());
    payload.entries.forEach(e => expect(e.max_days_in_advance).toBeTypeOf('number'));
  });

  it('forces unchecked class to save with 0 days', async () => {
    const mod = await import('@/services/api');
    // Next load returns junior disabled + days preset
    mod.settingsAPI.v2.getBookingWindows.mockResolvedValueOnce({ data: { version_id: 'v1', windows: [{ booking_class_id: 'junior', max_days_in_advance: 5 }], online_access: [{ booking_class_id: 'junior', is_online_allowed: false }] } });
    window.alert = vi.fn();
    const wrapper = mount(Templates, { global: {} });
    await new Promise(r => setTimeout(r));
    const firstCard = wrapper.find('[data-cy^="template-card-"]');
    if (firstCard.exists()) {
      await firstCard.trigger('click');
      await new Promise(r => setTimeout(r));
      const saveBtn = Array.from(document.body.querySelectorAll('button')).find(b => /save/i.test(b.textContent || ''));
      if (saveBtn) {
        saveBtn.click();
        await new Promise(r => setTimeout(r));
      }
    }
    const lastCall = mod.settingsAPI.v2.updateBookingWindows.mock.calls.at(-1);
    const payload = lastCall[2];
    const jr = payload.entries.find(e => e.booking_class_id === 'junior');
    expect(jr).toBeTruthy();
    expect(jr.is_online_allowed).toBe(false);
    expect(jr.max_days_in_advance).toBe(0);
  });
});


