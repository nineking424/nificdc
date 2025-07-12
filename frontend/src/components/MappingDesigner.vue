<template>
  <div class="mapping-designer">
    <v-container fluid class="pa-0">
      <!-- 도구 모음 -->
      <v-toolbar density="compact" color="primary" dark>
        <v-toolbar-title>매핑 디자이너</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon="mdi-content-save"
          @click="saveMapping"
          :disabled="!hasChanges"
        />
        <v-btn
          icon="mdi-play"
          @click="testMapping"
          :disabled="!hasValidMapping"
        />
        <v-btn
          icon="mdi-refresh"
          @click="refreshSchema"
        />
        <v-btn
          icon="mdi-help-circle"
          @click="showHelp = true"
        />
      </v-toolbar>

      <!-- 메인 매핑 영역 -->
      <v-row no-gutters class="mapping-container">
        <!-- 소스 스키마 패널 -->
        <v-col cols="5" class="source-panel">
          <v-card flat height="100%" class="d-flex flex-column">
            <v-card-title class="pa-3">
              <v-icon class="mr-2">mdi-database-export</v-icon>
              소스 스키마
              <v-spacer />
              <v-chip
                size="small"
                color="primary"
                variant="tonal"
              >
                {{ sourceSchema?.name || '스키마 선택' }}
              </v-chip>
            </v-card-title>
            
            <v-divider />
            
            <v-card-text class="flex-grow-1 pa-0">
              <v-text-field
                v-model="sourceFilter"
                placeholder="필드 검색..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                class="ma-3"
                hide-details
              />
              
              <div class="schema-tree-container">
                <SchemaTree
                  :schema="filteredSourceSchema"
                  :selected-fields="selectedSourceFields"
                  :draggable="true"
                  @field-select="onSourceFieldSelect"
                  @field-drag-start="onFieldDragStart"
                  @field-drag-end="onFieldDragEnd"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- 매핑 캔버스 -->
        <v-col cols="2" class="mapping-canvas">
          <div class="canvas-container">
            <svg
              ref="svgCanvas"
              class="mapping-svg"
              @drop="onCanvasDrop"
              @dragover.prevent
            >
              <!-- 연결선들 -->
              <g class="connections">
                <path
                  v-for="connection in connections"
                  :key="connection.id"
                  :d="connection.path"
                  :class="[
                    'connection-line',
                    connection.type,
                    { 'active': connection.id === activeConnectionId }
                  ]"
                  @click="selectConnection(connection)"
                />
              </g>
              
              <!-- 임시 연결선 (드래그 중) -->
              <path
                v-if="tempConnection"
                :d="tempConnection.path"
                class="connection-line temporary"
              />
            </svg>
            
            <!-- 매핑 규칙 컨트롤 -->
            <div class="mapping-controls">
              <v-btn
                v-if="selectedConnection"
                icon="mdi-cog"
                size="small"
                color="primary"
                @click="showMappingRuleDialog = true"
              />
              <v-btn
                v-if="selectedConnection"
                icon="mdi-delete"
                size="small"
                color="error"
                @click="deleteConnection"
              />
            </div>
          </div>
        </v-col>

        <!-- 타겟 스키마 패널 -->
        <v-col cols="5" class="target-panel">
          <v-card flat height="100%" class="d-flex flex-column">
            <v-card-title class="pa-3">
              <v-icon class="mr-2">mdi-database-import</v-icon>
              타겟 스키마
              <v-spacer />
              <v-chip
                size="small"
                color="success"
                variant="tonal"
              >
                {{ targetSchema?.name || '스키마 선택' }}
              </v-chip>
            </v-card-title>
            
            <v-divider />
            
            <v-card-text class="flex-grow-1 pa-0">
              <v-text-field
                v-model="targetFilter"
                placeholder="필드 검색..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                class="ma-3"
                hide-details
              />
              
              <div class="schema-tree-container">
                <SchemaTree
                  :schema="filteredTargetSchema"
                  :selected-fields="selectedTargetFields"
                  :droppable="true"
                  @field-select="onTargetFieldSelect"
                  @field-drop="onTargetFieldDrop"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 하단 패널 -->
      <v-card class="mapping-summary">
        <v-card-title class="pa-3">
          <v-icon class="mr-2">mdi-format-list-bulleted</v-icon>
          매핑 규칙 요약
          <v-spacer />
          <v-chip
            :color="mappingRules.length > 0 ? 'success' : 'warning'"
            size="small"
            variant="tonal"
          >
            {{ mappingRules.length }}개 규칙
          </v-chip>
        </v-card-title>
        
        <v-divider />
        
        <v-card-text class="pa-0">
          <v-data-table
            :headers="mappingHeaders"
            :items="mappingRules"
            density="compact"
            class="mapping-rules-table"
            @click:row="editMappingRule"
          >
            <template #item.mappingType="{ item }">
              <v-chip
                :color="getMappingTypeColor(item.mappingType)"
                size="small"
                variant="tonal"
              >
                {{ getMappingTypeLabel(item.mappingType) }}
              </v-chip>
            </template>
            
            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-pencil"
                size="small"
                variant="text"
                @click.stop="editMappingRule(item)"
              />
              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                color="error"
                @click.stop="deleteMappingRule(item)"
              />
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-container>

    <!-- 매핑 규칙 설정 대화상자 -->
    <MappingRuleDialog
      v-model="showMappingRuleDialog"
      :mapping-rule="selectedMappingRule"
      :source-field="selectedSourceField"
      :target-field="selectedTargetField"
      @save="saveMappingRule"
      @cancel="cancelMappingRule"
    />

    <!-- 매핑 테스트 대화상자 -->
    <MappingTestDialog
      v-model="showTestDialog"
      :mapping="currentMapping"
      :source-schema="sourceSchema"
      :target-schema="targetSchema"
    />

    <!-- 도움말 대화상자 -->
    <HelpDialog
      v-model="showHelp"
      topic="mapping-designer"
    />
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAppStore } from '@/stores/app';
import SchemaTree from '@/components/SchemaTree.vue';
import MappingRuleDialog from '@/components/MappingRuleDialog.vue';
import MappingTestDialog from '@/components/MappingTestDialog.vue';
import HelpDialog from '@/components/HelpDialog.vue';
import { mappingService } from '@/services/mappingService';
import { schemaService } from '@/services/schemaService';

