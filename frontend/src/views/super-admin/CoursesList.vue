<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <h1>Golf Courses Management</h1>
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            @click="showCreateDialog = true"
            data-cy="add-course-btn"
          >
            Add Golf Course
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Courses Table -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-text-field
              v-model="search"
              append-inner-icon="mdi-magnify"
              label="Search courses..."
              single-line
              hide-details
              class="ma-2"
            />
          </v-card-title>

          <v-data-table
            :headers="headers"
            :items="courses"
            :loading="loading"
            :search="search"
            class="elevation-1"
          >
            <template #item.status="{ item }">
              <v-chip :color="getStatusColor(item.status)" size="small">
                {{ item.status }}
              </v-chip>
            </template>

            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-pencil"
                size="small"
                variant="text"
                @click="editCourse(item)"
                data-cy="edit-course-btn"
              />
              <v-btn
                icon="mdi-toggle-switch"
                size="small"
                variant="text"
                color="warning"
                @click="toggleCourseStatus(item)"
                data-cy="toggle-status-btn"
              />
            </template>

            <template #no-data>
              <v-alert type="info" class="ma-4">
                No golf courses found. Add your first golf course to get
                started!
              </v-alert>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- API Test Section -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>Super Admin API Test Results</v-card-title>
          <v-card-text>
            <div class="d-flex ga-2 mb-4">
              <v-btn color="primary" @click="loadCourses" :loading="loading">
                Reload Courses
              </v-btn>
              <v-btn color="secondary" @click="testCreateCourse">
                Test Create Course
              </v-btn>
            </div>

            <div v-if="lastApiResponse">
              <h4>Last API Response:</h4>
              <pre class="mt-2 pa-2 bg-grey-lighten-4 rounded">{{
                lastApiResponse
              }}</pre>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create Course Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="600px">
      <v-card>
        <v-card-title>Add New Golf Course</v-card-title>
        <v-card-text>
          <v-form ref="createForm" v-model="createFormValid">
            <v-text-field
              v-model="newCourse.name"
              label="Course Name"
              :rules="[v => !!v || 'Course name is required']"
              required
              data-cy="create-course-name"
            />
            <v-text-field
              v-model="newCourse.street"
              label="Street Address"
              data-cy="create-course-street"
            />
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="newCourse.city"
                  label="City"
                  data-cy="create-course-city"
                />
              </v-col>
              <v-col cols="3">
                <v-text-field
                  v-model="newCourse.state"
                  label="State"
                  data-cy="create-course-state"
                />
              </v-col>
              <v-col cols="3">
                <v-text-field
                  v-model="newCourse.postal_code"
                  label="Zip Code"
                  data-cy="create-course-zip"
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="newCourse.country"
              label="Country"
              placeholder="US"
              data-cy="create-course-country"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="showCreateDialog = false"
            data-cy="create-course-cancel"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            @click="createCourse"
            :disabled="!createFormValid"
            :loading="creating"
            data-cy="create-course-submit"
          >
            Create Course
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Course Dialog -->
    <v-dialog v-model="showEditDialog" max-width="600px">
      <v-card>
        <v-card-title>Edit Golf Course</v-card-title>
        <v-card-text>
          <v-form ref="editForm" v-model="editFormValid">
            <v-text-field
              v-model="editCourseData.name"
              label="Course Name"
              :rules="[v => !!v || 'Course name is required']"
              required
              data-cy="edit-course-name"
            />
            <v-text-field
              v-model="editCourseData.street"
              label="Street Address"
              data-cy="edit-course-street"
            />
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model="editCourseData.city"
                  label="City"
                  data-cy="edit-course-city"
                />
              </v-col>
              <v-col cols="3">
                <v-text-field
                  v-model="editCourseData.state"
                  label="State"
                  data-cy="edit-course-state"
                />
              </v-col>
              <v-col cols="3">
                <v-text-field
                  v-model="editCourseData.postal_code"
                  label="Zip Code"
                  data-cy="edit-course-zip"
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="editCourseData.country"
              label="Country"
              placeholder="US"
              data-cy="edit-course-country"
            />
            <v-select
              v-model="editCourseData.status"
              label="Status"
              :items="statusOptions"
              data-cy="edit-course-status"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showEditDialog = false" data-cy="edit-course-cancel"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            @click="updateCourse"
            :disabled="!editFormValid"
            :loading="updating"
            data-cy="edit-course-submit"
          >
            Update Course
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Status Change Confirmation Dialog -->
    <v-dialog v-model="showStatusDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h5">Confirm Status Change</v-card-title>
        <v-card-text>
          Are you sure you want to change the status of
          <strong>{{ selectedCourse?.name }}</strong> to
          <strong>{{ newStatus }}</strong
          >?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            @click="showStatusDialog = false"
            data-cy="status-change-cancel"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            @click="confirmStatusChange"
            :loading="changingStatus"
            data-cy="status-change-confirm"
          >
            Confirm
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import { superAdminAPI } from '@/services/api';

