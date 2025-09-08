<template>
  <div>
    <h2>Calendar</h2>
    <div class="form">
      <select v-model="templateId">
        <option disabled value="">Select template</option>
        <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <input type="date" v-model="date" />
      <button @click="assign" :disabled="!sheetId || !templateId || !date">Assign</button>
    </div>
  </div>
  
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const templates = ref([]);
const route = useRoute();
const sheetId = ref(route.params.teeSheetId || '');
const templateId = ref('');
const date = ref(new Date().toISOString().substring(0,10));

async function loadTemplates(){
  if (!sheetId.value) { templates.value = []; return; }
  const { data } = await settingsAPI.listTemplates(sheetId.value);
  templates.value = data || [];
  if (templates.value.length) templateId.value = templates.value[0].id;
}

async function assign(){
  await settingsAPI.assignCalendar(sheetId.value, { date: date.value, day_template_id: templateId.value });
  alert('Assigned');
}

onMounted(loadTemplates);
watch(() => route.params.teeSheetId, (newId) => {
  if (typeof newId === 'string' && newId && sheetId.value !== newId) {
    sheetId.value = newId;
    loadTemplates();
  }
});
</script>

<style scoped>
.form{ display:flex; gap:8px; align-items:center; }
select,input{ padding:6px 8px; }
button{ padding:6px 10px; }
</style>