export default {
  name: 'MappingDesigner',
  components: {
    SchemaTree,
    MappingRuleDialog,
    MappingTestDialog,
    HelpDialog
  },
  props: {
    mappingId: {
      type: String,
      default: null
    },
    sourceSchemaId: {
      type: String,
      default: null
    },
    targetSchemaId: {
      type: String,
      default: null
    }
  },
  emits: ['mapping-save', 'mapping-cancel'],
  setup(props, { emit }) {
    const route = useRoute();
    const appStore = useAppStore();

    // 반응형 상태
    const sourceSchema = ref(null);
    const targetSchema = ref(null);
    const sourceFilter = ref('');
    const targetFilter = ref('');
    const mappingRules = ref([]);
    const connections = ref([]);
    const selectedSourceFields = ref([]);
    const selectedTargetFields = ref([]);
    const selectedConnection = ref(null);
    const selectedMappingRule = ref(null);
    const selectedSourceField = ref(null);
    const selectedTargetField = ref(null);
    const tempConnection = ref(null);
    const activeConnectionId = ref(null);
    const hasChanges = ref(false);
    
    // 대화상자 상태
    const showMappingRuleDialog = ref(false);
    const showTestDialog = ref(false);
    const showHelp = ref(false);
    
    // 드래그 상태
    const dragState = reactive({
      isDragging: false,
      dragField: null,
      dragStartPos: null
    });

    // SVG 캔버스 참조
    const svgCanvas = ref(null);

    // 계산된 속성
    const filteredSourceSchema = computed(() => {
      if (!sourceSchema.value || !sourceFilter.value) return sourceSchema.value;
      
      return {
        ...sourceSchema.value,
        columns: sourceSchema.value.columns.filter(col =>
          col.name.toLowerCase().includes(sourceFilter.value.toLowerCase())
        )
      };
    });

    const filteredTargetSchema = computed(() => {
      if (!targetSchema.value || !targetFilter.value) return targetSchema.value;
      
      return {
        ...targetSchema.value,
        columns: targetSchema.value.columns.filter(col =>
          col.name.toLowerCase().includes(targetFilter.value.toLowerCase())
        )
      };
    });

    const hasValidMapping = computed(() => {
      return mappingRules.value.length > 0 && 
             sourceSchema.value && 
             targetSchema.value;
    });

    const currentMapping = computed(() => {
      return {
        id: props.mappingId,
        sourceSchemaId: sourceSchema.value?.id,
        targetSchemaId: targetSchema.value?.id,
        mappingRules: mappingRules.value,
        connections: connections.value
      };
    });

    // 매핑 테이블 헤더
    const mappingHeaders = [
      { title: '소스 필드', key: 'sourceField', sortable: true },
      { title: '타겟 필드', key: 'targetField', sortable: true },
      { title: '매핑 타입', key: 'mappingType', sortable: true },
      { title: '변환 함수', key: 'transformFunction', sortable: false },
      { title: '액션', key: 'actions', sortable: false, width: 100 }
    ];

    // 메서드
    const loadSchemas = async () => {
      try {
        if (props.sourceSchemaId) {
          sourceSchema.value = await schemaService.getSchema(props.sourceSchemaId);
        }
        if (props.targetSchemaId) {
          targetSchema.value = await schemaService.getSchema(props.targetSchemaId);
        }
      } catch (error) {
        appStore.showNotification({
          type: 'error',
          message: '스키마 로드 실패: ' + error.message
        });
      }
    };

    const loadMapping = async () => {
      if (!props.mappingId) return;
      
      try {
        const mapping = await mappingService.getMapping(props.mappingId);
        mappingRules.value = mapping.mappingRules || [];
        generateConnections();
      } catch (error) {
        appStore.showNotification({
          type: 'error',
          message: '매핑 로드 실패: ' + error.message
        });
      }
    };

    const generateConnections = () => {
      connections.value = mappingRules.value.map((rule, index) => {
        return {
          id: `connection-${index}`,
          sourceField: rule.sourceField,
          targetField: rule.targetField,
          type: rule.mappingType,
          path: calculateConnectionPath(rule.sourceField, rule.targetField),
          rule: rule
        };
      });
    };

    const calculateConnectionPath = (sourceField, targetField) => {
      // SVG 경로 계산 로직
      const sourceElement = document.querySelector(`[data-field="${sourceField}"]`);
      const targetElement = document.querySelector(`[data-field="${targetField}"]`);
      
      if (!sourceElement || !targetElement) {
        return '';
      }
      
      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const canvasRect = svgCanvas.value.getBoundingClientRect();
      
      const startX = sourceRect.right - canvasRect.left;
      const startY = sourceRect.top + sourceRect.height / 2 - canvasRect.top;
      const endX = targetRect.left - canvasRect.left;
      const endY = targetRect.top + targetRect.height / 2 - canvasRect.top;
      
      // 베지어 곡선 경로 생성
      const controlX1 = startX + 50;
      const controlY1 = startY;
      const controlX2 = endX - 50;
      const controlY2 = endY;
      
      return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
    };

    const onSourceFieldSelect = (field) => {
      selectedSourceField.value = field;
      selectedSourceFields.value = [field.name];
    };

    const onTargetFieldSelect = (field) => {
      selectedTargetField.value = field;
      selectedTargetFields.value = [field.name];
    };

    const onFieldDragStart = (field, event) => {
      dragState.isDragging = true;
      dragState.dragField = field;
      dragState.dragStartPos = {
        x: event.clientX,
        y: event.clientY
      };
      
      // 드래그 데이터 설정
      event.dataTransfer.setData('text/plain', JSON.stringify(field));
      event.dataTransfer.effectAllowed = 'link';
    };

    const onFieldDragEnd = () => {
      dragState.isDragging = false;
      dragState.dragField = null;
      dragState.dragStartPos = null;
      tempConnection.value = null;
    };

    const onTargetFieldDrop = (targetField, event) => {
      event.preventDefault();
      
      try {
        const sourceFieldData = JSON.parse(event.dataTransfer.getData('text/plain'));
        createMappingRule(sourceFieldData, targetField);
      } catch (error) {
        console.error('드롭 처리 오류:', error);
      }
    };

    const onCanvasDrop = (event) => {
      event.preventDefault();
      // 캔버스에 드롭되었을 때 처리
    };

    const createMappingRule = (sourceField, targetField) => {
      // 중복 확인
      const existingRule = mappingRules.value.find(rule => 
        rule.sourceField === sourceField.name && rule.targetField === targetField.name
      );
      
      if (existingRule) {
        appStore.showNotification({
          type: 'warning',
          message: '이미 존재하는 매핑 규칙입니다.'
        });
        return;
      }
      
      const newRule = {
        id: `rule-${Date.now()}`,
        sourceField: sourceField.name,
        targetField: targetField.name,
        mappingType: 'direct',
        transformFunction: null,
        transformParams: {},
        condition: null,
        isRequired: targetField.nullable === false,
        priority: mappingRules.value.length + 1
      };
      
      mappingRules.value.push(newRule);
      generateConnections();
      hasChanges.value = true;
      
      // 새 규칙 편집
      selectedMappingRule.value = newRule;
      selectedSourceField.value = sourceField;
      selectedTargetField.value = targetField;
      showMappingRuleDialog.value = true;
    };

    const editMappingRule = (item) => {
      selectedMappingRule.value = item.raw || item;
      selectedSourceField.value = sourceSchema.value?.columns.find(col => col.name === selectedMappingRule.value.sourceField);
      selectedTargetField.value = targetSchema.value?.columns.find(col => col.name === selectedMappingRule.value.targetField);
      showMappingRuleDialog.value = true;
    };

    const deleteMappingRule = (item) => {
      const rule = item.raw || item;
      const index = mappingRules.value.findIndex(r => r.id === rule.id);
      if (index > -1) {
        mappingRules.value.splice(index, 1);
        generateConnections();
        hasChanges.value = true;
      }
    };

    const saveMappingRule = (rule) => {
      const index = mappingRules.value.findIndex(r => r.id === rule.id);
      if (index > -1) {
        mappingRules.value[index] = rule;
      } else {
        mappingRules.value.push(rule);
      }
      
      generateConnections();
      hasChanges.value = true;
      showMappingRuleDialog.value = false;
    };

    const cancelMappingRule = () => {
      showMappingRuleDialog.value = false;
      selectedMappingRule.value = null;
    };

    const selectConnection = (connection) => {
      selectedConnection.value = connection;
      activeConnectionId.value = connection.id;
    };

    const deleteConnection = () => {
      if (!selectedConnection.value) return;
      
      const rule = selectedConnection.value.rule;
      deleteMappingRule(rule);
      selectedConnection.value = null;
      activeConnectionId.value = null;
    };

    const saveMapping = async () => {
      try {
        const mappingData = {
          sourceSchemaId: sourceSchema.value.id,
          targetSchemaId: targetSchema.value.id,
          mappingRules: mappingRules.value
        };
        
        let result;
        if (props.mappingId) {
          result = await mappingService.updateMapping(props.mappingId, mappingData);
        } else {
          result = await mappingService.createMapping(mappingData);
        }
        
        hasChanges.value = false;
        emit('mapping-save', result);
        
        appStore.showNotification({
          type: 'success',
          message: '매핑이 저장되었습니다.'
        });
      } catch (error) {
        appStore.showNotification({
          type: 'error',
          message: '매핑 저장 실패: ' + error.message
        });
      }
    };

    const testMapping = () => {
      showTestDialog.value = true;
    };

    const refreshSchema = async () => {
      await loadSchemas();
      generateConnections();
    };

    const getMappingTypeColor = (type) => {
      const colors = {
        direct: 'primary',
        transform: 'success',
        concat: 'warning',
        split: 'info',
        lookup: 'purple',
        formula: 'orange'
      };
      return colors[type] || 'grey';
    };

    const getMappingTypeLabel = (type) => {
      const labels = {
        direct: '직접',
        transform: '변환',
        concat: '연결',
        split: '분할',
        lookup: '조회',
        formula: '수식'
      };
      return labels[type] || type;
    };

    // 컴포넌트 라이프사이클
    onMounted(async () => {
      await loadSchemas();
      await loadMapping();
      
      // 리사이즈 이벤트 리스너
      window.addEventListener('resize', generateConnections);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', generateConnections);
    });

    // 스키마 변경 감지
    watch([sourceSchema, targetSchema], () => {
      generateConnections();
    });

    return {
      // 반응형 상태
      sourceSchema,
      targetSchema,
      sourceFilter,
      targetFilter,
      mappingRules,
      connections,
      selectedSourceFields,
      selectedTargetFields,
      selectedConnection,
      selectedMappingRule,
      selectedSourceField,
      selectedTargetField,
      tempConnection,
      activeConnectionId,
      hasChanges,
      showMappingRuleDialog,
      showTestDialog,
      showHelp,
      svgCanvas,
      
      // 계산된 속성
      filteredSourceSchema,
      filteredTargetSchema,
      hasValidMapping,
      currentMapping,
      mappingHeaders,
      
      // 메서드
      onSourceFieldSelect,
      onTargetFieldSelect,
      onFieldDragStart,
      onFieldDragEnd,
      onTargetFieldDrop,
      onCanvasDrop,
      editMappingRule,
      deleteMappingRule,
      saveMappingRule,
      cancelMappingRule,
      selectConnection,
      deleteConnection,
      saveMapping,
      testMapping,
      refreshSchema,
      getMappingTypeColor,
      getMappingTypeLabel
    };
  }
};
</script>

