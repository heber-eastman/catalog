<template>
  <div>
    <h2>Day Templates</h2>
    <div class="form">
      <input v-model="tplName" placeholder="Template name (e.g., Default)" />
      <button @click="createTemplate" :disabled="!sheetId || !tplName">Add Template</button>
    </div>
    <ul>
      <li v-for="t in templates" :key="t.id">{{ t.name }}</li>
    </ul>
  </div>
  
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const templates = ref([]);
const route = useRoute();
const sheetId = ref(route.params.teeSheetId || '');
const tplName = ref('Default');

async function loadTemplates(){
  if (!sheetId.value) { templates.value = []; return; }
  const { data } = await settingsAPI.listTemplates(sheetId.value);
  templates.value = data || [];
}

async function createTemplate(){
  await settingsAPI.createTemplate(sheetId.value, { name: tplName.value });
  tplName.value = '';
  await loadTemplates();
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
.form{ display:flex; gap:8px; align-items:center; margin-bottom:8px; }
ul{ list-style:none; padding:0; }
li{ padding:6px 8px; border:1px solid #eee; border-radius:6px; margin:6px 0; }
</style>


