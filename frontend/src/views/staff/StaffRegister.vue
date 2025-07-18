<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-6">
          <v-card-title class="text-h4 text-center mb-4">
            Complete Staff Registration
          </v-card-title>

          <v-card-text>
            <!-- Loading State -->
            <div v-if="loadingToken" class="text-center">
              <v-progress-circular indeterminate color="primary" />
              <p class="mt-4">Validating invitation...</p>
            </div>

            <!-- Invalid Token -->
            <div v-else-if="tokenError" class="text-center">
              <v-alert type="error" class="mb-4">
                {{ tokenError }}
              </v-alert>
              <v-btn color="primary" @click="$router.push('/login')">
                Go to Login
              </v-btn>
            </div>

            <!-- Registration Form -->
            <div v-else>
              <p class="text-center mb-4">
                Welcome! Please complete your registration to access the staff
                portal.
              </p>

              <v-form
                ref="form"
                v-model="valid"
                @submit.prevent="handleRegistration"
              >
                <v-text-field
                  v-model="form.first_name"
                  label="First Name"
                  :rules="nameRules"
                  required
                  variant="outlined"
                  class="mb-3"
                  data-cy="first-name-input"
                />

                <v-text-field
                  v-model="form.last_name"
                  label="Last Name"
                  :rules="nameRules"
                  required
                  variant="outlined"
                  class="mb-3"
                  data-cy="last-name-input"
                />

                <v-text-field
                  v-model="form.phone"
                  label="Phone Number (Optional)"
                  variant="outlined"
                  class="mb-3"
                  data-cy="phone-input"
                />

                <v-text-field
                  v-model="form.password"
                  label="Password"
                  :type="showPassword ? 'text' : 'password'"
                  :rules="passwordRules"
                  required
                  variant="outlined"
                  class="mb-3"
                  data-cy="password-input"
                  :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                  @click:append-inner="showPassword = !showPassword"
                />

                <v-text-field
                  v-model="form.confirmPassword"
                  label="Confirm Password"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  :rules="confirmPasswordRules"
                  required
                  variant="outlined"
                  class="mb-3"
                  data-cy="confirm-password-input"
                  :append-inner-icon="
                    showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'
                  "
                  @click:append-inner="
                    showConfirmPassword = !showConfirmPassword
                  "
                />

                <!-- Error Message -->
                <v-alert v-if="errorMessage" type="error" class="mb-4">
                  {{ errorMessage }}
                </v-alert>

                <!-- Success Message -->
                <v-alert v-if="successMessage" type="success" class="mb-4">
                  {{ successMessage }}
                </v-alert>

                <v-btn
                  type="submit"
                  color="primary"
                  :loading="loading"
                  :disabled="!valid"
                  block
                  size="large"
                  data-cy="register-button"
                >
                  Complete Registration
                </v-btn>
              </v-form>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { staffAPI } from '@/services/api';

export default {
  name: 'StaffRegister',
  data() {
    return {
      loadingToken: true,
      tokenError: '',
      valid: false,
      loading: false,
      showPassword: false,
      showConfirmPassword: false,
      successMessage: '',
      errorMessage: '',
      token: '',
      form: {
        first_name: '',
        last_name: '',
        phone: '',
        password: '',
        confirmPassword: '',
      },
      nameRules: [
        v => !!v || 'Name is required',
        v => (v && v.length >= 2) || 'Name must be at least 2 characters',
      ],
      passwordRules: [
        v => !!v || 'Password is required',
        v => (v && v.length >= 8) || 'Password must be at least 8 characters',
        v =>
          /(?=.*[a-z])/.test(v) ||
          'Password must contain at least one lowercase letter',
        v =>
          /(?=.*[A-Z])/.test(v) ||
          'Password must contain at least one uppercase letter',
        v => /(?=.*\d)/.test(v) || 'Password must contain at least one number',
      ],
      confirmPasswordRules: [
        v => !!v || 'Please confirm your password',
        v => v === this.form.password || 'Passwords do not match',
      ],
    };
  },
  async mounted() {
    await this.validateToken();
  },
  methods: {
    async validateToken() {
      this.loadingToken = true;
      this.tokenError = '';

      // Get token from URL query parameter
      this.token = this.$route.query.token;

      if (!this.token) {
        this.tokenError =
          'No invitation token provided. Please check your invitation email.';
        this.loadingToken = false;
        return;
      }

      // For now, we'll just validate that the token exists
      // The backend will validate it when we submit the form
      this.loadingToken = false;
    },

    async handleRegistration() {
      if (!this.valid) return;

      this.loading = true;
      this.errorMessage = '';
      this.successMessage = '';

      try {
        const registrationData = {
          token: this.token,
          password: this.form.password,
          first_name: this.form.first_name,
          last_name: this.form.last_name,
          phone: this.form.phone || undefined,
        };

        console.log('Submitting registration:', {
          ...registrationData,
          password: '[HIDDEN]',
        });
        const response = await staffAPI.register(registrationData);
        console.log('Registration response:', response.data);

        this.successMessage =
          'Registration completed successfully! You can now log in.';

        // Wait 2 seconds then redirect to login
        setTimeout(() => {
          this.$router.push('/login');
        }, 2000);
      } catch (error) {
        console.error('Registration error:', error);
        this.errorMessage =
          error.response?.data?.error ||
          'Registration failed. Please try again.';
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
