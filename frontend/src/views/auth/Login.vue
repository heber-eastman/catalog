<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-6">
          <v-card-title class="text-h4 text-center mb-4"> Login </v-card-title>

          <v-card-text>
            <v-form ref="form" v-model="valid" @submit.prevent="handleLogin">
              <v-text-field
                v-model="form.email"
                label="Email Address"
                type="email"
                :rules="emailRules"
                required
                variant="outlined"
                class="mb-3"
                prepend-inner-icon="mdi-email"
                data-cy="email-input"
              />

              <v-text-field
                v-model="form.password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                :rules="passwordRules"
                required
                variant="outlined"
                class="mb-4"
                prepend-inner-icon="mdi-lock"
                :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append-inner="showPassword = !showPassword"
                data-cy="password-input"
              />

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                :disabled="!valid"
                class="mb-4"
                data-cy="login-button"
              >
                Login
              </v-btn>
            </v-form>
          </v-card-text>

          <!-- Error Message -->
          <v-card-text v-if="errorMessage" class="text-center">
            <v-alert type="error" variant="outlined" class="mb-4">
              {{ errorMessage }}
            </v-alert>
          </v-card-text>

          <v-card-actions class="justify-center flex-column ga-2">
            <v-btn
              variant="text"
              color="primary"
              @click="$router.push('/signup')"
            >
              Don't have an account? Sign up
            </v-btn>

            <div class="text-caption text-medium-emphasis">
              Staff member? Check your email for registration link
            </div>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { authAPI, apiUtils } from '@/services/api';

export default {
  name: 'Login',
  data() {
    return {
      valid: false,
      loading: false,
      showPassword: false,
      errorMessage: '',
      form: {
        email: '',
        password: '',
      },
      emailRules: [
        v => !!v || 'Email is required',
        v => /.+@.+\..+/.test(v) || 'Email must be valid',
      ],
      passwordRules: [v => !!v || 'Password is required'],
    };
  },
  methods: {
    async handleLogin() {
      if (!this.valid) return;

      this.loading = true;
      this.errorMessage = '';

      try {
        const response = await authAPI.login(this.form);
        console.log('Login response:', response.data);

        // Store the JWT token if provided in response
        if (response.data.token) {
          apiUtils.setToken(response.data.token);
        }

        // Redirect based on user role or to dashboard
        const redirectPath = this.$route.query.redirect || '/dashboard';
        this.$router.push(redirectPath);
      } catch (error) {
        console.error('Login error:', error);
        this.errorMessage =
          error.response?.data?.error || 'Invalid email or password';
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
