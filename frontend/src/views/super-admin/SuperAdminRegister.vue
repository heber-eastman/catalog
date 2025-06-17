<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-6">
          <v-card-title class="text-h4 text-center mb-4">
            Super Admin Registration
          </v-card-title>

          <v-card-text>
            <p class="text-center mb-4">
              Complete your super admin registration.
            </p>

            <!-- Placeholder for super admin registration form -->
            <v-alert type="info" class="mb-4">
              This page will contain the super admin registration form for
              invited super admins. Coming soon...
            </v-alert>

            <div class="text-center">
              <v-btn color="primary" @click="$router.push('/login')">
                Go to Login
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'SuperAdminRegister',
};
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
