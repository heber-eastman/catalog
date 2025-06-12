<template>
  <div>
    <v-card class="mb-4">
      <v-card-title class="text-h4 text-center">
        <v-icon class="me-2" size="40">mdi-home</v-icon>
        Welcome to Catalog V0
      </v-card-title>

      <v-card-text class="text-center">
        <p class="text-h6 mb-4">A modern full-stack application built with:</p>

        <v-row justify="center">
          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title class="text-center">
                <v-icon class="me-2">mdi-server</v-icon>
                Backend
              </v-card-title>
              <v-card-text>
                <v-chip-group column>
                  <v-chip color="success">Express.js</v-chip>
                  <v-chip color="info">Sequelize</v-chip>
                  <v-chip color="primary">PostgreSQL</v-chip>
                  <v-chip color="warning">JWT</v-chip>
                </v-chip-group>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card variant="outlined">
              <v-card-title class="text-center">
                <v-icon class="me-2">mdi-web</v-icon>
                Frontend
              </v-card-title>
              <v-card-text>
                <v-chip-group column>
                  <v-chip color="success">Vue 3</v-chip>
                  <v-chip color="info">Vuetify</v-chip>
                  <v-chip color="primary">Vite</v-chip>
                  <v-chip color="warning">Pinia</v-chip>
                </v-chip-group>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card>
      <v-card-title>
        <v-icon class="me-2">mdi-rocket-launch</v-icon>
        Quick Start
      </v-card-title>

      <v-card-text>
        <v-stepper alt-labels>
          <v-stepper-header>
            <v-stepper-item
              title="Install Dependencies"
              value="1"
            ></v-stepper-item>
            <v-divider></v-divider>
            <v-stepper-item title="Start Backend" value="2"></v-stepper-item>
            <v-divider></v-divider>
            <v-stepper-item title="Start Frontend" value="3"></v-stepper-item>
          </v-stepper-header>
        </v-stepper>

        <div class="mt-4">
          <v-code class="d-block mb-2">yarn install</v-code>
          <v-code class="d-block mb-2">yarn dev:backend</v-code>
          <v-code class="d-block">yarn dev:frontend</v-code>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
// Home page logic can be added here
</script>
