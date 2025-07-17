import { 
  TextIcon,
  NumberIcon,
  CalendarIcon,
  ClockIcon,
  ToggleIcon,
  JsonIcon,
  BinaryIcon,
  LocationIcon,
  IdIcon,
  ArrayIcon,
  ObjectIcon,
  UnknownIcon
} from '@/components/icons'

// Map data types to icon components
const typeIconMap = {
  // String types
  varchar: TextIcon,
  char: TextIcon,
  text: TextIcon,
  tinytext: TextIcon,
  mediumtext: TextIcon,
  longtext: TextIcon,
  string: TextIcon,
  nvarchar: TextIcon,
  nchar: TextIcon,
  clob: TextIcon,
  
  // Number types
  integer: NumberIcon,
  int: NumberIcon,
  smallint: NumberIcon,
  bigint: NumberIcon,
  decimal: NumberIcon,
  numeric: NumberIcon,
  float: NumberIcon,
  double: NumberIcon,
  real: NumberIcon,
  money: NumberIcon,
  smallmoney: NumberIcon,
  tinyint: NumberIcon,
  number: NumberIcon,
  
  // Date/Time types
  date: CalendarIcon,
  datetime: CalendarIcon,
  timestamp: CalendarIcon,
  time: ClockIcon,
  year: CalendarIcon,
  interval: ClockIcon,
  
  // Boolean types
  boolean: ToggleIcon,
  bool: ToggleIcon,
  bit: ToggleIcon,
  
  // JSON types
  json: JsonIcon,
  jsonb: JsonIcon,
  
  // Binary types
  binary: BinaryIcon,
  varbinary: BinaryIcon,
  blob: BinaryIcon,
  tinyblob: BinaryIcon,
  mediumblob: BinaryIcon,
  longblob: BinaryIcon,
  bytea: BinaryIcon,
  
  // UUID types
  uuid: IdIcon,
  guid: IdIcon,
  uniqueidentifier: IdIcon,
  
  // Geometry types
  geometry: LocationIcon,
  geography: LocationIcon,
  point: LocationIcon,
  polygon: LocationIcon,
  
  // Array types
  array: ArrayIcon,
  
  // Object types
  object: ObjectIcon,
  record: ObjectIcon,
  struct: ObjectIcon
}

// Type category patterns for fuzzy matching
const typeCategoryPatterns = [
  { pattern: /^(var)?char/i, icon: TextIcon },
  { pattern: /text$/i, icon: TextIcon },
  { pattern: /string/i, icon: TextIcon },
  { pattern: /^(big|small|tiny)?int/i, icon: NumberIcon },
  { pattern: /^(decimal|numeric|float|double|real)/i, icon: NumberIcon },
  { pattern: /^(date|time|timestamp)/i, icon: CalendarIcon },
  { pattern: /^bool/i, icon: ToggleIcon },
  { pattern: /^json/i, icon: JsonIcon },
  { pattern: /^(var)?binary/i, icon: BinaryIcon },
  { pattern: /blob$/i, icon: BinaryIcon },
  { pattern: /^uuid|guid$/i, icon: IdIcon },
  { pattern: /^geo/i, icon: LocationIcon },
  { pattern: /\[\]$/i, icon: ArrayIcon }
]

/**
 * Get icon component for a data type
 * @param {string} dataType - The data type string
 * @returns {Component} Vue icon component
 */
export function getFieldIcon(dataType) {
  if (!dataType) {
    return UnknownIcon
  }

  // Normalize the data type
  const normalizedType = dataType.toLowerCase().trim()
  
  // Remove precision/length info (e.g., varchar(255) -> varchar)
  const baseType = normalizedType.replace(/\([^)]*\)/g, '')
  
  // Direct lookup
  if (typeIconMap[baseType]) {
    return typeIconMap[baseType]
  }
  
  // Pattern matching
  for (const { pattern, icon } of typeCategoryPatterns) {
    if (pattern.test(baseType)) {
      return icon
    }
  }
  
  // Default to unknown icon
  return UnknownIcon
}

/**
 * Get icon color class for a data type
 * @param {string} dataType - The data type string
 * @returns {string} CSS class for icon color
 */
export function getFieldIconColor(dataType) {
  if (!dataType) {
    return 'icon-color-default'
  }

  const normalizedType = dataType.toLowerCase().trim()
  const baseType = normalizedType.replace(/\([^)]*\)/g, '')

  // String types
  if (/^(var)?char|text$|string/i.test(baseType)) {
    return 'icon-color-string'
  }
  
  // Number types
  if (/^(big|small|tiny)?int|^(decimal|numeric|float|double|real|money)/i.test(baseType)) {
    return 'icon-color-number'
  }
  
  // Date/Time types
  if (/^(date|time|timestamp|year|interval)/i.test(baseType)) {
    return 'icon-color-datetime'
  }
  
  // Boolean types
  if (/^bool|^bit$/i.test(baseType)) {
    return 'icon-color-boolean'
  }
  
  // JSON types
  if (/^json/i.test(baseType)) {
    return 'icon-color-json'
  }
  
  // Binary types
  if (/^(var)?binary|blob$|^bytea$/i.test(baseType)) {
    return 'icon-color-binary'
  }
  
  // UUID types
  if (/^uuid|guid$|^uniqueidentifier$/i.test(baseType)) {
    return 'icon-color-uuid'
  }
  
  // Geometry types
  if (/^geo|^point$|^polygon$/i.test(baseType)) {
    return 'icon-color-geometry'
  }
  
  // Array types
  if (/\[\]$|^array$/i.test(baseType)) {
    return 'icon-color-array'
  }
  
  // Object types
  if (/^object$|^record$|^struct$/i.test(baseType)) {
    return 'icon-color-object'
  }
  
  return 'icon-color-default'
}

/**
 * Get type category for grouping
 * @param {string} dataType - The data type string
 * @returns {string} Type category
 */
export function getTypeCategory(dataType) {
  if (!dataType) {
    return 'unknown'
  }

  const normalizedType = dataType.toLowerCase().trim()
  const baseType = normalizedType.replace(/\([^)]*\)/g, '')

  if (/^(var)?char|text$|string/i.test(baseType)) {
    return 'string'
  }
  
  if (/^(big|small|tiny)?int|^(decimal|numeric|float|double|real|money)/i.test(baseType)) {
    return 'number'
  }
  
  if (/^(date|time|timestamp|year|interval)/i.test(baseType)) {
    return 'datetime'
  }
  
  if (/^bool|^bit$/i.test(baseType)) {
    return 'boolean'
  }
  
  if (/^json/i.test(baseType)) {
    return 'json'
  }
  
  if (/^(var)?binary|blob$|^bytea$/i.test(baseType)) {
    return 'binary'
  }
  
  if (/^uuid|guid$|^uniqueidentifier$/i.test(baseType)) {
    return 'identifier'
  }
  
  if (/^geo|^point$|^polygon$/i.test(baseType)) {
    return 'geometry'
  }
  
  if (/\[\]$|^array$/i.test(baseType)) {
    return 'array'
  }
  
  if (/^object$|^record$|^struct$/i.test(baseType)) {
    return 'object'
  }
  
  return 'other'
}