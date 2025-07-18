<template>
  <AppLayout>
    <div class="mapping-editor">
      <!-- Header -->
      <div class="editor-header">
        <div class="header-content">
          <h1 class="page-title">
            {{ isEditMode ? "Edit Mapping" : "Create New Mapping" }}
          </h1>
          <p class="page-subtitle">
            {{
              isEditMode
                ? "Modify mapping configuration and field mappings"
                : "Set up a new data mapping between systems"
            }}
          </p>
        </div>
        <div class="header-actions">
          <button
            @click="handleCancel"
            class="clean-button clean-button-secondary"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            class="clean-button clean-button-primary"
            :disabled="!isValid || saving"
          >
            <v-icon v-if="!saving" size="18">mdi-content-save</v-icon>
            <v-progress-circular v-else indeterminate size="16" width="2" />
            {{
              saving
                ? "Saving..."
                : isEditMode
                  ? "Save Changes"
                  : "Create Mapping"
            }}
          </button>
        </div>
      </div>

      <!-- Main Form -->
      <div class="editor-content">
        <!-- Basic Information Section -->
        <div class="form-section">
          <h2 class="section-title">
            <v-icon size="20">mdi-information-outline</v-icon>
            Basic Information
          </h2>
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="form-label required">Mapping Name</label>
              <input
                v-model="formData.name"
                type="text"
                class="clean-form-input"
                :class="{ error: errors.name }"
                placeholder="Enter a descriptive name for this mapping"
                @blur="validateName"
              />
              <span v-if="errors.name" class="error-message">{{
                errors.name
              }}</span>
            </div>
            <div class="form-group full-width">
              <label class="form-label">Description</label>
              <textarea
                v-model="formData.description"
                class="clean-form-textarea"
                placeholder="Optional description of what this mapping does"
                rows="3"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- System Configuration Section -->
        <div class="form-section">
          <h2 class="section-title">
            <v-icon size="20">mdi-database-outline</v-icon>
            System Configuration
          </h2>
          <div class="form-grid">
            <!-- Source System -->
            <div class="form-group">
              <label class="form-label">Source System</label>
              <div class="system-selector">
                <div
                  class="system-display"
                  :class="{ 'has-value': formData.sourceSystemId }"
                  @click="openSourceSystemDialog"
                >
                  <div v-if="sourceSystem" class="selected-system">
                    <v-icon size="24">{{
                      getSystemIcon(sourceSystem.type)
                    }}</v-icon>
                    <div class="system-info">
                      <span class="system-name">{{ sourceSystem.name }}</span>
                      <span class="system-type">{{ sourceSystem.type }}</span>
                    </div>
                  </div>
                  <div v-else class="placeholder">
                    <v-icon size="20">mdi-database-export</v-icon>
                    <span>Select source system</span>
                  </div>
                  <v-icon class="action-icon">mdi-magnify</v-icon>
                </div>
                <button
                  v-if="formData.sourceSystemId"
                  @click.stop="clearSourceSystem"
                  class="clear-button"
                  title="Clear selection"
                >
                  <v-icon size="18">mdi-close</v-icon>
                </button>
              </div>
            </div>

            <!-- Target System -->
            <div class="form-group">
              <label class="form-label">Target System</label>
              <div class="system-selector">
                <div
                  class="system-display"
                  :class="{ 'has-value': formData.targetSystemId }"
                  @click="openTargetSystemDialog"
                >
                  <div v-if="targetSystem" class="selected-system">
                    <v-icon size="24">{{
                      getSystemIcon(targetSystem.type)
                    }}</v-icon>
                    <div class="system-info">
                      <span class="system-name">{{ targetSystem.name }}</span>
                      <span class="system-type">{{ targetSystem.type }}</span>
                    </div>
                  </div>
                  <div v-else class="placeholder">
                    <v-icon size="20">mdi-database-import</v-icon>
                    <span>Select target system</span>
                  </div>
                  <v-icon class="action-icon">mdi-magnify</v-icon>
                </div>
                <button
                  v-if="formData.targetSystemId"
                  @click.stop="clearTargetSystem"
                  class="clear-button"
                  title="Clear selection"
                >
                  <v-icon size="18">mdi-close</v-icon>
                </button>
              </div>
            </div>
          </div>

          <!-- Same System Notice -->
          <div v-if="isSameSystem" class="info-banner">
            <v-icon size="20">mdi-information</v-icon>
            <span
              >Source and target are the same system. This is useful for
              table-to-table mappings within the same database.</span
            >
          </div>
        </div>

        <!-- Advanced Options Section (Collapsible) -->
        <div class="form-section">
          <button
            @click="showAdvanced = !showAdvanced"
            class="section-title clickable"
          >
            <v-icon size="20">{{
              showAdvanced ? "mdi-chevron-down" : "mdi-chevron-right"
            }}</v-icon>
            Advanced Options
            <span class="section-subtitle">Optional configuration</span>
          </button>

          <div v-show="showAdvanced" class="form-content">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Mapping Status</label>
                <select v-model="formData.status" class="clean-form-select">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select v-model="formData.priority" class="clean-form-select">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div class="form-group full-width">
                <label class="form-label">Tags</label>
                <input
                  v-model="formData.tags"
                  type="text"
                  class="clean-form-input"
                  placeholder="Enter tags separated by commas"
                />
                <span class="form-hint"
                  >Use tags to organize and filter mappings</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Field Mappings Section (if systems are selected) -->
        <div
          v-if="formData.sourceSystemId && formData.targetSystemId"
          class="form-section"
        >
          <h2 class="section-title">
            <v-icon size="20">mdi-table-arrow-right</v-icon>
            Field Mappings
          </h2>
          <div class="field-mapping-notice">
            <v-icon size="48" color="primary">mdi-table-edit</v-icon>
            <h3>Configure Field Mappings</h3>
            <p>
              After creating the mapping, you can configure detailed field
              mappings and transformations.
            </p>
            <p class="hint">
              This section will be available in edit mode with a visual mapping
              interface.
            </p>
          </div>
        </div>
      </div>

      <!-- System Search Dialogs -->
      <SystemSearchDialog
        v-model="showSourceSystemDialog"
        title="Select Source System"
        :current-system-id="formData.sourceSystemId"
        @select="handleSourceSystemSelect"
      />

      <SystemSearchDialog
        v-model="showTargetSystemDialog"
        title="Select Target System"
        :current-system-id="formData.targetSystemId"
        @select="handleTargetSystemSelect"
      />
    </div>
  </AppLayout>
