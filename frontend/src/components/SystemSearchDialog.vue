<template>
  <v-dialog v-model="dialogVisible" max-width="800px" persistent>
    <div class="system-search-dialog">
      <!-- Dialog Header -->
      <div class="dialog-header">
        <h2>{{ title }}</h2>
        <button @click="close" class="close-button">
          <v-icon>mdi-close</v-icon>
        </button>
      </div>

      <!-- Search and Filters -->
      <div class="search-section">
        <div class="search-input-wrapper">
          <v-icon class="search-icon">mdi-magnify</v-icon>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name, type, or description..."
            class="search-input"
            @input="handleSearch"
          />
          <button v-if="searchQuery" @click="clearSearch" class="clear-search">
            <v-icon size="18">mdi-close-circle</v-icon>
          </button>
        </div>

        <!-- Filter Chips -->
        <div class="filter-chips">
          <div class="chip-group">
            <span class="chip-label">Type:</span>
            <button
              v-for="type in systemTypes"
              :key="type.value"
              class="filter-chip"
              :class="{ active: selectedTypes.includes(type.value) }"
              @click="toggleType(type.value)"
            >
              <v-icon size="16">{{ type.icon }}</v-icon>
              {{ type.text }}
            </button>
          </div>

          <div class="chip-group">
            <span class="chip-label">Status:</span>
            <button
              class="filter-chip"
              :class="{ active: statusFilter === 'all' }"
              @click="statusFilter = 'all'"
            >
              All
            </button>
            <button
              class="filter-chip"
              :class="{ active: statusFilter === 'active' }"
              @click="statusFilter = 'active'"
            >
              <v-icon size="16" color="success">mdi-check-circle</v-icon>
              Active
            </button>
            <button
              class="filter-chip"
              :class="{ active: statusFilter === 'inactive' }"
              @click="statusFilter = 'inactive'"
            >
              <v-icon size="16" color="error">mdi-pause-circle</v-icon>
              Inactive
            </button>
          </div>
        </div>
      </div>

      <!-- Systems List -->
      <div class="systems-container">
        <div v-if="loading" class="loading-state">
          <v-progress-circular indeterminate color="primary" />
          <span>Loading systems...</span>
        </div>

        <div v-else-if="filteredSystems.length === 0" class="empty-state">
          <v-icon size="48" color="grey">mdi-database-off</v-icon>
          <h3>No systems found</h3>
          <p
            v-if="
              searchQuery || selectedTypes.length > 0 || statusFilter !== 'all'
            "
          >
            Try adjusting your search criteria
          </p>
          <p v-else>No systems available</p>
        </div>

        <div v-else class="systems-grid">
          <div
            v-for="system in paginatedSystems"
            :key="system.id"
            class="system-card"
            :class="{
              selected: selectedSystem?.id === system.id,
              disabled: !system.isActive && requireActive,
            }"
            @click="selectSystem(system)"
          >
            <div class="system-header">
              <div class="system-icon">
                <v-icon size="28">{{ getSystemIcon(system.type) }}</v-icon>
              </div>
              <div class="system-info">
                <h3>{{ system.name }}</h3>
                <p class="system-type">{{ system.type }}</p>
              </div>
              <div class="system-status" :class="getStatusClass(system)">
                <v-icon size="16">{{ getStatusIcon(system) }}</v-icon>
                {{ getStatusText(system) }}
              </div>
            </div>

            <div v-if="system.description" class="system-description">
              {{ system.description }}
            </div>

            <div class="system-details">
              <div class="detail-item">
                <v-icon size="14">mdi-server</v-icon>
                <span>{{ getConnectionInfo(system) }}</span>
              </div>
              <div v-if="system.lastConnectionTest" class="detail-item">
                <v-icon size="14">mdi-clock-outline</v-icon>
                <span
                  >Last tested:
                  {{ formatDate(system.lastConnectionTest) }}</span
                >
              </div>
              <div v-if="system.lastConnectionLatency" class="detail-item">
                <v-icon size="14">mdi-speedometer</v-icon>
                <span>{{ system.lastConnectionLatency }}ms latency</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="page-button"
          >
            <v-icon>mdi-chevron-left</v-icon>
          </button>
          <span class="page-info">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="page-button"
          >
            <v-icon>mdi-chevron-right</v-icon>
          </button>
        </div>
      </div>

      <!-- Dialog Footer -->
      <div class="dialog-footer">
        <div class="footer-info">
          <span v-if="selectedSystem">
            Selected: <strong>{{ selectedSystem.name }}</strong>
          </span>
        </div>
        <div class="footer-actions">
          <button @click="close" class="clean-button clean-button-secondary">
            Cancel
          </button>
          <button
            @click="confirm"
            :disabled="!selectedSystem"
            class="clean-button clean-button-primary"
          >
            Select System
          </button>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script>
import { ref, computed, watch, onMounted } from "vue";
import { useSystemStore } from "@/stores/system";

