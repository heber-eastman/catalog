import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CustomersList from '../CustomersList.vue';
import { createVuetify } from 'vuetify';

// Mock the API
vi.mock('@/services/api', () => ({
  customerAPI: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock lodash-es debounce
vi.mock('lodash-es', () => ({
  debounce: vi.fn(fn => fn), // Return the function as-is for testing
}));

const vuetify = createVuetify();

describe('CustomersList', () => {
  const mockCustomers = [
    {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone: '555-1234',
      status: 'Active',
      created_at: '2023-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      phone: '555-5678',
      status: 'Inactive',
      created_at: '2023-01-02T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders customers list correctly', async () => {
    const { customerAPI } = await import('@/services/api');
    customerAPI.getAll.mockResolvedValue({
      data: { customers: mockCustomers },
    });

    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });
    // Manually call loadCustomers since mounted lifecycle might not trigger in tests
    await wrapper.vm.loadCustomers();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('h1').text()).toBe('Customers Management');
    expect(customerAPI.getAll).toHaveBeenCalled();
  });

  it('displays customers in data table', async () => {
    const { customerAPI } = await import('@/services/api');
    customerAPI.getAll.mockResolvedValue({
      data: { customers: mockCustomers },
    });

    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });
    // Manually call loadCustomers since mounted lifecycle might not trigger in tests
    await wrapper.vm.loadCustomers();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.customers.length).toBe(2);
    expect(wrapper.vm.customers[0].full_name).toBe('John Doe');
    expect(wrapper.vm.customers[1].full_name).toBe('Jane Smith');
  });

  it('shows add customer button', () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    const addButton = wrapper.find('[data-cy="add-customer-btn"]');
    expect(addButton.exists()).toBe(true);
    expect(addButton.text()).toBe('Add Customer');
  });

  it('shows import and export buttons', () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    const importButton = wrapper.find('[data-cy="import-customers-btn"]');
    const exportButton = wrapper.find('[data-cy="export-customers-btn"]');

    expect(importButton.exists()).toBe(true);
    expect(exportButton.exists()).toBe(true);
    expect(importButton.text()).toBe('Import');
    expect(exportButton.text()).toBe('Export');
  });

  it('opens create dialog when add button is clicked', async () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    const addButton = wrapper.find('[data-cy="add-customer-btn"]');
    await addButton.trigger('click');

    expect(wrapper.vm.showCreateDialog).toBe(true);
  });

  it('opens import dialog when import button is clicked', async () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    const importButton = wrapper.find('[data-cy="import-customers-btn"]');
    await importButton.trigger('click');

    expect(wrapper.vm.showImportDialog).toBe(true);
  });

  it('opens export dialog when export button is clicked', async () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    const exportButton = wrapper.find('[data-cy="export-customers-btn"]');
    await exportButton.trigger('click');

    expect(wrapper.vm.showExportDialog).toBe(true);
  });

  it('filters customers by search term', async () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });
    await wrapper.vm.$nextTick();

    // Set mock data
    wrapper.vm.customers = mockCustomers.map(customer => ({
      ...customer,
      full_name: `${customer.first_name} ${customer.last_name}`,
    }));

    // Search for John
    wrapper.vm.search = 'John';
    wrapper.vm.applyFilters();

    expect(wrapper.vm.filteredCustomers.length).toBe(1);
    expect(wrapper.vm.filteredCustomers[0].first_name).toBe('John');
  });

  it('filters customers by status', async () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });
    await wrapper.vm.$nextTick();

    // Set mock data
    wrapper.vm.customers = mockCustomers.map(customer => ({
      ...customer,
      full_name: `${customer.first_name} ${customer.last_name}`,
    }));

    // Filter by Active status
    wrapper.vm.statusFilter = 'Active';
    wrapper.vm.applyFilters();

    expect(wrapper.vm.filteredCustomers.length).toBe(1);
    expect(wrapper.vm.filteredCustomers[0].status).toBe('Active');
  });

  it('clears all filters', async () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    // Set some filters
    wrapper.vm.search = 'test';
    wrapper.vm.statusFilter = 'Active';
    wrapper.vm.sortBy = 'name_asc';

    // Clear filters
    wrapper.vm.clearFilters();

    expect(wrapper.vm.search).toBe('');
    expect(wrapper.vm.statusFilter).toBe(null);
    expect(wrapper.vm.sortBy).toBe('created_at_desc');
  });

  it('creates new customer', async () => {
    const newCustomer = {
      first_name: 'New',
      last_name: 'Customer',
      email: 'new@example.com',
      phone: '555-9999',
      status: 'Active',
    };

    const { customerAPI } = await import('@/services/api');
    customerAPI.create.mockResolvedValue({
      data: { id: 3, ...newCustomer },
    });

    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    // Set form data
    wrapper.vm.customerData = newCustomer;
    wrapper.vm.customerFormValid = true;

    // Save customer
    await wrapper.vm.saveCustomer();

    expect(customerAPI.create).toHaveBeenCalledWith(newCustomer);
    expect(wrapper.vm.showCreateDialog).toBe(false);
  });

  it('updates existing customer', async () => {
    const existingCustomer = { id: 1, ...mockCustomers[0] };
    const updatedData = { ...existingCustomer, first_name: 'Updated' };

    const { customerAPI } = await import('@/services/api');
    customerAPI.update.mockResolvedValue({
      data: updatedData,
    });

    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    // Set editing mode
    wrapper.vm.editingCustomer = existingCustomer;
    wrapper.vm.customerData = updatedData;
    wrapper.vm.customerFormValid = true;

    // Save customer
    await wrapper.vm.saveCustomer();

    expect(customerAPI.update).toHaveBeenCalledWith(1, updatedData);
    expect(wrapper.vm.showCreateDialog).toBe(false);
  });

  it('deletes customer', async () => {
    const { customerAPI } = await import('@/services/api');
    customerAPI.delete.mockResolvedValue({});

    // Mock window.confirm
    global.confirm = vi.fn(() => true);

    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    await wrapper.vm.deleteCustomer(mockCustomers[0]);

    expect(customerAPI.delete).toHaveBeenCalledWith(1);
    expect(customerAPI.getAll).toHaveBeenCalled(); // Should reload
  });

  it('handles bulk delete', async () => {
    const { customerAPI } = await import('@/services/api');
    customerAPI.delete.mockResolvedValue({});

    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });
    wrapper.vm.selectedCustomers = [1, 2];

    await wrapper.vm.processBulkDelete();

    expect(customerAPI.delete).toHaveBeenCalledTimes(2);
    expect(wrapper.vm.selectedCustomers).toEqual([]);
  });

  it('formats dates correctly', () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });
    const testDate = '2023-01-01T00:00:00.000Z';

    const formatted = wrapper.vm.formatDate(testDate);
    expect(formatted).toBeTruthy();
    expect(formatted).not.toBe('N/A');
  });

  it('returns correct status colors', () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    expect(wrapper.vm.getStatusColor('Active')).toBe('success');
    expect(wrapper.vm.getStatusColor('Inactive')).toBe('error');
    expect(wrapper.vm.getStatusColor('Pending')).toBe('warning');
    expect(wrapper.vm.getStatusColor('Unknown')).toBe('primary');
  });

  it('sorts customers correctly', async () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    // Set mock data
    wrapper.vm.customers = mockCustomers.map(customer => ({
      ...customer,
      full_name: `${customer.first_name} ${customer.last_name}`,
    }));
    wrapper.vm.filteredCustomers = [...wrapper.vm.customers];

    // Sort by name ascending
    wrapper.vm.sortBy = 'name_asc';
    wrapper.vm.applySorting();

    expect(wrapper.vm.filteredCustomers[0].first_name).toBe('Jane');
    expect(wrapper.vm.filteredCustomers[1].first_name).toBe('John');
  });

  it('shows notification on error', () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    wrapper.vm.showNotification('Test error', 'error');

    expect(wrapper.vm.showSnackbar).toBe(true);
    expect(wrapper.vm.snackbarMessage).toBe('Test error');
    expect(wrapper.vm.snackbarColor).toBe('error');
  });

  it('validates customer form data', async () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });

    // Invalid data (missing required fields)
    wrapper.vm.customerData = {
      first_name: '',
      last_name: 'Test',
      email: 'invalid-email',
    };

    // Form should be invalid
    expect(wrapper.vm.customerFormValid).toBe(false);
  });

  it('generates export description correctly', () => {
    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });
    wrapper.vm.customers = mockCustomers;
    wrapper.vm.filteredCustomers = mockCustomers;
    wrapper.vm.selectedCustomers = [1];

    wrapper.vm.exportType = 'all';
    wrapper.vm.exportFormat = 'csv';
    let description = wrapper.vm.getExportDescription();
    expect(description).toContain('2 customers');
    expect(description).toContain('CSV');

    wrapper.vm.exportType = 'selected';
    description = wrapper.vm.getExportDescription();
    expect(description).toContain('1 customers');
  });

  it('handles API errors gracefully', async () => {
    const { customerAPI } = await import('@/services/api');
    customerAPI.getAll.mockRejectedValue(new Error('API Error'));

    const wrapper = mount(CustomersList, {
      global: {
        plugins: [vuetify],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: { template: '<div><slot /></div>' },
          VCardTitle: { template: '<div><slot /></div>' },
          VCardText: { template: '<div><slot /></div>' },
          VCardActions: { template: '<div><slot /></div>' },
          VDataTable: {
            template: '<div><slot /></div>',
            props: ['headers', 'items', 'loading', 'search', 'modelValue'],
            emits: ['update:modelValue'],
          },
          VTextField: {
            template: '<input v-model="modelValue" />',
            props: ['modelValue'],
            emits: ['update:modelValue'],
          },
          VSelect: {
            template:
              '<select><option v-for="item in items" :key="item.value" :value="item.value">{{ item.title }}</option></select>',
            props: ['modelValue', 'items'],
            emits: ['update:modelValue'],
          },
          VBtn: { template: '<button><slot /></button>' },
          VDialog: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VForm: { template: '<form><slot /></form>' },
          VChip: { template: '<span><slot /></span>' },
          VAlert: { template: '<div><slot /></div>' },
          VSpacer: { template: '<div></div>' },
          VSnackbar: {
            template: '<div v-if="modelValue"><slot /></div>',
            props: ['modelValue'],
          },
          VRadioGroup: { template: '<div><slot /></div>' },
          VRadio: { template: '<input type="radio" />' },
        },
      },
    });
    await wrapper.vm.$nextTick();

    // Should handle error without crashing
    expect(wrapper.vm.customers).toEqual([]);
  });
});
