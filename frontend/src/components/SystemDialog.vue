<template>
  <v-dialog
    :model-value="modelValue"
    max-width="800"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-h5 pa-6">
        {{ mode === 'create' ? '새 시스템 추가' : '시스템 편집' }}
      </v-card-title>
      
      <v-divider />
      
      <v-card-text class="pa-6">
        <v-form ref="form" v-model="valid" @submit.prevent="save">
          <v-row>
            <!-- 기본 정보 -->
            <v-col cols="12" md="6">
              <v-text-field
                v-model="formData.name"
                :label="$t('systems.name')"
                :rules="nameRules"
                variant="outlined"
                required
                :disabled="saving"
              />
            </v-col>
            
            <v-col cols="12" md="6">
              <v-select
                v-model="formData.type"
                :items="systemTypes"
                :label="$t('systems.type')"
                :rules="typeRules"
                variant="outlined"
                required
                :disabled="saving"
                @update:model-value="onTypeChange"
              />
            </v-col>
            
            <v-col cols="12">
              <v-textarea
                v-model="formData.description"
                :label="$t('systems.description')"
                variant="outlined"
                rows="3"
                :disabled="saving"
              />
            </v-col>
            
            <v-col cols="12">
              <v-switch
                v-model="formData.isActive"
                :label="$t('systems.isActive')"
                color="primary"
                :disabled="saving"
              />
            </v-col>
          </v-row>
          
          <v-divider class="my-4" />
          
          <!-- 연결 정보 -->
          <div class="mb-4">
            <h3 class="text-h6 mb-3">{{ $t('systems.connectionInfo') }}</h3>
            
            <!-- 데이터베이스 연결 정보 -->
            <div v-if="isDatabaseType" class="connection-form">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="formData.connectionInfo.host"
                    :label="$t('systems.connection.host')"
                    :rules="requiredRules"
                    variant="outlined"
                    required
                    :disabled="saving"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="formData.connectionInfo.port"
                    :label="$t('systems.connection.port')"
                    type="number"
                    :rules="portRules"
                    variant="outlined"
                    :disabled="saving"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="formData.connectionInfo.username"
                    :label="$t('systems.connection.username')"
                    :rules="requiredRules"
                    variant="outlined"
                    required
                    :disabled="saving"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="formData.connectionInfo.password"
                    :label="$t('systems.connection.password')"
                    :rules="requiredRules"
                    type="password"
                    variant="outlined"
                    required
                    :disabled="saving"
                  />
                </v-col>
                
                <!-- 데이터베이스 특정 필드 -->
                <v-col v-if="needsDatabase" cols="12" md="6">
                  <v-text-field
                    v-model="formData.connectionInfo.database"
                    :label="$t('systems.connection.database')"
                    :rules="requiredRules"
                    variant="outlined"
                    required
                    :disabled="saving"
                  />
                </v-col>
                
                <v-col v-if="needsServiceName" cols="12" md="6">
                  <v-text-field
                    v-model="formData.connectionInfo.serviceName"
                    :label="$t('systems.connection.serviceName')"
                    :rules="requiredRules"
                    variant="outlined"
                    required
                    :disabled="saving"
                  />
                </v-col>
                
                <v-col v-if="needsSchema" cols="12" md="6">
                  <v-text-field
                    v-model="formData.connectionInfo.schema"
                    :label="$t('systems.connection.schema')"
                    variant="outlined"
                    :disabled="saving"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-switch
                    v-model="formData.connectionInfo.ssl"
                    :label="$t('systems.connection.ssl')"
                    color="primary"
                    :disabled="saving"
                  />
                </v-col>
              </v-row>
            </div>
            
            <!-- 파일 시스템 연결 정보 -->
            <div v-else-if="isFileSystemType" class="connection-form">
              <v-row>
                <v-col v-if="formData.type === 'local_fs'" cols="12">
                  <v-text-field
                    v-model="formData.connectionInfo.path"
                    :label="$t('systems.connection.path')"
                    :rules="requiredRules"
                    variant="outlined"
                    required
                    :disabled="saving"
                  />
                </v-col>
                
                <template v-else-if="formData.type === 'ftp' || formData.type === 'sftp'">
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.host"
                      :label="$t('systems.connection.host')"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model.number="formData.connectionInfo.port"
                      :label="$t('systems.connection.port')"
                      type="number"
                      :rules="portRules"
                      variant="outlined"
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.username"
                      :label="$t('systems.connection.username')"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.password"
                      :label="$t('systems.connection.password')"
                      type="password"
                      :rules="formData.type === 'sftp' ? [] : requiredRules"
                      variant="outlined"
                      :required="formData.type !== 'sftp'"
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <!-- SFTP 개인키 -->
                  <v-col v-if="formData.type === 'sftp'" cols="12">
                    <v-textarea
                      v-model="formData.connectionInfo.privateKey"
                      label="개인키 (Private Key)"
                      placeholder="-----BEGIN RSA PRIVATE KEY-----"
                      variant="outlined"
                      rows="4"
                      :disabled="saving"
                    />
                  </v-col>
                </template>
                
                <!-- AWS S3 -->
                <template v-else-if="formData.type === 'aws_s3'">
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.region"
                      :label="$t('systems.connection.region')"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.bucket"
                      :label="$t('systems.connection.bucket')"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.accessKeyId"
                      label="Access Key ID"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.secretAccessKey"
                      label="Secret Access Key"
                      type="password"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                </template>
                
                <!-- Azure Blob Storage -->
                <template v-else-if="formData.type === 'azure_blob'">
                  <v-col cols="12">
                    <v-text-field
                      v-model="formData.connectionInfo.connectionString"
                      label="연결 문자열"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.containerName"
                      label="컨테이너명"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                </template>
              </v-row>
            </div>
            
            <!-- API 연결 정보 -->
            <div v-else-if="isAPIType" class="connection-form">
              <v-row>
                <v-col cols="12">
                  <v-text-field
                    v-model="formData.connectionInfo.baseUrl"
                    label="Base URL"
                    :rules="urlRules"
                    variant="outlined"
                    required
                    :disabled="saving"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-select
                    v-model="formData.connectionInfo.authentication.type"
                    :items="authTypes"
                    label="인증 방식"
                    variant="outlined"
                    :disabled="saving"
                  />
                </v-col>
                
                <!-- 인증 정보 -->
                <template v-if="formData.connectionInfo.authentication.type === 'basic'">
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.authentication.username"
                      label="사용자명"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.authentication.password"
                      label="비밀번호"
                      type="password"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                </template>
                
                <template v-else-if="formData.connectionInfo.authentication.type === 'bearer'">
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.authentication.token"
                      label="Bearer Token"
                      type="password"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                </template>
                
                <template v-else-if="formData.connectionInfo.authentication.type === 'apikey'">
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.authentication.headerName"
                      label="헤더명"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                  
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="formData.connectionInfo.authentication.apiKey"
                      label="API 키"
                      type="password"
                      :rules="requiredRules"
                      variant="outlined"
                      required
                      :disabled="saving"
                    />
                  </v-col>
                </template>
              </v-row>
            </div>
            
            <!-- Kafka 연결 정보 -->
            <div v-else-if="formData.type === 'kafka'" class="connection-form">
              <v-row>
                <v-col cols="12">
                  <v-combobox
                    v-model="formData.connectionInfo.brokers"
                    label="브로커 주소"
                    :rules="brokersRules"
                    variant="outlined"
                    multiple
                    chips
                    required
                    :disabled="saving"
                    hint="예: localhost:9092"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="formData.connectionInfo.clientId"
                    label="Client ID"
                    variant="outlined"
                    :disabled="saving"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <v-switch
                    v-model="formData.connectionInfo.ssl"
                    label="SSL 사용"
                    color="primary"
                    :disabled="saving"
                  />
                </v-col>
              </v-row>
            </div>
          </div>
          
          <!-- 연결 테스트 -->
          <v-row class="mt-4">
            <v-col cols="12">
              <v-btn
                variant="outlined"
                color="primary"
                :loading="testing"
                :disabled="saving || !valid"
                @click="testConnection"
              >
                <v-icon left>mdi-connection</v-icon>
                {{ $t('systems.testConnection') }}
              </v-btn>
              
              <v-alert
                v-if="testResult"
                :type="testResult.success ? 'success' : 'error'"
                class="mt-3"
                closable
                @click:close="testResult = null"
              >
                {{ testResult.message }}
              </v-alert>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      
      <v-divider />
      
      <v-card-actions class="pa-6">
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="saving"
          @click="$emit('cancel')"
        >
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="!valid"
          @click="save"
        >
          {{ $t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSystemsStore } from '@/stores/systems'

// Props & Emits
const props = defineProps({
  modelValue: Boolean,
  system: Object,
  mode: {
    type: String,
    default: 'create'
  }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const { t } = useI18n()
const systemsStore = useSystemsStore()

// 반응형 데이터
const form = ref(null)
const valid = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)

// 폼 데이터
const formData = ref({
  name: '',
  type: '',
  description: '',
  isActive: true,
  connectionInfo: {}
})

// 시스템 타입 목록
const systemTypes = [
  { title: 'Oracle Database', value: 'oracle' },
  { title: 'PostgreSQL', value: 'postgresql' },
  { title: 'MySQL', value: 'mysql' },
  { title: 'SQL Server', value: 'mssql' },
  { title: 'SQLite', value: 'sqlite' },
  { title: 'MongoDB', value: 'mongodb' },
  { title: 'Redis', value: 'redis' },
  { title: 'FTP Server', value: 'ftp' },
  { title: 'SFTP Server', value: 'sftp' },
  { title: 'Local File System', value: 'local_fs' },
  { title: 'Amazon S3', value: 'aws_s3' },
  { title: 'Azure Blob Storage', value: 'azure_blob' },
  { title: 'REST API', value: 'api_rest' },
  { title: 'Apache Kafka', value: 'kafka' }
]

// 인증 방식 목록
const authTypes = [
  { title: '인증 없음', value: 'none' },
  { title: 'Basic 인증', value: 'basic' },
  { title: 'Bearer Token', value: 'bearer' },
  { title: 'API Key', value: 'apikey' }
]

// 계산된 속성
const isDatabaseType = computed(() => {
  return ['oracle', 'postgresql', 'mysql', 'mssql', 'sqlite', 'mongodb', 'redis'].includes(formData.value.type)
})

const isFileSystemType = computed(() => {
  return ['ftp', 'sftp', 'local_fs', 'aws_s3', 'azure_blob'].includes(formData.value.type)
})

const isAPIType = computed(() => {
  return ['api_rest'].includes(formData.value.type)
})

const needsDatabase = computed(() => {
  return ['postgresql', 'mysql', 'mssql', 'mongodb'].includes(formData.value.type)
})

const needsServiceName = computed(() => {
  return ['oracle'].includes(formData.value.type)
})

const needsSchema = computed(() => {
  return ['postgresql'].includes(formData.value.type)
})

// 검증 규칙
const nameRules = [
  v => !!v || '시스템 이름은 필수입니다.',
  v => (v && v.length <= 100) || '시스템 이름은 100자 이하여야 합니다.'
]

const typeRules = [
  v => !!v || '시스템 타입은 필수입니다.'
]

const requiredRules = [
  v => !!v || '필수 항목입니다.'
]

const portRules = [
  v => !v || (v >= 1 && v <= 65535) || '포트는 1-65535 사이여야 합니다.'
]

const urlRules = [
  v => !!v || 'URL은 필수입니다.',
  v => {
    try {
      new URL(v)
      return true
    } catch {
      return '유효한 URL을 입력해주세요.'
    }
  }
]

const brokersRules = [
  v => (v && v.length > 0) || '브로커 주소는 필수입니다.'
]

// 메서드
const initializeForm = () => {
  if (props.system) {
    formData.value = {
      name: props.system.name || '',
      type: props.system.type || '',
      description: props.system.description || '',
      isActive: props.system.isActive !== undefined ? props.system.isActive : true,
      connectionInfo: props.system.connectionInfo || {}
    }
  } else {
    formData.value = {
      name: '',
      type: '',
      description: '',
      isActive: true,
      connectionInfo: {}
    }
  }
  
  // 테스트 결과 초기화
  testResult.value = null
}

const onTypeChange = () => {
  // 타입 변경 시 연결 정보 초기화
  formData.value.connectionInfo = {}
  
  // 타입별 기본값 설정
  const defaults = getDefaultConnectionInfo(formData.value.type)
  formData.value.connectionInfo = { ...defaults }
  
  testResult.value = null
}

const getDefaultConnectionInfo = (type) => {
  const defaults = {
    oracle: { port: 1521, ssl: false },
    postgresql: { port: 5432, ssl: false, schema: 'public' },
    mysql: { port: 3306, ssl: false },
    mssql: { port: 1433, encrypt: false, trustServerCertificate: false },
    sqlite: { readonly: false },
    mongodb: { port: 27017, ssl: false, authSource: 'admin' },
    redis: { port: 6379, ssl: false, database: 0 },
    ftp: { port: 21, passiveMode: true },
    sftp: { port: 22 },
    local_fs: { readonly: false },
    aws_s3: { s3ForcePathStyle: false },
    azure_blob: {},
    api_rest: { 
      timeout: 30000,
      retryCount: 3,
      authentication: { type: 'none' },
      headers: {}
    },
    kafka: { ssl: false, clientId: 'nificdc-client' }
  }
  
  return defaults[type] || {}
}

const testConnection = async () => {
  if (!form.value.validate()) return
  
  testing.value = true
  testResult.value = null
  
  try {
    const result = await systemsStore.validateConnection(formData.value.type, formData.value.connectionInfo)
    testResult.value = {
      success: true,
      message: '연결 정보가 유효합니다.'
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: error.message || '연결 테스트 실패'
    }
  } finally {
    testing.value = false
  }
}

const save = async () => {
  if (!form.value.validate()) return
  
  saving.value = true
  
  try {
    if (props.mode === 'create') {
      await systemsStore.createSystem(formData.value)
    } else {
      await systemsStore.updateSystem(props.system.id, formData.value)
    }
    
    emit('save')
  } catch (error) {
    console.error('시스템 저장 실패:', error)
    // 에러는 상위 컴포넌트에서 처리
  } finally {
    saving.value = false
  }
}

// 와처
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    initializeForm()
    nextTick(() => {
      form.value?.resetValidation()
    })
  }
})

watch(() => props.system, () => {
  if (props.modelValue) {
    initializeForm()
  }
})
</script>

<style scoped>
.connection-form {
  background-color: rgba(var(--v-theme-surface), 0.05);
  border-radius: 8px;
  padding: 16px;
  margin-top: 8px;
}

.v-card-title {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.v-card-actions {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>