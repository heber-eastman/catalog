<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" class="text-center">
        <v-card class="pa-8">
          <v-icon
            icon="mdi-alert-circle-outline"
            size="120"
            color="error"
            class="mb-4"
          />
          <h1 class="text-h2 mb-4">404</h1>
          <h2 class="text-h4 mb-4">Page Not Found</h2>
          <p class="text-body-1 mb-6 text-medium-emphasis">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <div class="d-flex flex-column ga-3">
            <v-btn
              color="primary"
              size="large"
              @click="$router.push('/')"
            >
              Go Home
            </v-btn>
            <v-btn
              variant="text"
              @click="$router.back()"
            >
              Go Back
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'NotFound',
};
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style> 