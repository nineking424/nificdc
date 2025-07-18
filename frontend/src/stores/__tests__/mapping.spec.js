import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useMappingStore } from "../mapping";
import { useAppStore } from "../app";
import { mappingService } from "@/services/mappingService";

// Mock mappingService
vi.mock("@/services/mappingService", () => ({
  mappingService: {
    getMappings: vi.fn(),
    getMapping: vi.fn(),
    createMapping: vi.fn(),
    updateMapping: vi.fn(),
    deleteMapping: vi.fn(),
    executeMapping: vi.fn(),
    validateMapping: vi.fn(),
    previewMapping: vi.fn(),
    getTransformFunctions: vi.fn(),
    getMappingTypes: vi.fn(),
    getMappingExecutionHistory: vi.fn(),
  },
}));

describe("Mapping Store", () => {
  let store;
  let appStore;

  beforeEach(() => {
    // Create a new Pinia instance for each test
    setActivePinia(createPinia());
    store = useMappingStore();
    appStore = useAppStore();

    // Reset all mocks
    vi.clearAllMocks();

    // Mock appStore methods
    appStore.addNotification = vi.fn();
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      expect(store.mappings).toEqual([]);
      expect(store.currentMapping).toBe(null);
      expect(store.sourceSchema).toBe(null);
      expect(store.targetSchema).toBe(null);
      expect(store.fieldMappings).toEqual([]);
      expect(store.draggedField).toBe(null);
      expect(store.loading).toBe(false);
      expect(store.error).toBe(null);
      expect(store.validationResult).toBe(null);
      expect(store.previewData).toBe(null);
      expect(store.executionHistory).toEqual([]);
      expect(store.transformFunctions).toEqual([]);
      expect(store.mappingTypes).toEqual([]);
      expect(store.selectedFields).toEqual({ source: [], target: [] });
    });

    it("should have correct initial pagination state", () => {
      expect(store.pagination.page).toBe(1);
      expect(store.pagination.limit).toBe(20);
      expect(store.pagination.total).toBe(0);
      expect(store.pagination.totalPages).toBe(0);
    });

    it("should have correct initial filter state", () => {
      expect(store.filters.search).toBe("");
      expect(store.filters.type).toBe(null);
      expect(store.filters.status).toBe(null);
      expect(store.filters.sourceSystem).toBe(null);
      expect(store.filters.targetSystem).toBe(null);
      expect(store.filters.tags).toEqual([]);
    });

    it("should have correct initial sort state", () => {
      expect(store.sort.field).toBe("updatedAt");
      expect(store.sort.order).toBe("desc");
    });
  });

  describe("Computed Properties", () => {
    it("should compute isLoading correctly", () => {
      expect(store.isLoading).toBe(false);
      store.loading = true;
      expect(store.isLoading).toBe(true);
    });

    it("should compute hasError correctly", () => {
      expect(store.hasError).toBe(false);
      store.error = { message: "Error" };
      expect(store.hasError).toBe(true);
    });

    it("should compute hasMappings correctly", () => {
      expect(store.hasMappings).toBe(false);
      store.mappings = [{ id: 1, name: "Test" }];
      expect(store.hasMappings).toBe(true);
    });

    it("should compute hasCurrentMapping correctly", () => {
      expect(store.hasCurrentMapping).toBe(false);
      store.currentMapping = { id: 1, name: "Test" };
      expect(store.hasCurrentMapping).toBe(true);
    });

    it("should compute isValidMapping correctly", () => {
      expect(store.isValidMapping).toBe(false);
      store.validationResult = { valid: true };
      expect(store.isValidMapping).toBe(true);
      store.validationResult = { valid: false };
      expect(store.isValidMapping).toBe(false);
    });

    it("should compute sourceFields correctly", () => {
      expect(store.sourceFields).toEqual([]);

      store.sourceSchema = {
        columns: [
          { name: "id", dataType: "integer" },
          { name: "name", type: "varchar" },
        ],
      };

      expect(store.sourceFields).toEqual([
        { name: "id", dataType: "integer", id: "id", type: "integer" },
        { name: "name", dataType: "varchar", id: "name", type: "varchar" },
      ]);
    });

    it("should compute targetFields correctly", () => {
      expect(store.targetFields).toEqual([]);

      store.targetSchema = {
        columns: [
          { name: "user_id", dataType: "bigint" },
          { name: "user_name", type: "text" },
        ],
      };

      expect(store.targetFields).toEqual([
        { name: "user_id", dataType: "bigint", id: "user_id", type: "bigint" },
        { name: "user_name", dataType: "text", id: "user_name", type: "text" },
      ]);
    });

    it("should compute mappedFieldsCount correctly", () => {
      expect(store.mappedFieldsCount).toBe(0);

      store.fieldMappings = [
        { sourceField: "id", targetField: "user_id" },
        { sourceField: "name", targetField: "user_name" },
        { sourceField: "email", targetField: null },
      ];

      expect(store.mappedFieldsCount).toBe(2);
    });

    it("should compute mappingProgress correctly", () => {
      expect(store.mappingProgress).toBe(0);

      store.targetSchema = {
        columns: [
          { name: "field1" },
          { name: "field2" },
          { name: "field3" },
          { name: "field4" },
        ],
      };

      store.fieldMappings = [
        { targetField: "field1" },
        { targetField: "field2" },
      ];

      expect(store.mappingProgress).toBe(50);
    });

    it("should compute filteredMappings correctly", () => {
      store.mappings = [
        {
          id: 1,
          name: "User Mapping",
          type: "batch",
          isActive: true,
          tags: ["user"],
        },
        {
          id: 2,
          name: "Product Sync",
          type: "realtime",
          isActive: false,
          tags: ["product"],
        },
        {
          id: 3,
          name: "Order Processing",
          type: "batch",
          isActive: true,
          tags: ["order", "user"],
        },
      ];

      // No filters
      expect(store.filteredMappings).toHaveLength(3);

      // Search filter
      store.filters.search = "user";
      expect(store.filteredMappings).toHaveLength(2);
      expect(store.filteredMappings.map((m) => m.id)).toEqual([1, 3]);

      // Type filter
      store.filters.search = "";
      store.filters.type = "batch";
      expect(store.filteredMappings).toHaveLength(2);
      expect(store.filteredMappings.map((m) => m.id)).toEqual([1, 3]);

      // Status filter
      store.filters.type = null;
      store.filters.status = false;
      expect(store.filteredMappings).toHaveLength(1);
      expect(store.filteredMappings[0].id).toBe(2);

      // Tag filter
      store.filters.status = null;
      store.filters.tags = ["user"];
      expect(store.filteredMappings).toHaveLength(2);
      expect(store.filteredMappings.map((m) => m.id)).toEqual([1, 3]);
    });
  });

  describe("Actions - Basic Operations", () => {
    it("should set loading state", () => {
      store.setLoading(true);
      expect(store.loading).toBe(true);

      store.setLoading(false);
      expect(store.loading).toBe(false);
    });

    it("should set error and show notification", () => {
      const error = { message: "Test error", details: "Error details" };

      store.setError(error);

      expect(store.error).toEqual(error);
      expect(appStore.addNotification).toHaveBeenCalledWith({
        type: "error",
        title: "오류",
        message: "Test error",
      });
    });

    it("should clear error", () => {
      store.error = { message: "Error" };

      store.clearError();

      expect(store.error).toBe(null);
    });
  });

  describe("Actions - Mapping CRUD", () => {
    describe("fetchMappings", () => {
      it("should fetch mappings successfully", async () => {
        const mockResponse = {
          data: {
            mappings: [
              { id: 1, name: "Mapping 1" },
              { id: 2, name: "Mapping 2" },
            ],
            total: 2,
            totalPages: 1,
          },
        };

        mappingService.getMappings.mockResolvedValue(mockResponse);

        await store.fetchMappings();

        expect(mappingService.getMappings).toHaveBeenCalledWith({
          page: 1,
          limit: 20,
          sort: "-updatedAt",
          search: "",
          type: null,
          status: null,
          sourceSystem: null,
          targetSystem: null,
          tags: [],
        });

        expect(store.mappings).toEqual(mockResponse.data.mappings);
        expect(store.pagination.total).toBe(2);
        expect(store.pagination.totalPages).toBe(1);
        expect(store.loading).toBe(false);
        expect(store.error).toBe(null);
      });

      it("should handle fetch error", async () => {
        const error = new Error("Network error");
        mappingService.getMappings.mockRejectedValue(error);

        await expect(store.fetchMappings()).rejects.toThrow("Network error");

        expect(store.error).toEqual({
          message: "매핑 목록을 불러오는데 실패했습니다.",
          details: "Network error",
        });
        expect(store.loading).toBe(false);
      });
    });

    describe("loadMapping", () => {
      it("should load mapping details successfully", async () => {
        const mockMapping = {
          id: 1,
          name: "Test Mapping",
          sourceSchema: { columns: [{ name: "id" }] },
          targetSchema: { columns: [{ name: "user_id" }] },
          fieldMappings: [{ sourceField: "id", targetField: "user_id" }],
        };

        mappingService.getMapping.mockResolvedValue({ data: mockMapping });

        await store.loadMapping(1);

        expect(mappingService.getMapping).toHaveBeenCalledWith(1);
        expect(store.currentMapping).toEqual(mockMapping);
        expect(store.sourceSchema).toEqual(mockMapping.sourceSchema);
        expect(store.targetSchema).toEqual(mockMapping.targetSchema);
        expect(store.fieldMappings).toEqual(mockMapping.fieldMappings);
      });

      it("should handle load error", async () => {
        const error = new Error("Not found");
        mappingService.getMapping.mockRejectedValue(error);

        await expect(store.loadMapping(1)).rejects.toThrow("Not found");

        expect(store.error).toEqual({
          message: "매핑 정보를 불러오는데 실패했습니다.",
          details: "Not found",
        });
      });
    });

    describe("createMapping", () => {
      it("should create mapping successfully", async () => {
        const newMapping = { name: "New Mapping", type: "batch" };
        const createdMapping = { id: 1, ...newMapping };

        mappingService.createMapping.mockResolvedValue({
          data: createdMapping,
        });

        const result = await store.createMapping(newMapping);

        expect(mappingService.createMapping).toHaveBeenCalledWith(newMapping);
        expect(store.currentMapping).toEqual(createdMapping);
        expect(result).toEqual(createdMapping);
        expect(appStore.addNotification).toHaveBeenCalledWith({
          type: "success",
          title: "성공",
          message: "매핑이 생성되었습니다.",
        });
      });

      it("should handle create error", async () => {
        const error = new Error("Validation error");
        mappingService.createMapping.mockRejectedValue(error);

        await expect(store.createMapping({})).rejects.toThrow(
          "Validation error",
        );

        expect(store.error).toEqual({
          message: "매핑 생성에 실패했습니다.",
          details: "Validation error",
        });
      });
    });

    describe("updateMapping", () => {
      it("should update mapping successfully", async () => {
        const updates = { name: "Updated Name" };
        const updatedMapping = { id: 1, ...updates };

        mappingService.updateMapping.mockResolvedValue({
          data: updatedMapping,
        });

        const result = await store.updateMapping(1, updates);

        expect(mappingService.updateMapping).toHaveBeenCalledWith(1, updates);
        expect(store.currentMapping).toEqual(updatedMapping);
        expect(result).toEqual(updatedMapping);
        expect(appStore.addNotification).toHaveBeenCalledWith({
          type: "success",
          title: "성공",
          message: "매핑이 수정되었습니다.",
        });
      });
    });

    describe("deleteMapping", () => {
      it("should delete mapping successfully", async () => {
        store.mappings = [
          { id: 1, name: "Mapping 1" },
          { id: 2, name: "Mapping 2" },
        ];
        store.currentMapping = { id: 1, name: "Mapping 1" };

        mappingService.deleteMapping.mockResolvedValue({});

        await store.deleteMapping(1);

        expect(mappingService.deleteMapping).toHaveBeenCalledWith(1);
        expect(store.mappings).toHaveLength(1);
        expect(store.mappings[0].id).toBe(2);
        expect(store.currentMapping).toBe(null);
        expect(appStore.addNotification).toHaveBeenCalledWith({
          type: "success",
          title: "성공",
          message: "매핑이 삭제되었습니다.",
        });
      });

      it("should not reset current mapping if different mapping is deleted", async () => {
        store.currentMapping = { id: 2, name: "Mapping 2" };

        mappingService.deleteMapping.mockResolvedValue({});

        await store.deleteMapping(1);

        expect(store.currentMapping.id).toBe(2);
      });
    });
  });

  describe("Actions - Mapping Operations", () => {
    describe("executeMapping", () => {
      it("should execute mapping successfully", async () => {
        const executionResult = { jobId: "job-123", status: "running" };

        mappingService.executeMapping.mockResolvedValue({
          data: executionResult,
        });

        const result = await store.executeMapping(1, { mode: "batch" });

        expect(mappingService.executeMapping).toHaveBeenCalledWith(1, {
          mode: "batch",
        });
        expect(result).toEqual(executionResult);
        expect(appStore.addNotification).toHaveBeenCalledWith({
          type: "success",
          title: "성공",
          message: "매핑 실행이 시작되었습니다.",
        });
      });
    });

    describe("validateMapping", () => {
      it("should validate mapping successfully", async () => {
        const validationResult = { valid: true, errors: [], warnings: [] };

        mappingService.validateMapping.mockResolvedValue({
          data: validationResult,
        });

        const result = await store.validateMapping(1);

        expect(mappingService.validateMapping).toHaveBeenCalledWith(1);
        expect(store.validationResult).toEqual(validationResult);
        expect(result).toEqual(validationResult);
      });
    });

    describe("previewMapping", () => {
      it("should preview mapping successfully", async () => {
        const previewResult = {
          input: [{ id: 1 }],
          output: [{ user_id: 1 }],
        };

        mappingService.previewMapping.mockResolvedValue({
          data: previewResult,
        });

        const result = await store.previewMapping(1, { sample: [{ id: 1 }] });

        expect(mappingService.previewMapping).toHaveBeenCalledWith(1, {
          sample: [{ id: 1 }],
        });
        expect(store.previewData).toEqual(previewResult);
        expect(result).toEqual(previewResult);
      });
    });
  });

  describe("Actions - Field Mappings", () => {
    it("should add field mapping", () => {
      const sourceField = { name: "id", type: "integer" };
      const targetField = { name: "user_id", type: "bigint" };
      const transformations = ["toInteger"];

      const mapping = store.addFieldMapping(
        sourceField,
        targetField,
        transformations,
      );

      expect(store.fieldMappings).toHaveLength(1);
      expect(mapping).toMatchObject({
        sourceField,
        targetField,
        transformations,
        enabled: true,
      });
      expect(mapping.id).toBeDefined();
    });

    it("should update field mapping", () => {
      // Add initial mapping
      const mapping = store.addFieldMapping(
        { name: "id" },
        { name: "user_id" },
      );
      const mappingId = mapping.id;

      // Update mapping
      store.updateFieldMapping(mappingId, {
        transformations: ["toString"],
        enabled: false,
      });

      const updatedMapping = store.fieldMappings.find(
        (m) => m.id === mappingId,
      );
      expect(updatedMapping.transformations).toEqual(["toString"]);
      expect(updatedMapping.enabled).toBe(false);
    });

    it("should remove field mapping", () => {
      // Add two mappings
      const mapping1 = store.addFieldMapping(
        { name: "id" },
        { name: "user_id" },
      );
      const mapping2 = store.addFieldMapping(
        { name: "name" },
        { name: "user_name" },
      );

      expect(store.fieldMappings).toHaveLength(2);

      // Remove first mapping
      store.removeFieldMapping(mapping1.id);

      expect(store.fieldMappings).toHaveLength(1);
      expect(store.fieldMappings[0].id).toBe(mapping2.id);
    });
  });

  describe("Actions - Drag and Drop", () => {
    it("should handle drag start", () => {
      const field = { name: "id", type: "integer" };

      store.startDrag(field, "source");

      expect(store.draggedField).toEqual({ field, type: "source" });
    });

    it("should handle drag end", () => {
      store.draggedField = { field: {}, type: "source" };

      store.endDrag();

      expect(store.draggedField).toBe(null);
    });

    it("should handle drop on target field", () => {
      const sourceField = { name: "id", type: "integer" };
      const targetField = { name: "user_id", type: "bigint" };

      store.startDrag(sourceField, "source");
      store.handleDrop(targetField);

      expect(store.fieldMappings).toHaveLength(1);
      expect(store.fieldMappings[0]).toMatchObject({
        sourceField,
        targetField,
      });
      expect(store.draggedField).toBe(null);
    });

    it("should not add mapping if no dragged field", () => {
      store.handleDrop({ name: "target" });

      expect(store.fieldMappings).toHaveLength(0);
    });
  });

  describe("Actions - Metadata", () => {
    it("should fetch transform functions", async () => {
      const functions = [
        { name: "toUpperCase", label: "대문자 변환", category: "string" },
        { name: "toInteger", label: "정수 변환", category: "number" },
      ];

      mappingService.getTransformFunctions.mockResolvedValue({
        data: { functions },
      });

      await store.fetchTransformFunctions();

      expect(store.transformFunctions).toEqual(functions);
    });

    it("should fetch mapping types", async () => {
      const types = [
        { value: "batch", label: "배치" },
        { value: "realtime", label: "실시간" },
      ];

      mappingService.getMappingTypes.mockResolvedValue({
        data: { types },
      });

      await store.fetchMappingTypes();

      expect(store.mappingTypes).toEqual(types);
    });

    it("should fetch execution history", async () => {
      const executions = [
        { id: 1, status: "success", executedAt: "2024-01-01" },
        { id: 2, status: "failed", executedAt: "2024-01-02" },
      ];

      mappingService.getMappingExecutionHistory.mockResolvedValue({
        data: { executions },
      });

      const result = await store.fetchExecutionHistory(1, { limit: 10 });

      expect(mappingService.getMappingExecutionHistory).toHaveBeenCalledWith(
        1,
        { limit: 10 },
      );
      expect(store.executionHistory).toEqual(executions);
      expect(result).toEqual({ executions });
    });
  });

  describe("Actions - Filters and Pagination", () => {
    it("should reset filters", () => {
      // Set some filters
      store.filters.search = "test";
      store.filters.type = "batch";
      store.filters.status = true;
      store.filters.tags = ["tag1", "tag2"];

      store.resetFilters();

      expect(store.filters).toEqual({
        search: "",
        type: null,
        status: null,
        sourceSystem: null,
        targetSystem: null,
        tags: [],
      });
    });

    it("should change page", async () => {
      mappingService.getMappings.mockResolvedValue({ data: {} });

      await store.changePage(3);

      expect(store.pagination.page).toBe(3);
      expect(mappingService.getMappings).toHaveBeenCalled();
    });

    it("should change page size", async () => {
      mappingService.getMappings.mockResolvedValue({ data: {} });

      await store.changePageSize(50);

      expect(store.pagination.limit).toBe(50);
      expect(store.pagination.page).toBe(1); // Reset to first page
      expect(mappingService.getMappings).toHaveBeenCalled();
    });

    it("should change sort", async () => {
      mappingService.getMappings.mockResolvedValue({ data: {} });

      await store.changeSort("name", "asc");

      expect(store.sort.field).toBe("name");
      expect(store.sort.order).toBe("asc");
      expect(mappingService.getMappings).toHaveBeenCalled();
    });
  });

  describe("Actions - Reset", () => {
    it("should reset current mapping", () => {
      // Set some data
      store.currentMapping = { id: 1 };
      store.sourceSchema = { columns: [] };
      store.targetSchema = { columns: [] };
      store.fieldMappings = [{ id: 1 }];
      store.validationResult = { valid: true };
      store.previewData = { data: [] };
      store.selectedFields = { source: ["id"], target: ["user_id"] };

      store.resetCurrentMapping();

      expect(store.currentMapping).toBe(null);
      expect(store.sourceSchema).toBe(null);
      expect(store.targetSchema).toBe(null);
      expect(store.fieldMappings).toEqual([]);
      expect(store.validationResult).toBe(null);
      expect(store.previewData).toBe(null);
      expect(store.selectedFields).toEqual({ source: [], target: [] });
    });

    it("should reset entire store", () => {
      // Set some data
      store.mappings = [{ id: 1 }];
      store.currentMapping = { id: 1 };
      store.executionHistory = [{ id: 1 }];
      store.transformFunctions = [{ name: "test" }];
      store.mappingTypes = [{ value: "batch" }];
      store.loading = true;
      store.error = { message: "Error" };
      store.filters.search = "test";
      store.pagination.page = 5;

      store.reset();

      expect(store.mappings).toEqual([]);
      expect(store.currentMapping).toBe(null);
      expect(store.executionHistory).toEqual([]);
      expect(store.transformFunctions).toEqual([]);
      expect(store.mappingTypes).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBe(null);
      expect(store.filters.search).toBe("");
      expect(store.pagination.page).toBe(1);
    });
  });
});
