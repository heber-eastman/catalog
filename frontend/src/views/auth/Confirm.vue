<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6" lg="4">
        <v-card class="pa-6 text-center">
          <v-card-title class="text-h4 mb-4">
            Account Confirmation
          </v-card-title>

          <!-- Loading State -->
          <v-card-text v-if="loading">
            <v-progress-circular
              indeterminate
              color="primary"
              size="64"
              class="mb-4"
            />
            <p>Confirming your account...</p>
          </v-card-text>

          <!-- Success State -->
          <v-card-text v-else-if="confirmed">
            <v-icon
              icon="mdi-check-circle"
              color="success"
              size="64"
              class="mb-4"
            />
            <h3 class="text-success mb-3">Account Confirmed!</h3>
            <p class="mb-4">
              Your golf course account has been successfully confirmed. You can
              now log in to access your dashboard.
            </p>
            <v-btn color="primary" size="large" @click="$router.push('/login')">
              Go to Login
            </v-btn>
          </v-card-text>

          <!-- Error State -->
          <v-card-text v-else-if="error">
            <v-icon
              icon="mdi-alert-circle"
              color="error"
              size="64"
              class="mb-4"
            />
            <h3 class="text-error mb-3">Confirmation Failed</h3>
            <v-alert type="error" variant="outlined" class="mb-4">
              {{ error }}
            </v-alert>
            <div class="d-flex flex-column ga-2">
              <v-btn
                color="primary"
                variant="outlined"
                @click="retryConfirmation"
              >
                Try Again
              </v-btn>
              <v-btn
                color="primary"
                variant="text"
                @click="$router.push('/signup')"
              >
                Back to Signup
              </v-btn>
            </div>
          </v-card-text>

          <!-- No Token State -->
          <v-card-text v-else>
            <v-icon
              icon="mdi-help-circle"
              color="warning"
              size="64"
              class="mb-4"
            />
            <h3 class="text-warning mb-3">No Confirmation Token</h3>
            <p class="mb-4">
              Please check your email for the confirmation link or request a new
              confirmation email.
            </p>
            <v-btn color="primary" @click="$router.push('/signup')">
              Back to Signup
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { authAPI } from '@/services/api';

export default {
  name: 'Confirm',
  data() {
    return {
      loading: false,
      confirmed: false,
      error: null,
    };
  },
  async mounted() {
    const token = this.$route.query.token;
    if (token) {
      await this.confirmAccount(token);
    }
  },
  methods: {
    async confirmAccount(token) {
      this.loading = true;
      this.error = null;

      try {
        const response = await authAPI.confirm(token);
        console.log('Confirmation response:', response.data);

        this.confirmed = true;

        // Optional: Auto-redirect to login after a few seconds
        setTimeout(() => {
          this.$router.push('/login');
        }, 3000);
      } catch (error) {
        console.error('Confirmation error:', error);
        this.error =
          error.response?.data?.error ||
          'Failed to confirm account. The token may be invalid or expired.';
      } finally {
        this.loading = false;
      }
    },
    async retryConfirmation() {
      const token = this.$route.query.token;
      if (token) {
        await this.confirmAccount(token);
      }
    },
  },
  watch: {
    '$route.query.token': {
      handler(newToken) {
        if (newToken && !this.confirmed) {
          this.confirmAccount(newToken);
        }
      },
      immediate: true,
    },
  },
};
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
