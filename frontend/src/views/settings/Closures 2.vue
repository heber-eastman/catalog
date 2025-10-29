<template>
  <div>
    <h2>Closures</h2>
    <div class="form">
      <input type="date" v-model="date" />
      <input v-model="reason" placeholder="Reason" />
      <button @click="create" :disabled="!date">Add Closure</button>
    </div>
    <ul>
      <li v-for="c in closures" :key="c.id">{{ c.date }} — {{ c.reason || 'No reason' }}</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const sheetId = ref(route.params.teeSheetId || '');
const date = ref(new Date().toISOString().substring(0,10));
const reason = ref('');
const closures = ref([]);

async function loadClosures(){
  if (!sheetId.value) { closures.value = []; return; }
  const { data } = await settingsAPI.listClosures(sheetId.value);
  closures.value = data || [];
}

async function create(){
  await settingsAPI.createClosure(sheetId.value, { date: date.value, reason: reason.value });
  reason.value = '';
  await loadClosures();
}

onMounted(loadClosures);
watch(() => route.params.teeSheetId, (newId) => {
  if (typeof newId === 'string' && newId && sheetId.value !== newId) {
    sheetId.value = newId;
    loadClosures();
  }
});
</script>


