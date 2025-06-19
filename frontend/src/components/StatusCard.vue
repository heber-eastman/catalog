<template>
  <v-card
    :color="cardColor"
    :variant="variant"
    class="pa-4 text-center"
    elevation="2"
  >
    <v-icon :icon="icon" :color="iconColor" size="48" class="mb-2" />

    <v-card-title class="text-h4 font-weight-bold mb-1">
      {{ value }}
    </v-card-title>

    <v-card-subtitle class="text-subtitle-1">
      {{ title }}
    </v-card-subtitle>

    <v-card-text v-if="subtitle" class="text-caption">
      {{ subtitle }}
    </v-card-text>

    <!-- Trend indicator -->
    <div v-if="trend" class="d-flex align-center justify-center mt-2">
      <v-icon :icon="trendIcon" :color="trendColor" size="small" class="mr-1" />
      <span :class="trendColor" class="text-caption font-weight-medium">
        {{ trendText }}
      </span>
    </div>

    <!-- Action button -->
    <v-card-actions v-if="actionText" class="justify-center">
      <v-btn
        :color="actionColor"
        variant="text"
        size="small"
        @click="$emit('action')"
      >
        {{ actionText }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
export default {
  name: 'StatusCard',
  emits: ['action'],
  props: {
    title: {
      type: String,
      required: true,
    },
    value: {
      type: [String, Number],
      required: true,
    },
    subtitle: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      default: 'primary',
    },
    variant: {
      type: String,
      default: 'elevated',
    },
    trend: {
      type: Object,
      default: null,
      // Expected format: { value: 12.5, direction: 'up'|'down', text: '+12.5% from last month' }
    },
    actionText: {
      type: String,
      default: '',
    },
    actionColor: {
      type: String,
      default: 'primary',
    },
  },
  computed: {
    cardColor() {
      if (this.variant === 'outlined' || this.variant === 'text') {
        return 'surface';
      }
      return 'surface';
    },
    iconColor() {
      return this.color;
    },
    trendIcon() {
      if (!this.trend) return '';
      return this.trend.direction === 'up'
        ? 'mdi-trending-up'
        : 'mdi-trending-down';
    },
    trendColor() {
      if (!this.trend) return '';
      return this.trend.direction === 'up' ? 'text-success' : 'text-error';
    },
    trendText() {
      return this.trend?.text || '';
    },
  },
};
</script>

<style scoped>
.v-card {
  transition: transform 0.2s ease-in-out;
}

.v-card:hover {
  transform: translateY(-2px);
}
</style>