export default {
  name: "SystemSearchDialog",

  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: "Select System",
    },
    currentSystemId: {
      type: String,
      default: null,
    },
    excludeSystemId: {
      type: String,
      default: null,
    },
    requireActive: {
      type: Boolean,
      default: false,
    },
  },

  emits: ["update:modelValue", "select"],

  setup(props, { emit }) {
    const systemStore = useSystemStore();

    // Dialog state
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value) => emit("update:modelValue", value),
    });

    // Search and filter state
    const searchQuery = ref("");
    const selectedTypes = ref([]);
    const statusFilter = ref("all");
    const currentPage = ref(1);
    const itemsPerPage = 9;

    // Selection state
    const selectedSystem = ref(null);
    const loading = ref(false);

    // System types configuration
    const systemTypes = ref([
      { value: "postgresql", text: "PostgreSQL", icon: "mdi-elephant" },
      { value: "mysql", text: "MySQL", icon: "mdi-database" },
      { value: "oracle", text: "Oracle", icon: "mdi-database" },
      { value: "mssql", text: "SQL Server", icon: "mdi-microsoft" },
      { value: "sqlite", text: "SQLite", icon: "mdi-database" },
      { value: "mongodb", text: "MongoDB", icon: "mdi-leaf" },
      { value: "ftp", text: "FTP", icon: "mdi-folder-network" },
      { value: "sftp", text: "SFTP", icon: "mdi-folder-lock" },
      { value: "local_fs", text: "Local FS", icon: "mdi-folder" },
      { value: "aws_s3", text: "AWS S3", icon: "mdi-aws" },
      { value: "azure_blob", text: "Azure Blob", icon: "mdi-microsoft-azure" },
    ]);

    // Computed
    const allSystems = computed(() => {
      return systemStore.systems.filter((system) => {
        // Exclude specific system if requested
        if (props.excludeSystemId && system.id === props.excludeSystemId) {
          return false;
        }
        return true;
      });
    });

    const filteredSystems = computed(() => {
      let systems = allSystems.value;

      // Search filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        systems = systems.filter((system) => {
          return (
            system.name.toLowerCase().includes(query) ||
            system.type.toLowerCase().includes(query) ||
            (system.description &&
              system.description.toLowerCase().includes(query))
          );
        });
      }

      // Type filter
      if (selectedTypes.value.length > 0) {
        systems = systems.filter((system) =>
          selectedTypes.value.includes(system.type),
        );
      }

      // Status filter
      if (statusFilter.value !== "all") {
        systems = systems.filter((system) => {
          if (statusFilter.value === "active") {
            return system.isActive;
          } else {
            return !system.isActive;
          }
        });
      }

      return systems;
    });

    const totalPages = computed(() =>
      Math.ceil(filteredSystems.value.length / itemsPerPage),
    );

    const paginatedSystems = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      return filteredSystems.value.slice(start, end);
    });

    // Methods
    const handleSearch = () => {
      currentPage.value = 1;
    };

    const clearSearch = () => {
      searchQuery.value = "";
      currentPage.value = 1;
    };

    const toggleType = (type) => {
      const index = selectedTypes.value.indexOf(type);
      if (index > -1) {
        selectedTypes.value.splice(index, 1);
      } else {
        selectedTypes.value.push(type);
      }
      currentPage.value = 1;
    };

    const selectSystem = (system) => {
      if (props.requireActive && !system.isActive) {
        return;
      }
      selectedSystem.value = system;
    };

    const getSystemIcon = (type) => {
      const systemType = systemTypes.value.find((t) => t.value === type);
      return systemType?.icon || "mdi-database";
    };

    const getStatusClass = (system) => {
      if (!system.isActive) return "inactive";
      if (system.lastConnectionStatus === "success") return "connected";
      if (system.lastConnectionStatus === "failed") return "error";
      return "pending";
    };

    const getStatusIcon = (system) => {
      if (!system.isActive) return "mdi-pause-circle";
      if (system.lastConnectionStatus === "success") return "mdi-check-circle";
      if (system.lastConnectionStatus === "failed") return "mdi-alert-circle";
      return "mdi-clock-outline";
    };

    const getStatusText = (system) => {
      if (!system.isActive) return "Inactive";
      if (system.lastConnectionStatus === "success") return "Connected";
      if (system.lastConnectionStatus === "failed") return "Connection Failed";
      return "Not Tested";
    };

    const getConnectionInfo = (system) => {
      if (!system.connectionInfo) return "No connection info";

      const info = system.connectionInfo;
      if (system.type === "postgresql" || system.type === "mysql") {
        return `${info.host}:${info.port}/${info.database}`;
      } else if (system.type === "ftp" || system.type === "sftp") {
        return `${info.host}:${info.port}`;
      } else if (system.type === "local_fs") {
        return info.path || "Local filesystem";
      } else if (system.type === "aws_s3") {
        return info.bucket || "S3 bucket";
      }
      return system.type;
    };

    const formatDate = (dateString) => {
      if (!dateString) return "Never";
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
      return date.toLocaleDateString();
    };

    const close = () => {
      dialogVisible.value = false;
      // Reset state
      searchQuery.value = "";
      selectedTypes.value = [];
      statusFilter.value = "all";
      currentPage.value = 1;
      selectedSystem.value = null;
    };

    const confirm = () => {
      if (selectedSystem.value) {
        emit("select", selectedSystem.value);
        close();
      }
    };

    // Load systems when dialog opens
    watch(dialogVisible, async (newVal) => {
      if (newVal) {
        loading.value = true;
        try {
          await systemStore.fetchSystems();

          // Pre-select current system if provided
          if (props.currentSystemId) {
            const system = allSystems.value.find(
              (s) => s.id === props.currentSystemId,
            );
            if (system) {
              selectedSystem.value = system;
            }
          }
        } catch (error) {
          console.error("Failed to load systems:", error);
        } finally {
          loading.value = false;
        }
      }
    });

    // Reset page when filters change
    watch([selectedTypes, statusFilter], () => {
      currentPage.value = 1;
    });

    return {
      // State
      dialogVisible,
      searchQuery,
      selectedTypes,
      statusFilter,
      currentPage,
      selectedSystem,
      loading,
      systemTypes,

      // Computed
      filteredSystems,
      paginatedSystems,
      totalPages,

      // Methods
      handleSearch,
      clearSearch,
      toggleType,
      selectSystem,
      getSystemIcon,
      getStatusClass,
      getStatusIcon,
      getStatusText,
      getConnectionInfo,
      formatDate,
      close,
      confirm,
    };
  },
};
</script>