export default {
  name: 'CoursesList',
  data() {
    return {
      courses: [],
      loading: false,
      creating: false,
      updating: false,
      changingStatus: false,
      search: '',
      showCreateDialog: false,
      showEditDialog: false,
      showStatusDialog: false,
      createFormValid: false,
      editFormValid: false,
      lastApiResponse: '',
      selectedCourse: null,
      newStatus: '',
      newCourse: {
        name: '',
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
      },
      editCourseData: {
        id: null,
        name: '',
        street: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
        status: 'active',
      },
      statusOptions: [
        { title: 'Active', value: 'active' },
        { title: 'Inactive', value: 'inactive' },
        { title: 'Pending', value: 'pending' },
      ],
      headers: [
        { title: 'Course Name', key: 'name' },
        { title: 'Location', key: 'location' },
        { title: 'Status', key: 'status' },
        { title: 'Created', key: 'created_at' },
        { title: 'Actions', key: 'actions', sortable: false },
      ],
    };
  },
  async mounted() {
    await this.loadCourses();
  },
  methods: {
    async loadCourses() {
      this.loading = true;
      try {
        console.log('Loading courses...');
        const response = await superAdminAPI.getCourses();
        this.courses = response.data.courses || response.data || [];

        // Add computed location property
        this.courses = this.courses.map(course => ({
          ...course,
          location: this.formatLocation(course),
        }));

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Courses loaded:', response.data);
      } catch (error) {
        console.error('Error loading courses:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      } finally {
        this.loading = false;
      }
    },

    async createCourse() {
      if (!this.createFormValid) return;

      this.creating = true;
      try {
        console.log('Creating course:', this.newCourse);
        const response = await superAdminAPI.createCourse(this.newCourse);

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Course created:', response.data);

        // Close dialog and reload courses
        this.showCreateDialog = false;
        this.newCourse = {
          name: '',
          street: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
        };
        await this.loadCourses();
      } catch (error) {
        console.error('Error creating course:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      } finally {
        this.creating = false;
      }
    },

    async testCreateCourse() {
      const testCourse = {
        name: `Test Golf Course ${Date.now()}`,
        street: '123 Golf Course Dr',
        city: 'Golf City',
        state: 'CA',
        postal_code: '90210',
        country: 'US',
      };

      try {
        console.log('Testing create course API with:', testCourse);
        const response = await superAdminAPI.createCourse(testCourse);

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Test course created:', response.data);

        // Reload courses to show the new one
        await this.loadCourses();
      } catch (error) {
        console.error('Error in test create course:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      }
    },

    toggleCourseStatus(course) {
      this.selectedCourse = course;
      this.newStatus = course.status === 'active' ? 'inactive' : 'active';
      this.showStatusDialog = true;
    },

    async confirmStatusChange() {
      if (!this.selectedCourse || !this.newStatus) return;

      this.changingStatus = true;
      try {
        console.log(
          `Updating course ${this.selectedCourse.name} status to ${this.newStatus}`
        );
        const response = await superAdminAPI.updateCourseStatus(
          this.selectedCourse.id,
          this.newStatus
        );

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Course status updated:', response.data);

        // Close dialog and reload courses
        this.showStatusDialog = false;
        this.selectedCourse = null;
        this.newStatus = '';
        await this.loadCourses();
      } catch (error) {
        console.error('Error updating course status:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      } finally {
        this.changingStatus = false;
      }
    },

    formatLocation(course) {
      const parts = [course.city, course.state].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : 'No location specified';
    },

    getStatusColor(status) {
      const colors = {
        active: 'success',
        inactive: 'error',
        pending: 'warning',
      };
      return colors[status] || 'default';
    },

    editCourse(course) {
      console.log('Edit course:', course);
      this.editCourseData = {
        id: course.id,
        name: course.name,
        street: course.street || '',
        city: course.city || '',
        state: course.state || '',
        postal_code: course.postal_code || '',
        country: course.country || 'US',
        status: course.status || 'active',
      };
      this.showEditDialog = true;
    },

    async updateCourse() {
      if (!this.editFormValid) return;

      this.updating = true;
      try {
        console.log('Updating course:', this.editCourseData);
        const response = await superAdminAPI.updateCourse(
          this.editCourseData.id,
          this.editCourseData
        );

        this.lastApiResponse = JSON.stringify(response.data, null, 2);
        console.log('Course updated:', response.data);

        // Close dialog and reload courses
        this.showEditDialog = false;
        this.editCourseData = {
          id: null,
          name: '',
          street: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
          status: 'active',
        };
        await this.loadCourses();
      } catch (error) {
        console.error('Error updating course:', error);
        this.lastApiResponse = JSON.stringify(
          {
            error: error.response?.data?.error || error.message,
          },
          null,
          2
        );
      } finally {
        this.updating = false;
      }
    },
  },
};
</script>

<style scoped>
pre {
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
}
</style>
