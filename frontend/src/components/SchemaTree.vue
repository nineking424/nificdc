<template>
  <div class="schema-tree">
    <v-list density="compact" class="pa-0">
      <template v-for="(column, index) in schema?.columns || []" :key="column.name">
        <v-list-item
          :value="column.name"
          :active="selectedFields.includes(column.name)"
          :class="[
            'field-item',
            {
              'draggable-field': draggable,
              'droppable-field': droppable,
              'drag-over': dragOverField === column.name,
              'selected': selectedFields.includes(column.name)
            }
          ]"
          :draggable="draggable"
          :data-field="column.name"
          @click="selectField(column)"
          @dragstart="onDragStart(column, $event)"
          @dragend="onDragEnd"
          @dragover="onDragOver(column, $event)"
          @dragleave="onDragLeave"
          @drop="onDrop(column, $event)"
        >
          <template #prepend>
            <v-icon
              :icon="getDataTypeIcon(column.dataType)"
              :color="getDataTypeColor(column.dataType)"
              size="small"
            />
          </template>

          <v-list-item-title class="field-name">
            {{ column.name }}
          </v-list-item-title>

          <v-list-item-subtitle class="field-details">
            <span class="data-type">{{ formatDataType(column.dataType) }}</span>
            <span v-if="!column.nullable" class="required-indicator">*</span>
          </v-list-item-subtitle>

          <template #append>
            <div class="field-actions">
              <v-tooltip text="필드 정보" location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-information-outline"
                    size="x-small"
                    variant="text"
                    @click.stop="showFieldInfo(column)"
                  />
                </template>
              </v-tooltip>

              <v-menu v-if="showFieldMenu">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-dots-vertical"
                    size="x-small"
                    variant="text"
                    @click.stop
                  />
                </template>
                
                <v-list density="compact">
                  <v-list-item @click="copyFieldName(column)">
                    <template #prepend>
                      <v-icon icon="mdi-content-copy" />
                    </template>
                    <v-list-item-title>필드명 복사</v-list-item-title>
                  </v-list-item>
                  
                  <v-list-item @click="addToFavorites(column)">
                    <template #prepend>
                      <v-icon icon="mdi-star-outline" />
                    </template>
                    <v-list-item-title>즐겨찾기 추가</v-list-item-title>
                  </v-list-item>
                  
                  <v-list-item @click="viewSampleData(column)">
                    <template #prepend>
                      <v-icon icon="mdi-eye-outline" />
                    </template>
                    <v-list-item-title>샘플 데이터</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </template>
        </v-list-item>

        <v-divider v-if="index < (schema?.columns?.length || 0) - 1" />
      </template>
    </v-list>

    <!-- 빈 상태 -->
    <div v-if="!schema?.columns?.length" class="empty-state">
      <v-icon icon="mdi-table-column" size="48" color="grey-lighten-1" />
      <p class="text-grey-lighten-1 mt-2">스키마 정보가 없습니다</p>
    </div>

    <!-- 필드 정보 대화상자 -->
    <v-dialog v-model="showFieldInfoDialog" max-width="600">
      <v-card v-if="selectedFieldInfo">
        <v-card-title class="d-flex align-center">
          <v-icon
            :icon="getDataTypeIcon(selectedFieldInfo.dataType)"
            :color="getDataTypeColor(selectedFieldInfo.dataType)"
            class="mr-2"
          />
          {{ selectedFieldInfo.name }}
        </v-card-title>

        <v-divider />

        <v-card-text>
          <v-row>
            <v-col cols="6">
              <v-list density="compact">
                <v-list-item>
                  <v-list-item-title>데이터 타입</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedFieldInfo.dataType }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item>
                  <v-list-item-title>Null 허용</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      :color="selectedFieldInfo.nullable ? 'success' : 'error'"
                      size="small"
                      variant="tonal"
                    >
                      {{ selectedFieldInfo.nullable ? '허용' : '불허용' }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item v-if="selectedFieldInfo.maxLength">
                  <v-list-item-title>최대 길이</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedFieldInfo.maxLength }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item v-if="selectedFieldInfo.precision">
                  <v-list-item-title>정밀도</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedFieldInfo.precision }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item v-if="selectedFieldInfo.scale">
                  <v-list-item-title>소수점 자릿수</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedFieldInfo.scale }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
            
            <v-col cols="6">
              <v-list density="compact">
                <v-list-item v-if="selectedFieldInfo.defaultValue">
                  <v-list-item-title>기본값</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedFieldInfo.defaultValue }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item v-if="selectedFieldInfo.description">
                  <v-list-item-title>설명</v-list-item-title>
                  <v-list-item-subtitle>{{ selectedFieldInfo.description }}</v-list-item-subtitle>
                </v-list-item>
                
                <v-list-item v-if="selectedFieldInfo.constraints">
                  <v-list-item-title>제약조건</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      v-for="constraint in selectedFieldInfo.constraints"
                      :key="constraint"
                      size="small"
                      class="mr-1"
                    >
                      {{ constraint }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>

          <!-- 샘플 데이터 -->
          <div v-if="selectedFieldInfo.sampleValues?.length" class="mt-4">
            <h4 class="text-subtitle-1 mb-2">샘플 값</h4>
            <v-chip
              v-for="(value, index) in selectedFieldInfo.sampleValues.slice(0, 10)"
              :key="index"
              size="small"
              variant="outlined"
              class="mr-1 mb-1"
            >
              {{ value }}
            </v-chip>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="showFieldInfoDialog = false">닫기</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 샘플 데이터 대화상자 -->
    <v-dialog v-model="showSampleDataDialog" max-width="800">
      <v-card v-if="selectedFieldInfo">
        <v-card-title>
          {{ selectedFieldInfo.name }} - 샘플 데이터
        </v-card-title>

        <v-divider />

        <v-card-text>
          <v-data-table
            :headers="sampleDataHeaders"
            :items="sampleDataItems"
            density="compact"
            :items-per-page="10"
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn @click="showSampleDataDialog = false">닫기</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { useAppStore } from '@/stores/app';

export default {
  name: 'SchemaTree',
  props: {
    schema: {
      type: Object,
      default: null
    },
    selectedFields: {
      type: Array,
      default: () => []
    },
    draggable: {
      type: Boolean,
      default: false
    },
    droppable: {
      type: Boolean,
      default: false
    },
    showFieldMenu: {
      type: Boolean,
      default: true
    }
  },
  emits: [
    'field-select',
    'field-drag-start',
    'field-drag-end',
    'field-drop'
  ],
  setup(props, { emit }) {
    const appStore = useAppStore();

    // 반응형 상태
    const dragOverField = ref(null);
    const showFieldInfoDialog = ref(false);
    const showSampleDataDialog = ref(false);
    const selectedFieldInfo = ref(null);

    // 샘플 데이터 테이블 헤더
    const sampleDataHeaders = [
      { title: '번호', key: 'index', width: 80 },
      { title: '값', key: 'value' },
      { title: '타입', key: 'type', width: 100 }
    ];

    // 계산된 속성
    const sampleDataItems = computed(() => {
      if (!selectedFieldInfo.value?.sampleValues) return [];
      
      return selectedFieldInfo.value.sampleValues.map((value, index) => ({
        index: index + 1,
        value: value,
        type: typeof value
      }));
    });

    // 메서드
    const selectField = (field) => {
      emit('field-select', field);
    };

    const onDragStart = (field, event) => {
      if (!props.draggable) return;
      
      emit('field-drag-start', field, event);
      
      // 드래그 효과 설정
      event.dataTransfer.effectAllowed = 'link';
      event.dataTransfer.setData('application/json', JSON.stringify(field));
      
      // 드래그 이미지 커스터마이징 (선택적)
      const dragElement = event.target.cloneNode(true);
      dragElement.style.transform = 'rotate(5deg)';
      dragElement.style.opacity = '0.8';
      document.body.appendChild(dragElement);
      event.dataTransfer.setDragImage(dragElement, 0, 0);
      setTimeout(() => document.body.removeChild(dragElement), 0);
    };

    const onDragEnd = () => {
      dragOverField.value = null;
      emit('field-drag-end');
    };

    const onDragOver = (field, event) => {
      if (!props.droppable) return;
      
      event.preventDefault();
      event.dataTransfer.dropEffect = 'link';
      dragOverField.value = field.name;
    };

    const onDragLeave = () => {
      dragOverField.value = null;
    };

    const onDrop = (field, event) => {
      if (!props.droppable) return;
      
      event.preventDefault();
      dragOverField.value = null;
      
      try {
        const sourceField = JSON.parse(event.dataTransfer.getData('application/json'));
        emit('field-drop', field, event, sourceField);
      } catch (error) {
        console.error('드롭 데이터 파싱 오류:', error);
      }
    };

    const showFieldInfo = (field) => {
      selectedFieldInfo.value = field;
      showFieldInfoDialog.value = true;
    };

    const copyFieldName = async (field) => {
      try {
        await navigator.clipboard.writeText(field.name);
        appStore.showNotification({
          type: 'success',
          message: `필드명 "${field.name}"이 클립보드에 복사되었습니다.`
        });
      } catch (error) {
        appStore.showNotification({
          type: 'error',
          message: '클립보드 복사에 실패했습니다.'
        });
      }
    };

    const addToFavorites = (field) => {
      // TODO: 즐겨찾기 기능 구현
      appStore.showNotification({
        type: 'info',
        message: `"${field.name}"이 즐겨찾기에 추가되었습니다.`
      });
    };

    const viewSampleData = (field) => {
      selectedFieldInfo.value = field;
      showSampleDataDialog.value = true;
    };

    const getDataTypeIcon = (dataType) => {
      const typeIcons = {
        // 문자열 타입
        'VARCHAR': 'mdi-format-text',
        'CHAR': 'mdi-format-text',
        'TEXT': 'mdi-text-long',
        'LONGTEXT': 'mdi-text-long',
        'STRING': 'mdi-format-text',
        
        // 숫자 타입
        'INTEGER': 'mdi-numeric',
        'BIGINT': 'mdi-numeric',
        'DECIMAL': 'mdi-numeric-positive-1',
        'FLOAT': 'mdi-numeric-positive-1',
        'DOUBLE': 'mdi-numeric-positive-1',
        'NUMBER': 'mdi-numeric',
        
        // 날짜/시간 타입
        'DATE': 'mdi-calendar',
        'TIME': 'mdi-clock-outline',
        'DATETIME': 'mdi-calendar-clock',
        'TIMESTAMP': 'mdi-calendar-clock',
        
        // 불린 타입
        'BOOLEAN': 'mdi-checkbox-marked-circle',
        'BOOL': 'mdi-checkbox-marked-circle',
        
        // 바이너리 타입
        'BLOB': 'mdi-file-outline',
        'BINARY': 'mdi-file-outline',
        
        // JSON 타입
        'JSON': 'mdi-code-json',
        'JSONB': 'mdi-code-json',
        
        // 기타
        'UUID': 'mdi-identifier',
        'ENUM': 'mdi-format-list-bulleted'
      };
      
      return typeIcons[dataType?.toUpperCase()] || 'mdi-help-circle-outline';
    };

    const getDataTypeColor = (dataType) => {
      const typeColors = {
        // 문자열 - 파란색 계열
        'VARCHAR': 'blue',
        'CHAR': 'blue',
        'TEXT': 'blue-darken-1',
        'LONGTEXT': 'blue-darken-2',
        'STRING': 'blue',
        
        // 숫자 - 초록색 계열
        'INTEGER': 'green',
        'BIGINT': 'green-darken-1',
        'DECIMAL': 'green-darken-2',
        'FLOAT': 'green-darken-2',
        'DOUBLE': 'green-darken-2',
        'NUMBER': 'green',
        
        // 날짜/시간 - 주황색 계열
        'DATE': 'orange',
        'TIME': 'orange-darken-1',
        'DATETIME': 'orange-darken-2',
        'TIMESTAMP': 'orange-darken-2',
        
        // 불린 - 보라색
        'BOOLEAN': 'purple',
        'BOOL': 'purple',
        
        // 바이너리 - 회색
        'BLOB': 'grey',
        'BINARY': 'grey-darken-1',
        
        // JSON - 청록색
        'JSON': 'teal',
        'JSONB': 'teal-darken-1',
        
        // 기타
        'UUID': 'indigo',
        'ENUM': 'amber'
      };
      
      return typeColors[dataType?.toUpperCase()] || 'grey';
    };

    const formatDataType = (dataType) => {
      if (!dataType) return '';
      
      // 타입 이름을 더 읽기 쉽게 포맷팅
      const formatted = dataType.toUpperCase();
      
      // 일반적인 별칭 적용
      const aliases = {
        'VARCHAR': 'TEXT',
        'LONGTEXT': 'LONG TEXT',
        'DATETIME': 'DATE TIME',
        'BIGINT': 'BIG INT',
        'JSONB': 'JSON'
      };
      
      return aliases[formatted] || formatted;
    };

    return {
      // 반응형 상태
      dragOverField,
      showFieldInfoDialog,
      showSampleDataDialog,
      selectedFieldInfo,
      sampleDataHeaders,
      
      // 계산된 속성
      sampleDataItems,
      
      // 메서드
      selectField,
      onDragStart,
      onDragEnd,
      onDragOver,
      onDragLeave,
      onDrop,
      showFieldInfo,
      copyFieldName,
      addToFavorites,
      viewSampleData,
      getDataTypeIcon,
      getDataTypeColor,
      formatDataType
    };
  }
};
</script>

<style scoped>
.schema-tree {
  height: 100%;
  overflow-y: auto;
}

.field-item {
  transition: all 0.2s ease;
  border-radius: 4px;
  margin: 2px;
}

.field-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.field-item.selected {
  background-color: rgba(33, 150, 243, 0.12);
  border-left: 3px solid #2196F3;
}

.field-item.draggable-field {
  cursor: grab;
}

.field-item.draggable-field:active {
  cursor: grabbing;
}

.field-item.droppable-field.drag-over {
  background-color: rgba(76, 175, 80, 0.12);
  border-left: 3px solid #4CAF50;
}

.field-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.field-details {
  display: flex;
  align-items: center;
  gap: 8px;
}

.data-type {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.6);
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 12px;
}

.required-indicator {
  color: #f44336;
  font-weight: bold;
}

.field-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.field-item:hover .field-actions {
  opacity: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
}

/* 드래그 효과 애니메이션 */
.field-item.draggable-field {
  transform-origin: center;
}

.field-item.draggable-field:hover {
  transform: scale(1.02);
}

.field-item.drag-over {
  animation: dropzone-pulse 1s ease-in-out infinite;
}

@keyframes dropzone-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
  }
}

/* 스크롤바 스타일링 */
.schema-tree::-webkit-scrollbar {
  width: 6px;
}

.schema-tree::-webkit-scrollbar-track {
  background: transparent;
}

.schema-tree::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.schema-tree::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 다크 모드 지원 */
@media (prefers-color-scheme: dark) {
  .field-item:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }
  
  .data-type {
    color: rgba(255, 255, 255, 0.7);
    background-color: rgba(255, 255, 255, 0.1);
  }
}
</style>