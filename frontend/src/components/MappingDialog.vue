<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="1200px"
    persistent
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span class="text-h5">
          {{ isEdit ? '매핑 편집' : '새 매핑 생성' }}
        </span>
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="$emit('close')"
        />
      </v-card-title>

      <v-card-text class="pa-6">
        <v-form ref="formRef" v-model="valid">
          <!-- 기본 정보 -->
          <v-row>
            <v-col cols="12">
              <h3 class="text-h6 mb-4">기본 정보</h3>
            </v-col>
            
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.name"
                label="매핑 이름"
                :rules="[rules.required]"
                variant="outlined"
                required
              />
            </v-col>
            
            <v-col cols="12" md="6">
              <v-select
                v-model="form.mappingType"
                label="매핑 타입"
                :items="mappingTypeOptions"
                item-value="value"
                item-title="label"
                :rules="[rules.required]"
                variant="outlined"
                required
              />
            </v-col>
            
            <v-col cols="12">
              <v-textarea
                v-model="form.description"
                label="설명"
                variant="outlined"
                rows="3"
              />
            </v-col>
          </v-row>

          <!-- 시스템 및 스키마 선택 -->
          <v-row>
            <v-col cols="12">
              <h3 class="text-h6 mb-4">시스템 및 스키마</h3>
            </v-col>
            
            <v-col cols="12" md="6">
              <v-select
                v-model="form.sourceSystemId"
                label="소스 시스템"
                :items="systems"
                item-value="id"
                item-title="name"
                :rules="[rules.required]"
                variant="outlined"
                required
                @update:model-value="onSourceSystemChange"
              />
            </v-col>
            
            <v-col cols="12" md="6">
              <v-select
                v-model="form.targetSystemId"
                label="타겟 시스템"
                :items="systems"
                item-value="id"
                item-title="name"
                :rules="[rules.required]"
                variant="outlined"
                required
                @update:model-value="onTargetSystemChange"
              />
            </v-col>
            
            <v-col cols="12" md="6">
              <v-select
                v-model="form.sourceSchemaId"
                label="소스 스키마"
                :items="sourceSchemas"
                item-value="id"
                item-title="name"
                :rules="[rules.required]"
                variant="outlined"
                required
                @update:model-value="onSourceSchemaChange"
              />
            </v-col>
            
            <v-col cols="12" md="6">
              <v-select
                v-model="form.targetSchemaId"
                label="타겟 스키마"
                :items="targetSchemas"
                item-value="id"
                item-title="name"
                :rules="[rules.required]"
                variant="outlined"
                required
                @update:model-value="onTargetSchemaChange"
              />
            </v-col>
          </v-row>

          <!-- 매핑 규칙 -->
          <v-row>
            <v-col cols="12">
              <div class="d-flex justify-space-between align-center mb-4">
                <h3 class="text-h6">매핑 규칙</h3>
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-plus"
                  @click="addMappingRule"
                  :disabled="!sourceSchema || !targetSchema"
                >
                  규칙 추가
                </v-btn>
              </div>
              
              <v-card
                v-if="!sourceSchema || !targetSchema"
                variant="outlined"
                class="pa-4 text-center"
              >
                <p class="text-body-2 text-medium-emphasis mb-0">
                  소스 및 타겟 스키마를 선택하면 매핑 규칙을 설정할 수 있습니다.
                </p>
              </v-card>
              
              <div v-else-if="form.mappingRules.length === 0" class="text-center pa-4">
                <v-icon size="48" color="grey-lighten-2" class="mb-2">
                  mdi-map-marker-path
                </v-icon>
                <p class="text-body-2 text-medium-emphasis mb-0">
                  아직 매핑 규칙이 없습니다. 규칙을 추가해보세요.
                </p>
              </div>
              
              <div v-else>
                <v-card
                  v-for="(rule, index) in form.mappingRules"
                  :key="index"
                  variant="outlined"
                  class="mb-3"
                >
                  <v-card-text>
                    <div class="d-flex justify-space-between align-center mb-3">
                      <span class="text-subtitle-2">규칙 {{ index + 1 }}</span>
                      <v-btn
                        icon="mdi-delete"
                        size="small"
                        variant="text"
                        color="error"
                        @click="removeMappingRule(index)"
                      />
                    </div>
                    
                    <v-row>
                      <v-col cols="12" md="3">
                        <v-select
                          v-model="rule.sourceField"
                          label="소스 필드"
                          :items="sourceFields"
                          variant="outlined"
                          density="compact"
                          :rules="[rules.required]"
                        />
                      </v-col>
                      
                      <v-col cols="12" md="3">
                        <v-select
                          v-model="rule.mappingType"
                          label="매핑 타입"
                          :items="ruleMappingTypes"
                          item-value="value"
                          item-title="label"
                          variant="outlined"
                          density="compact"
                          :rules="[rules.required]"
                        />
                      </v-col>
                      
                      <v-col cols="12" md="3">
                        <v-select
                          v-model="rule.targetField"
                          label="타겟 필드"
                          :items="targetFields"
                          variant="outlined"
                          density="compact"
                          :rules="[rules.required]"
                        />
                      </v-col>
                      
                      <v-col cols="12" md="3">
                        <v-switch
                          v-model="rule.required"
                          label="필수"
                          color="primary"
                          density="compact"
                        />
                      </v-col>
                    </v-row>
                    
                    <!-- 변환 함수 설정 -->
                    <v-row v-if="rule.mappingType === 'transform'">
                      <v-col cols="12">
                        <v-select
                          v-model="rule.transformFunction"
                          label="변환 함수"
                          :items="transformFunctions"
                          item-value="name"
                          item-title="label"
                          variant="outlined"
                          density="compact"
                        />
                      </v-col>
                    </v-row>
                    
                    <!-- 연결 매핑 설정 -->
                    <v-row v-if="rule.mappingType === 'concat'">
                      <v-col cols="12" md="6">
                        <v-combobox
                          v-model="rule.sourceFields"
                          label="소스 필드들"
                          :items="sourceFields"
                          variant="outlined"
                          density="compact"
                          multiple
                          chips
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="rule.separator"
                          label="구분자"
                          variant="outlined"
                          density="compact"
                          placeholder="예: , / _ 등"
                        />
                      </v-col>
                    </v-row>
                    
                    <!-- 분할 매핑 설정 -->
                    <v-row v-if="rule.mappingType === 'split'">
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="rule.separator"
                          label="구분자"
                          variant="outlined"
                          density="compact"
                          placeholder="예: , / _ 등"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model.number="rule.splitIndex"
                          label="인덱스"
                          type="number"
                          variant="outlined"
                          density="compact"
                          min="0"
                        />
                      </v-col>
                    </v-row>
                    
                    <!-- 조건부 매핑 -->
                    <v-row v-if="rule.condition">
                      <v-col cols="12" md="4">
                        <v-select
                          v-model="rule.condition.field"
                          label="조건 필드"
                          :items="sourceFields"
                          variant="outlined"
                          density="compact"
                        />
                      </v-col>
                      <v-col cols="12" md="4">
                        <v-select
                          v-model="rule.condition.operator"
                          label="연산자"
                          :items="conditionOperators"
                          item-value="value"
                          item-title="label"
                          variant="outlined"
                          density="compact"
                        />
                      </v-col>
                      <v-col cols="12" md="4">
                        <v-text-field
                          v-model="rule.condition.value"
                          label="조건 값"
                          variant="outlined"
                          density="compact"
                        />
                      </v-col>
                    </v-row>
                    
                    <!-- 기본값 설정 -->
                    <v-row>
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="rule.defaultValue"
                          label="기본값"
                          variant="outlined"
                          density="compact"
                          placeholder="조건에 맞지 않거나 값이 없을 때 사용"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-switch
                          v-model="rule.hasCondition"
                          label="조건부 매핑"
                          color="primary"
                          density="compact"
                          @update:model-value="toggleCondition(rule)"
                        />
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </div>
            </v-col>
          </v-row>

          <!-- 변환 스크립트 -->
          <v-row>
            <v-col cols="12">
              <h3 class="text-h6 mb-4">변환 스크립트 (선택사항)</h3>
              <v-textarea
                v-model="form.transformationScript"
                label="JavaScript 변환 스크립트"
                variant="outlined"
                rows="6"
                placeholder="// 변환된 데이터를 추가로 처리하는 스크립트를 작성하세요