</template>

<script>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSystemStore } from "@/stores/system";
import { useAppStore } from "@/stores/app";
import { mappingApi } from "@/services/api";
import AppLayout from "@/components/AppLayout.vue";
import SystemSearchDialog from "@/components/SystemSearchDialog.vue";

export default {
  name: "MappingEditor",

  components: {
    AppLayout,
    SystemSearchDialog,
  },

  setup() {
    const route = useRoute();
    const router = useRouter();
    const systemStore = useSystemStore();
    const appStore = useAppStore();

    // Form state
    const formData = ref({
      name: "",
      description: "",
      sourceSystemId: null,
      targetSystemId: null,
      status: "draft",
      priority: "medium",
      tags: "",
      mappingRules: {},
    });

    const errors = ref({});
    const saving = ref(false);
    const loading = ref(false);
    const showAdvanced = ref(false);

    // Dialog state
    const showSourceSystemDialog = ref(false);
    const showTargetSystemDialog = ref(false);

    // Computed
    const isEditMode = computed(() => !!route.params.id);
    const mappingId = computed(() => route.params.id);

    const isValid = computed(() => {
      return formData.value.name && !errors.value.name;
    });

    const sourceSystem = computed(() => {
      if (!formData.value.sourceSystemId) return null;
      return systemStore.systems.find(
        (s) => s.id === formData.value.sourceSystemId,
      );
    });

    const targetSystem = computed(() => {
      if (!formData.value.targetSystemId) return null;
      return systemStore.systems.find(
        (s) => s.id === formData.value.targetSystemId,
      );
    });

    const isSameSystem = computed(() => {
      return (
        formData.value.sourceSystemId &&
        formData.value.targetSystemId &&
        formData.value.sourceSystemId === formData.value.targetSystemId
      );
    });

    // Methods
    const validateName = () => {
      if (!formData.value.name) {
        errors.value.name = "Mapping name is required";
      } else if (formData.value.name.length < 3) {
        errors.value.name = "Name must be at least 3 characters";
      } else {
        delete errors.value.name;
      }
    };

    const openSourceSystemDialog = () => {
      showSourceSystemDialog.value = true;
    };

    const openTargetSystemDialog = () => {
      showTargetSystemDialog.value = true;
    };

    const handleSourceSystemSelect = (system) => {
      formData.value.sourceSystemId = system.id;
    };

    const handleTargetSystemSelect = (system) => {
      formData.value.targetSystemId = system.id;
    };

    const clearSourceSystem = () => {
      formData.value.sourceSystemId = null;
    };

    const clearTargetSystem = () => {
      formData.value.targetSystemId = null;
    };

    const getSystemIcon = (type) => {
      const icons = {
        postgresql: "mdi-elephant",
        mysql: "mdi-database",
        oracle: "mdi-database",
        mssql: "mdi-microsoft",
        sqlite: "mdi-database",
        mongodb: "mdi-leaf",
        ftp: "mdi-folder-network",
        sftp: "mdi-folder-lock",
        local_fs: "mdi-folder",
        aws_s3: "mdi-aws",
        azure_blob: "mdi-microsoft-azure",
      };
      return icons[type] || "mdi-database";
    };

    const loadMapping = async () => {
      if (!isEditMode.value) return;

      loading.value = true;
      try {
        const response = await mappingApi.getById(mappingId.value);
        const mapping = response.data;

        // Populate form data
        formData.value = {
          name: mapping.name || "",
          description: mapping.description || "",
          sourceSystemId: mapping.sourceSystemId,
          targetSystemId: mapping.targetSystemId,
          status: mapping.status || "draft",
          priority: mapping.priority || "medium",
          tags: mapping.tags ? mapping.tags.join(", ") : "",
          mappingRules: mapping.mappingRules || {},
        };
      } catch (error) {
        console.error("Failed to load mapping:", error);
        appStore.showError("Failed to load mapping");
        router.push("/mappings");
      } finally {
        loading.value = false;
      }
    };

    const handleSave = async () => {
      validateName();
      if (!isValid.value) return;

      saving.value = true;
      try {
        const data = {
          name: formData.value.name,
          description: formData.value.description,
          sourceSystemId: formData.value.sourceSystemId,
          targetSystemId: formData.value.targetSystemId,
          status: formData.value.status,
          priority: formData.value.priority,
          tags: formData.value.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag),
          mappingRules: formData.value.mappingRules,
        };

        if (isEditMode.value) {
          await mappingApi.update(mappingId.value, data);
          appStore.showSuccess("Mapping updated successfully");
        } else {
          const response = await mappingApi.create(data);
          appStore.showSuccess("Mapping created successfully");

          // Navigate to edit mode for the new mapping
          router.push(`/mappings/${response.data.id}/edit`);
        }
      } catch (error) {
        console.error("Failed to save mapping:", error);
        appStore.showError(
          error.response?.data?.error ||
            `Failed to ${isEditMode.value ? "update" : "create"} mapping`,
        );
      } finally {
        saving.value = false;
      }
    };

    const handleCancel = () => {
      router.push("/mappings");
    };

    // Auto-save draft
    let saveTimeout = null;
    watch(
      formData,
      (newData) => {
        if (!isEditMode.value) return;

        // Clear existing timeout
        if (saveTimeout) clearTimeout(saveTimeout);

        // Set new timeout for auto-save
        saveTimeout = setTimeout(() => {
          if (newData.name && isValid.value) {
            // In a real implementation, this would save a draft
            console.log("Auto-saving draft...");
          }
        }, 2000);
      },
      { deep: true },
    );

    // Lifecycle
    onMounted(async () => {
      // Load systems
      try {
        await systemStore.fetchSystems();
      } catch (error) {
        console.error("Failed to load systems:", error);
      }

      // Load mapping if in edit mode
      if (isEditMode.value) {
        await loadMapping();
      }
    });

    return {
      // State
      formData,
      errors,
      saving,
      loading,
      showAdvanced,
      showSourceSystemDialog,
      showTargetSystemDialog,

      // Computed
      isEditMode,
      isValid,
      sourceSystem,
      targetSystem,
      isSameSystem,

      // Methods
      validateName,
      openSourceSystemDialog,
      openTargetSystemDialog,
      handleSourceSystemSelect,
      handleTargetSystemSelect,
      clearSourceSystem,
      clearTargetSystem,
      getSystemIcon,
      handleSave,
      handleCancel,
    };
  },
};
</script>

