<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1>Customer Details</h1>
        <p>Customer ID: {{ $route.params.id }}</p>

        <!-- Placeholder for customer details -->
        <v-card class="pa-4">
          <v-card-title>Customer Information</v-card-title>
          <v-card-text>
            <p>This page will show detailed customer information and notes.</p>
            <p>Coming soon...</p>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="$router.back()">Back to Customers</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'CustomerDetail',
};
</script>