<style scoped>
.system-search-dialog {
  background: var(--white);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* Dialog Header */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6);
  border-bottom: 1px solid var(--gray-100);
}

.dialog-header h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  padding: var(--space-2);
  cursor: pointer;
  color: var(--gray-600);
  border-radius: var(--radius-base);
  transition: all var(--transition-base);
}

.close-button:hover {
  background: var(--gray-100);
}

/* Search Section */
.search-section {
  padding: var(--space-6);
  border-bottom: 1px solid var(--gray-100);
}

.search-input-wrapper {
  position: relative;
  margin-bottom: var(--space-4);
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--gray-400);
}

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-10) var(--space-3) var(--space-10);
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-base);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--white);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.clear-search {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: var(--space-1);
  cursor: pointer;
  color: var(--gray-400);
  transition: all var(--transition-base);
}

.clear-search:hover {
  color: var(--gray-600);
}

/* Filter Chips */
.filter-chips {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.chip-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.chip-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--gray-600);
  min-width: 60px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: var(--white);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  color: var(--gray-700);
  cursor: pointer;
  transition: all var(--transition-base);
}

.filter-chip:hover {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.filter-chip.active {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--white);
}

/* Systems Container */
.systems-container {
  padding: var(--space-6);
  min-height: 400px;
  max-height: 500px;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--gray-600);
  gap: var(--space-3);
}

.empty-state h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0;
}

.empty-state p {
  font-size: var(--font-size-sm);
  margin: 0;
}

/* Systems Grid */
.systems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.system-card {
  background: var(--white);
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-base);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--transition-base);
}

.system-card:hover {
  border-color: var(--gray-400);
  box-shadow: var(--shadow-sm);
}

.system-card.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.system-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.system-card.disabled:hover {
  border-color: var(--gray-200);
  box-shadow: none;
}

.system-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.system-icon {
  width: 48px;
  height: 48px;
  background: var(--gray-100);
  border-radius: var(--radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.system-info {
  flex: 1;
  min-width: 0;
}

.system-info h3 {
  font-size: var(--font-size-base);
  font-weight: var(--font-semibold);
  color: var(--gray-900);
  margin: 0 0 var(--space-1) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-type {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  text-transform: uppercase;
  margin: 0;
}

.system-status {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
}

.system-status.connected {
  background: var(--success-soft);
  color: var(--success);
}

.system-status.inactive {
  background: var(--gray-100);
  color: var(--gray-600);
}

.system-status.error {
  background: var(--error-soft);
  color: var(--error);
}

.system-status.pending {
  background: var(--warning-soft);
  color: var(--warning);
}

.system-description {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  margin-bottom: var(--space-3);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.system-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--gray-600);
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.page-button {
  display: flex;
  align-items: center;
  padding: var(--space-2);
  background: var(--white);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-base);
}

.page-button:hover:not(:disabled) {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

/* Dialog Footer */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6);
  border-top: 1px solid var(--gray-100);
}

.footer-info {
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

.footer-actions {
  display: flex;
  gap: var(--space-3);
}

/* Responsive */
@media (max-width: 768px) {
  .systems-grid {
    grid-template-columns: 1fr;
  }

  .filter-chips {
    gap: var(--space-2);
  }

  .chip-group {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
