<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-6">
          <v-card-title class="text-h4 text-center mb-4">
            {{ isSuperAdmin ? 'Super Admin Login' : 'Staff Login' }}
          </v-card-title>

          <v-card-text>
            <!-- Login Type Toggle -->
            <div class="text-center mb-4">
              <v-chip-group
                v-model="loginType"
                selected-class="text-primary"
                mandatory
              >
                <v-chip value="staff" @click="isSuperAdmin = false">
                  Staff Login
                </v-chip>
                <v-chip value="super-admin" @click="isSuperAdmin = true">
                  Super Admin
                </v-chip>
              </v-chip-group>
            </div>

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
                {{ isSuperAdmin ? 'Login as Super Admin' : 'Login' }}
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
              v-if="!isSuperAdmin"
              variant="text"
              color="primary"
              @click="$router.push('/signup')"
            >
              Don't have an account? Sign up
            </v-btn>

            <div class="text-caption text-medium-emphasis">
              {{
                isSuperAdmin
                  ? 'Super admin access for platform management'
                  : 'Staff member? Check your email for registration link'
              }}
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
      loginType: 'staff',
      isSuperAdmin: false,
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
        let response;

        if (this.isSuperAdmin) {
          response = await authAPI.superAdminLogin(this.form);
        } else {
          response = await authAPI.login(this.form);
        }

        console.log('Login response:', response.data);

        // Store the JWT token if provided in response body
        if (response.data.token) {
          apiUtils.setToken(response.data.token);
        }

        // Store user data (for cookie-based auth)
        apiUtils.setUser(response.data);

        // Redirect based on actual user role from server response
        if (response.data.role === 'SuperAdmin') {
          // Super admin stays on app.catalog.golf
          const finalPath =
            this.$route.query.redirect || '/super-admin/courses';
          this.$router.push(finalPath);
        } else {
          // Staff users redirect to their course subdomain
          const subdomain = response.data.course_subdomain;
          if (subdomain) {
            // Redirect to the user's course subdomain
            window.location.href = `https://${subdomain}.catalog.golf/dashboard`;
          } else {
            // Fallback to dashboard if no subdomain
            const finalPath = this.$route.query.redirect || '/dashboard';
            this.$router.push(finalPath);
          }
        }
      } catch (error) {
        console.error('Login error:', error);
        this.errorMessage =
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Invalid email or password';
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
