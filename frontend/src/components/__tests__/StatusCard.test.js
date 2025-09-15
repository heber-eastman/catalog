import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import StatusCard from '../StatusCard.vue';

describe('StatusCard', () => {
  const defaultProps = {
    title: 'Test Title',
    value: 42,
    icon: 'mdi-test',
  };

  it('renders with required props', () => {
    const wrapper = mount(StatusCard, {
      props: defaultProps,
      global: {
        stubs: {
          'v-card': { template: '<div class="v-card"><slot /></div>' },
          'v-card-title': {
            template: '<div class="v-card-title"><slot /></div>',
          },
          'v-card-subtitle': {
            template: '<div class="v-card-subtitle"><slot /></div>',
          },
          'v-card-text': {
            template: '<div class="v-card-text"><slot /></div>',
          },
          'v-card-actions': {
            template: '<div class="v-card-actions"><slot /></div>',
          },
          'v-icon': { template: '<i class="v-icon"></i>' },
          'v-btn': { template: '<button class="v-btn"><slot /></button>' },
        },
      },
    });

    expect(wrapper.text()).toContain('42');
    expect(wrapper.text()).toContain('Test Title');
  });

  it('displays subtitle when provided', () => {
    const wrapper = mount(StatusCard, {
      props: {
        ...defaultProps,
        subtitle: 'Test subtitle',
      },
      global: {
        stubs: {
          'v-card': { template: '<div class="v-card"><slot /></div>' },
          'v-card-title': {
            template: '<div class="v-card-title"><slot /></div>',
          },
          'v-card-subtitle': {
            template: '<div class="v-card-subtitle"><slot /></div>',
          },
          'v-card-text': {
            template: '<div class="v-card-text"><slot /></div>',
          },
          'v-card-actions': {
            template: '<div class="v-card-actions"><slot /></div>',
          },
          'v-icon': { template: '<i class="v-icon"></i>' },
          'v-btn': { template: '<button class="v-btn"><slot /></button>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Test subtitle');
  });

  it('shows trend indicator when trend prop is provided', () => {
    const trend = {
      direction: 'up',
      text: '+12.5% from last month',
    };

    const wrapper = mount(StatusCard, {
      props: {
        ...defaultProps,
        trend,
      },
      global: {
        stubs: {
          'v-card': { template: '<div class="v-card"><slot /></div>' },
          'v-card-title': {
            template: '<div class="v-card-title"><slot /></div>',
          },
          'v-card-subtitle': {
            template: '<div class="v-card-subtitle"><slot /></div>',
          },
          'v-card-text': {
            template: '<div class="v-card-text"><slot /></div>',
          },
          'v-card-actions': {
            template: '<div class="v-card-actions"><slot /></div>',
          },
          'v-icon': { template: '<i class="v-icon"></i>' },
          'v-btn': { template: '<button class="v-btn"><slot /></button>' },
        },
      },
    });

    expect(wrapper.text()).toContain('+12.5% from last month');
  });

  it('shows action button when actionText is provided', () => {
    const wrapper = mount(StatusCard, {
      props: {
        ...defaultProps,
        actionText: 'View Details',
      },
      global: {
        stubs: {
          'v-card': { template: '<div class="v-card"><slot /></div>' },
          'v-card-title': {
            template: '<div class="v-card-title"><slot /></div>',
          },
          'v-card-subtitle': {
            template: '<div class="v-card-subtitle"><slot /></div>',
          },
          'v-card-text': {
            template: '<div class="v-card-text"><slot /></div>',
          },
          'v-card-actions': {
            template: '<div class="v-card-actions"><slot /></div>',
          },
          'v-icon': { template: '<i class="v-icon"></i>' },
          'v-btn': {
            template:
              '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('View Details');
  });

  it('emits action event when action button is clicked', async () => {
    const wrapper = mount(StatusCard, {
      props: {
        ...defaultProps,
        actionText: 'View Details',
      },
      global: {
        stubs: {
          'v-card': { template: '<div class="v-card"><slot /></div>' },
          'v-card-title': {
            template: '<div class="v-card-title"><slot /></div>',
          },
          'v-card-subtitle': {
            template: '<div class="v-card-subtitle"><slot /></div>',
          },
          'v-card-text': {
            template: '<div class="v-card-text"><slot /></div>',
          },
          'v-card-actions': {
            template: '<div class="v-card-actions"><slot /></div>',
          },
          'v-icon': { template: '<i class="v-icon"></i>' },
          'v-btn': {
            template:
              '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    });

    const button = wrapper.find('button');
    await button.trigger('click');

    expect(wrapper.emitted().action).toBeTruthy();
  });

  it('computes trend properties correctly', () => {
    const upTrend = {
      direction: 'up',
      text: 'Increasing',
    };

    const downTrend = {
      direction: 'down',
      text: 'Decreasing',
    };

    const upWrapper = mount(StatusCard, {
      props: { ...defaultProps, trend: upTrend },
      global: {
        stubs: {
          'v-card': { template: '<div class="v-card"><slot /></div>' },
          'v-card-title': {
            template: '<div class="v-card-title"><slot /></div>',
          },
          'v-card-subtitle': {
            template: '<div class="v-card-subtitle"><slot /></div>',
          },
          'v-card-text': {
            template: '<div class="v-card-text"><slot /></div>',
          },
          'v-card-actions': {
            template: '<div class="v-card-actions"><slot /></div>',
          },
          'v-icon': { template: '<i class="v-icon"></i>' },
          'v-btn': { template: '<button class="v-btn"><slot /></button>' },
        },
      },
    });

    const downWrapper = mount(StatusCard, {
      props: { ...defaultProps, trend: downTrend },
      global: {
        stubs: {
          'v-card': { template: '<div class="v-card"><slot /></div>' },
          'v-card-title': {
            template: '<div class="v-card-title"><slot /></div>',
          },
          'v-card-subtitle': {
            template: '<div class="v-card-subtitle"><slot /></div>',
          },
          'v-card-text': {
            template: '<div class="v-card-text"><slot /></div>',
          },
          'v-card-actions': {
            template: '<div class="v-card-actions"><slot /></div>',
          },
          'v-icon': { template: '<i class="v-icon"></i>' },
          'v-btn': { template: '<button class="v-btn"><slot /></button>' },
        },
      },
    });

    // Check trend icons
    expect(upWrapper.vm.trendIcon).toBe('mdi-trending-up');
    expect(downWrapper.vm.trendIcon).toBe('mdi-trending-down');

    // Check trend colors
    expect(upWrapper.vm.trendColor).toBe('text-success');
    expect(downWrapper.vm.trendColor).toBe('text-error');
  });
});