<style scoped>
.mapping-editor {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6);
}

/* Header */
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-8);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--gray-100);
}

.header-content {
  flex: 1;
}

.page-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-bold);
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--gray-600);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--space-3);
}

/* Form Sections */
.form-section {
  background: var(--white);
  border: 1px solid var(--gray-100);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  margin-bottom: var(--space-6);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-4) 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-title.clickable {
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  width: 100%;
  text-align: left;
  transition: all var(--transition-base);
}

.section-title.clickable:hover {
  color: var(--primary);
}

.section-subtitle {
  font-size: var(--font-size-sm);
  font-weight: var(--font-normal);
  color: var(--gray-600);
  margin-left: auto;
}

.form-content {
  margin-top: var(--space-4);
}

/* Form Grid */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--gray-700);
}

.form-label.required::after {
  content: " *";
  color: var(--error);
}

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--gray-600);
}

.error-message {
  font-size: var(--font-size-xs);
  color: var(--error);
}

/* System Selector */
.system-selector {
  position: relative;
  display: flex;
  gap: var(--space-2);
}

.system-display {
  flex: 1;
  min-height: 48px;
  background: var(--white);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-base);
  padding: var(--space-3);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.system-display:hover {
  border-color: var(--gray-400);
  background: var(--gray-50);
}

