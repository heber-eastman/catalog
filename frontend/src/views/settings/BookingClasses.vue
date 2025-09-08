<template>
  <div>
    <h2>Booking Classes</h2>
    <div class="form">
      <input v-model="name" placeholder="Class name (e.g., Member)" />
      <button @click="create" :disabled="!name">Add</button>
    </div>
    <ul>
      <li v-for="c in classes" :key="c.id">{{ c.name }}</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { settingsAPI } from '@/services/api';

const route = useRoute();
const sheetId = ref(route.params.teeSheetId || '');
const name = ref('');
const classes = ref([]);

// Placeholder: if backend adds endpoints, wire here; for now, keep local list
async function load(){
  classes.value = classes.value; // no-op to keep shape; replace with API when available
}

async function create(){
  // Placeholder; push to local list
  classes.value = [...classes.value, { id: Math.random().toString(36).slice(2), name: name.value }];
  name.value = '';
}

onMounted(load);
watch(() => route.params.teeSheetId, (newId) => { if (typeof newId === 'string' && newId) sheetId.value = newId; });
</script>


