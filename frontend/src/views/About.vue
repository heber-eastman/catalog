<template>
  <div>
    <v-card>
      <v-card-title class="text-h4 text-center">
        <v-icon class="me-2" size="40">mdi-information</v-icon>
        About Catalog V0
      </v-card-title>

      <v-card-text>
        <p class="text-h6 mb-4">
          This is a full-stack monorepo setup demonstrating modern web
          development practices.
        </p>

        <v-row>
          <v-col cols="12" md="6">
            <h3 class="mb-3">
              <v-icon class="me-2">mdi-feature-search</v-icon>
              Features
            </h3>
            <v-list>
              <v-list-item prepend-icon="mdi-check">
                <v-list-item-title>Yarn Workspaces Monorepo</v-list-item-title>
              </v-list-item>
              <v-list-item prepend-icon="mdi-check">
                <v-list-item-title
                  >ESLint & Prettier Configuration</v-list-item-title
                >
              </v-list-item>
              <v-list-item prepend-icon="mdi-check">
                <v-list-item-title>GitHub Actions CI/CD</v-list-item-title>
              </v-list-item>
              <v-list-item prepend-icon="mdi-check">
                <v-list-item-title>Jest Testing Setup</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-col>

          <v-col cols="12" md="6">
            <h3 class="mb-3">
              <v-icon class="me-2">mdi-stack-overflow</v-icon>
              Tech Stack
            </h3>
            <v-expansion-panels>
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon class="me-2">mdi-server</v-icon>
                  Backend Technologies
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-chip-group>
                    <v-chip>Express.js</v-chip>
                    <v-chip>Sequelize ORM</v-chip>
                    <v-chip>PostgreSQL</v-chip>
                    <v-chip>JWT Authentication</v-chip>
                    <v-chip>AWS SDK</v-chip>
                    <v-chip>Joi Validation</v-chip>
                    <v-chip>bcrypt</v-chip>
                  </v-chip-group>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon class="me-2">mdi-web</v-icon>
                  Frontend Technologies
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-chip-group>
                    <v-chip>Vue 3</v-chip>
                    <v-chip>Vuetify 3</v-chip>
                    <v-chip>Vite</v-chip>
                    <v-chip>Vue Router</v-chip>
                    <v-chip>Pinia</v-chip>
                    <v-chip>Axios</v-chip>
                  </v-chip-group>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
// About page logic can be added here
</script>