.system-display.has-value {
  border-color: var(--primary);
}

.selected-system {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.system-info {
  display: flex;
  flex-direction: column;
}

.system-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-medium);
  color: var(--gray-900);
}

.system-type {
  font-size: var(--font-size-xs);
  color: var(--gray-600);
  text-transform: uppercase;
}

.placeholder {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--gray-500);
}

.action-icon {
  color: var(--gray-400);
}

.clear-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--white);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.clear-button:hover {
  background: var(--error-soft);
  border-color: var(--error);
  color: var(--error);
}

/* Info Banner */
.info-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--info-soft);
  border: 1px solid var(--info-200);
  border-radius: var(--radius-base);
  margin-top: var(--space-4);
  font-size: var(--font-size-sm);
  color: var(--info);
}

/* Field Mapping Notice */
.field-mapping-notice {
  text-align: center;
  padding: var(--space-8);
  color: var(--gray-600);
}

.field-mapping-notice h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: var(--space-3) 0 var(--space-2) 0;
}

.field-mapping-notice p {
  font-size: var(--font-size-base);
  margin: 0;
}

.field-mapping-notice .hint {
  font-size: var(--font-size-sm);
  color: var(--gray-500);
  margin-top: var(--space-2);
}

/* Responsive */
@media (max-width: 768px) {
  .mapping-editor {
    padding: var(--space-4);
  }

  .editor-header {
    flex-direction: column;
    gap: var(--space-4);
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-section {
    padding: var(--space-4);
  }
}
</style>
