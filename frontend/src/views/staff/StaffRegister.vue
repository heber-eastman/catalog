<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-6">
          <v-card-title class="text-h4 text-center mb-4">
            Staff Registration
          </v-card-title>
          
          <v-card-text>
            <p class="text-center mb-4">
              Complete your registration to access the staff portal.
            </p>
            
            <!-- Placeholder for staff registration form -->
            <v-alert type="info" class="mb-4">
              This page will contain the staff registration form for invited staff members.
              Coming soon...
            </v-alert>
            
            <div class="text-center">
              <v-btn 
                color="primary" 
                @click="$router.push('/login')"
              >
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
  name: 'StaffRegister',
};
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style> 