// 예: return { ...transformed, customField: source.field1 + source.field2 };"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>

      <v-card-actions class="px-6 pb-6">
        <v-spacer />
        <v-btn
          variant="text"
          @click="$emit('close')"
        >
          취소
        </v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          @click="save"
          :disabled="!valid"
        >
          저장
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { schemaService } from '@/services/schemaService';
import { mappingService } from '@/services/mappingService';

export default {
  name: 'MappingDialog',
  emits: ['update:modelValue', 'save', 'close'],
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    mapping: {
      type: Object,
      default: null
    },
    systems: {
      type: Array,
      default: () => []
    },
    schemas: {
      type: Array,
      default: () => []
    }
  },
  setup(props, { emit }) {
    const formRef = ref(null);
    const loading = ref(false);
    const valid = ref(false);
    
    const sourceSchemas = ref([]);
    const targetSchemas = ref([]);
    const sourceSchema = ref(null);
    const targetSchema = ref(null);
    const mappingTypeOptions = ref([]);
    const ruleMappingTypes = ref([]);
    const transformFunctions = ref([]);

    // 폼 데이터
    const form = reactive({
      name: '',
      description: '',
      sourceSystemId: '',
      targetSystemId: '',
      sourceSchemaId: '',
      targetSchemaId: '',
      mappingType: 'one_to_one',
      mappingRules: [],
      transformationScript: '',
      transformationConfig: {},
      validationRules: []
    });

    // 유효성 검사 규칙
    const rules = {
      required: (value) => !!value || '필수 입력 항목입니다.'
    };

    // 조건 연산자 옵션
    const conditionOperators = [
      { value: 'equals', label: '같음' },
      { value: 'not_equals', label: '다름' },
      { value: 'greater_than', label: '초과' },
      { value: 'less_than', label: '미만' },
      { value: 'contains', label: '포함' },
      { value: 'starts_with', label: '시작' },
      { value: 'ends_with', label: '끝' },
      { value: 'is_null', label: '널' },
      { value: 'is_not_null', label: '널 아님' }
    ];

    // 계산된 속성
    const isEdit = computed(() => !!props.mapping);

    const sourceFields = computed(() => {
      if (!sourceSchema.value || !sourceSchema.value.columns) return [];
      return sourceSchema.value.columns.map(col => col.name);
    });

    const targetFields = computed(() => {
      if (!targetSchema.value || !targetSchema.value.columns) return [];
      return targetSchema.value.columns.map(col => col.name);
    });

    // 소스 시스템 변경 처리
    const onSourceSystemChange = (systemId) => {
      form.sourceSchemaId = '';
      sourceSchema.value = null;
      sourceSchemas.value = props.schemas.filter(schema => schema.systemId === systemId);
    };

    // 타겟 시스템 변경 처리
    const onTargetSystemChange = (systemId) => {
      form.targetSchemaId = '';
      targetSchema.value = null;
      targetSchemas.value = props.schemas.filter(schema => schema.systemId === systemId);
    };

    // 소스 스키마 변경 처리
    const onSourceSchemaChange = (schemaId) => {
      sourceSchema.value = sourceSchemas.value.find(schema => schema.id === schemaId);
    };

    // 타겟 스키마 변경 처리
    const onTargetSchemaChange = (schemaId) => {
      targetSchema.value = targetSchemas.value.find(schema => schema.id === schemaId);
    };

    // 매핑 규칙 추가
    const addMappingRule = () => {
      form.mappingRules.push({
        sourceField: '',
        targetField: '',
        mappingType: 'direct',
        required: false,
        transformFunction: '',
        sourceFields: [],
        separator: '',
        splitIndex: 0,
        condition: null,
        defaultValue: '',
        hasCondition: false
      });
    };

    // 매핑 규칙 제거
    const removeMappingRule = (index) => {
      form.mappingRules.splice(index, 1);
    };

    // 조건부 매핑 토글
    const toggleCondition = (rule) => {
      if (rule.hasCondition) {
        rule.condition = {
          field: '',
          operator: 'equals',
          value: ''
        };
      } else {
        rule.condition = null;
      }
    };

    // 매핑 타입 및 변환 함수 로드
    const loadMappingMetadata = async () => {
      try {
        const [typesResponse, functionsResponse] = await Promise.all([
          mappingService.getMappingTypes(),
          mappingService.getTransformFunctions()
        ]);

        mappingTypeOptions.value = typesResponse.data.mappingTypes;
        ruleMappingTypes.value = typesResponse.data.ruleMappingTypes;
        transformFunctions.value = functionsResponse.data.functions || [];
      } catch (error) {
        console.error('매핑 메타데이터 로드 실패:', error);
      }
    };

    // 폼 초기화
    const resetForm = () => {
      Object.assign(form, {
        name: '',
        description: '',
        sourceSystemId: '',
        targetSystemId: '',
        sourceSchemaId: '',
        targetSchemaId: '',
        mappingType: 'one_to_one',
        mappingRules: [],
        transformationScript: '',
        transformationConfig: {},
        validationRules: []
      });
      
      sourceSchemas.value = [];
      targetSchemas.value = [];
      sourceSchema.value = null;
      targetSchema.value = null;
    };

    // 폼 데이터 로드
    const loadFormData = () => {
      if (props.mapping) {
        Object.assign(form, {
          name: props.mapping.name || '',
          description: props.mapping.description || '',
          sourceSystemId: props.mapping.sourceSystemId || '',
          targetSystemId: props.mapping.targetSystemId || '',
          sourceSchemaId: props.mapping.sourceSchemaId || '',
          targetSchemaId: props.mapping.targetSchemaId || '',
          mappingType: props.mapping.mappingType || 'one_to_one',
          mappingRules: props.mapping.mappingRules || [],
          transformationScript: props.mapping.transformationScript || '',
          transformationConfig: props.mapping.transformationConfig || {},
          validationRules: props.mapping.validationRules || []
        });

        // 관련 스키마 로드
        if (form.sourceSystemId) {
          onSourceSystemChange(form.sourceSystemId);
        }
        if (form.targetSystemId) {
          onTargetSystemChange(form.targetSystemId);
        }
        if (form.sourceSchemaId) {
          setTimeout(() => onSourceSchemaChange(form.sourceSchemaId), 100);
        }
        if (form.targetSchemaId) {
          setTimeout(() => onTargetSchemaChange(form.targetSchemaId), 100);
        }
      }
    };

    // 저장
    const save = async () => {
      if (!valid.value) return;

      loading.value = true;
      try {
        const mappingData = { ...form };
        emit('save', mappingData);
      } catch (error) {
        console.error('저장 실패:', error);
      } finally {
        loading.value = false;
      }
    };

    // 대화상자 열림/닫힘 감지
    watch(() => props.modelValue, (newValue) => {
      if (newValue) {
        loadFormData();
      } else {
        resetForm();
      }
    });

    // 컴포넌트 마운트 시 메타데이터 로드
    onMounted(() => {
      loadMappingMetadata();
    });

    return {
      formRef,
      loading,
      valid,
      form,
      rules,
      sourceSchemas,
      targetSchemas,
      sourceSchema,
      targetSchema,
      mappingTypeOptions,
      ruleMappingTypes,
      transformFunctions,
      conditionOperators,
      
      // 계산된 속성
      isEdit,
      sourceFields,
      targetFields,
      
      // 메서드
      onSourceSystemChange,
      onTargetSystemChange,
      onSourceSchemaChange,
      onTargetSchemaChange,
      addMappingRule,
      removeMappingRule,
      toggleCondition,
      save
    };
  }
};
</script>

<style scoped>
.v-dialog > .v-card {
  border-radius: 12px;
}

.v-card-text {
  max-height: 70vh;
  overflow-y: auto;
}

.v-textarea :deep(.v-field__input) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}
</style>