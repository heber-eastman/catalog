<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-6">
          <v-card-title class="text-h4 text-center mb-4">
            Golf Course Signup
          </v-card-title>

          <v-card-text>
            <v-form ref="form" v-model="valid" @submit.prevent="handleSignup">
              <!-- Course Information -->
              <h3 class="mb-4">Course Information</h3>

              <v-text-field
                v-model="form.course_name"
                label="Course Name"
                :rules="courseNameRules"
                required
                variant="outlined"
                class="mb-3"
                data-cy="course-name-input"
              />

              <v-text-field
                v-model="form.street"
                label="Street Address"
                :rules="streetRules"
                required
                variant="outlined"
                class="mb-3"
                data-cy="street-input"
              />

              <v-row>
                <v-col cols="6">
                                  <v-text-field
                  v-model="form.city"
                  label="City"
                  :rules="cityRules"
                  required
                  variant="outlined"
                  data-cy="city-input"
                />
                </v-col>
                <v-col cols="3">
                                  <v-text-field
                  v-model="form.state"
                  label="State"
                  :rules="stateRules"
                  required
                  variant="outlined"
                  data-cy="state-input"
                />
                </v-col>
                <v-col cols="3">
                  <v-text-field
                    v-model="form.postal_code"
                    label="Zip Code"
                    :rules="postalCodeRules"
                    required
                    variant="outlined"
                    data-cy="postal-code-input"
                  />
                </v-col>
              </v-row>

              <!-- Admin User Information -->
              <h3 class="mb-4 mt-4">Primary Admin Information</h3>

              <v-row>
                <v-col cols="6">
                  <v-text-field
                    v-model="form.admin_first_name"
                    label="First Name"
                    :rules="nameRules"
                    required
                    variant="outlined"
                    data-cy="admin-first-name-input"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="form.admin_last_name"
                    label="Last Name"
                    :rules="nameRules"
                    required
                    variant="outlined"
                    data-cy="admin-last-name-input"
                  />
                </v-col>
              </v-row>

              <v-text-field
                v-model="form.admin_email"
                label="Email Address"
                type="email"
                :rules="emailRules"
                required
                variant="outlined"
                class="mb-3"
                data-cy="admin-email-input"
              />

              <v-text-field
                v-model="form.admin_password"
                label="Password"
                type="password"
                :rules="passwordRules"
                required
                variant="outlined"
                class="mb-3"
                data-cy="admin-password-input"
              />

              <v-text-field
                v-model="form.admin_phone"
                label="Phone Number"
                variant="outlined"
                class="mb-4"
                data-cy="admin-phone-input"
              />

              <!-- Submit Button -->
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                :disabled="!valid"
                data-cy="signup-button"
              >
                Create Golf Course
              </v-btn>
            </v-form>
          </v-card-text>

          <!-- Success Message -->
          <v-card-text v-if="successMessage" class="text-center">
            <v-alert type="success" class="mb-4">
              {{ successMessage }}
            </v-alert>
          </v-card-text>

          <!-- Error Message -->
          <v-card-text v-if="errorMessage" class="text-center">
            <v-alert type="error" class="mb-4">
              {{ errorMessage }}
            </v-alert>
          </v-card-text>

          <v-card-actions class="justify-center">
            <v-btn
              variant="text"
              color="primary"
              @click="$router.push('/login')"
            >
              Already have an account? Login
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { authAPI } from '@/services/api';

export default {
  name: 'Signup',
  data() {
    return {
      valid: false,
      loading: false,
      successMessage: '',
      errorMessage: '',
      form: {
        course_name: '',
        street: '',
        city: '',
        state: '',
        postal_code: '',
        admin_first_name: '',
        admin_last_name: '',
        admin_email: '',
        admin_password: '',
        admin_phone: '',
      },
      courseNameRules: [
        v => !!v || 'Course name is required',
        v =>
          (v && v.length >= 2) || 'Course name must be at least 2 characters',
      ],
      streetRules: [
        v => !!v || 'Street address is required',
        v =>
          (v && v.length >= 5) || 'Street address must be at least 5 characters long',
      ],
      postalCodeRules: [
        v => !!v || 'Postal code is required',
        v =>
          /^[A-Za-z0-9\s-]{3,10}$/.test(v) || 'Please provide a valid postal code',
      ],
      cityRules: [
        v => !!v || 'City is required',
        v => (v && v.length >= 2) || 'City must be at least 2 characters long',
      ],
      stateRules: [
        v => !!v || 'State is required',
        v => (v && v.length >= 2) || 'State must be at least 2 characters long',
      ],
      nameRules: [
        v => !!v || 'Name is required',
        v => (v && v.length >= 2) || 'Name must be at least 2 characters',
      ],
      emailRules: [
        v => !!v || 'Email is required',
        v => /.+@.+\..+/.test(v) || 'Email must be valid',
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
        v =>
          /(?=.*[!@#$%^&*])/.test(v) ||
          'Password must contain at least one special character (!@#$%^&*)',
      ],
    };
  },
  methods: {
    async handleSignup() {
      if (!this.valid) return;

      this.loading = true;
      this.errorMessage = '';
      this.successMessage = '';

      try {
        console.log('Sending signup data:', this.form);
        const response = await authAPI.signup(this.form);
        console.log('Signup response:', response.data);

        this.successMessage = `Course created successfully! Check your email (${this.form.admin_email}) for confirmation instructions.`;

        // Reset form
        this.$refs.form.reset();
      } catch (error) {
        console.error('Signup error:', error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        
        // Show detailed error message
        let errorMessage = 'An error occurred during signup';
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
          
          // If there are validation details, show them
          if (error.response.data.details) {
            errorMessage += ': ';
            if (Array.isArray(error.response.data.details)) {
              errorMessage += error.response.data.details.map(d => d.message || d).join(', ');
            } else {
              errorMessage += JSON.stringify(error.response.data.details);
            }
          }
        }
        
        this.errorMessage = errorMessage;
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
