<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>
        <v-icon class="me-2">mdi-book-open-page-variant</v-icon>
        Catalog V0
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <v-btn icon="mdi-theme-light-dark" @click="toggleTheme"></v-btn>
    </v-app-bar>

    <v-navigation-drawer app permanent>
      <v-list nav>
        <v-list-item to="/" prepend-icon="mdi-home" title="Home"></v-list-item>

        <v-list-item
          to="/about"
          prepend-icon="mdi-information"
          title="About"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid>
        <router-view />
      </v-container>
    </v-main>

    <v-footer app>
      <span
        >&copy; {{ new Date().getFullYear() }} Catalog V0. Built with Vue 3 &
        Vuetify.</span
      >
    </v-footer>
  </v-app>
</template>

<script setup>
import { useTheme } from 'vuetify';

const theme = useTheme();

const toggleTheme = () => {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark';
};
</script>