<style scoped>
.mapping-designer {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.mapping-container {
  flex: 1;
  min-height: 0;
}

.source-panel,
.target-panel {
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.target-panel {
  border-left: 1px solid rgba(0, 0, 0, 0.12);
  border-right: none;
}

.mapping-canvas {
  background: linear-gradient(45deg, #f5f5f5 25%, transparent 25%),
              linear-gradient(-45deg, #f5f5f5 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #f5f5f5 75%),
              linear-gradient(-45deg, transparent 75%, #f5f5f5 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  position: relative;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.mapping-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.connection-line {
  fill: none;
  stroke-width: 2;
  pointer-events: stroke;
  cursor: pointer;
  transition: all 0.2s ease;
}

.connection-line.direct {
  stroke: #2196F3;
}

.connection-line.transform {
  stroke: #4CAF50;
}

.connection-line.concat {
  stroke: #FF9800;
}

.connection-line.split {
  stroke: #00BCD4;
}

.connection-line.lookup {
  stroke: #9C27B0;
}

.connection-line.formula {
  stroke: #FF5722;
}

.connection-line.temporary {
  stroke: #999;
  stroke-dasharray: 5, 5;
}

.connection-line:hover,
.connection-line.active {
  stroke-width: 3;
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.3));
}

.mapping-controls {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 8px;
}

.schema-tree-container {
  height: calc(100vh - 200px);
  overflow-y: auto;
}

.mapping-summary {
  max-height: 300px;
  min-height: 200px;
}

.mapping-rules-table {
  max-height: 200px;
}

/* 드래그 앤 드롭 스타일 */
.draggable-field {
  cursor: grab;
  transition: all 0.2s ease;
}

.draggable-field:hover {
  background-color: rgba(33, 150, 243, 0.1);
}

.draggable-field.dragging {
  cursor: grabbing;
  opacity: 0.7;
}

.droppable-field {
  transition: all 0.2s ease;
}

.droppable-field.drag-over {
  background-color: rgba(76, 175, 80, 0.2);
  border: 2px dashed #4CAF50;
}

/* 반응형 디자인 */
@media (max-width: 1200px) {
  .mapping-container .v-col {
    min-width: 300px;
  }
  
  .schema-tree-container {
    height: calc(100vh - 300px);
  }
}

@media (max-width: 768px) {
  .mapping-container {
    flex-direction: column;
  }
  
  .mapping-canvas {
    min-height: 100px;
  }
  
  .schema-tree-container {
    height: 300px;
  }
}
</style>