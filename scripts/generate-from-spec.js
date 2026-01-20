#!/usr/bin/env node

/**
 * Generate CDC artifacts from spec.yaml
 *
 * Usage:
 *   node scripts/generate-from-spec.js [table_name]
 *   node scripts/generate-from-spec.js --all
 *
 * This script reads spec files and generates:
 * - SQL Registry entries (sql-registry/oracle.json)
 * - Flow JSON LookupService entries (flows/oracle_cdc_flow.json)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SPECS_DIR = path.join(__dirname, '../specs');
const SQL_REGISTRY_PATH = path.join(__dirname, '../sql-registry/oracle.json');
const FLOW_PATH = path.join(__dirname, '../flows/oracle_cdc_flow.json');

/**
 * Load spec file for a table
 */
function loadSpec(tableName) {
  const specPath = path.join(SPECS_DIR, `${tableName}.yaml`);
  if (!fs.existsSync(specPath)) {
    throw new Error(`Spec file not found: ${specPath}`);
  }
  return yaml.load(fs.readFileSync(specPath, 'utf8'));
}

/**
 * Load all spec files
 */
function loadAllSpecs() {
  const specs = [];
  const files = fs.readdirSync(SPECS_DIR).filter(f => f.endsWith('.yaml'));

  for (const file of files) {
    const tableName = file.replace('.yaml', '');
    specs.push({ tableName, spec: loadSpec(tableName) });
  }

  return specs;
}

/**
 * Generate SQL query from spec
 */
function generateSql(spec) {
  const { table, columns } = spec;
  const columnList = columns ? columns.map(c => c.name).join(', ') : '*';

  return `SELECT ${columnList} FROM ${table.schema}.${table.name} WHERE ${table.cdc_key} > TO_TIMESTAMP(\${range_from}, 'YYYY-MM-DD HH24:MI:SS.FF') AND ${table.cdc_key} <= TO_TIMESTAMP(\${range_to}, 'YYYY-MM-DD HH24:MI:SS.FF') ORDER BY ${table.cdc_key}`;
}

/**
 * Generate SQL Registry entries for a spec
 */
function generateSqlRegistryEntries(spec) {
  const { table, range } = spec;
  const tableLower = table.name.toLowerCase();
  const sql = generateSql(spec);
  const entries = {};

  for (const rangeOption of range.options) {
    const sqlId = `oracle.cdc.${tableLower}.${rangeOption}`;
    entries[sqlId] = {
      sql,
      table: table.name,
      schema: table.schema,
      range: rangeOption,
      max_value_column: table.cdc_key,
      description: `${rangeOption} interval CDC query for ${table.name}`
    };
  }

  return entries;
}

/**
 * Update SQL Registry file
 */
function updateSqlRegistry(newEntries) {
  let registry = {};

  if (fs.existsSync(SQL_REGISTRY_PATH)) {
    registry = JSON.parse(fs.readFileSync(SQL_REGISTRY_PATH, 'utf8'));
  }

  // Merge new entries
  Object.assign(registry, newEntries);

  // Sort by key for consistent output
  const sorted = Object.keys(registry).sort().reduce((acc, key) => {
    acc[key] = registry[key];
    return acc;
  }, {});

  fs.writeFileSync(SQL_REGISTRY_PATH, JSON.stringify(sorted, null, 2) + '\n');

  return Object.keys(newEntries);
}

/**
 * Update Flow JSON LookupService
 */
function updateFlowLookupService(newEntries) {
  if (!fs.existsSync(FLOW_PATH)) {
    console.warn('Flow file not found, skipping LookupService update');
    return;
  }

  const flow = JSON.parse(fs.readFileSync(FLOW_PATH, 'utf8'));

  // Find SQL Lookup Service
  const lookupService = flow.flowContents.controllerServices.find(
    s => s.identifier === 'sql-lookup-service'
  );

  if (!lookupService) {
    console.warn('SQL Lookup Service not found in flow');
    return;
  }

  // Add new SQL entries to lookup service properties
  for (const [sqlId, entry] of Object.entries(newEntries)) {
    lookupService.properties[sqlId] = entry.sql;
  }

  fs.writeFileSync(FLOW_PATH, JSON.stringify(flow, null, 2) + '\n');
}

/**
 * Generate a new spec template
 */
function generateSpecTemplate(tableName) {
  const template = `# ${tableName.toUpperCase()} CDC Specification

table:
  name: ${tableName.toUpperCase()}
  schema: CDC_TEST
  primary_key: ID
  cdc_key: UPDATED_AT
  description: "CDC table for ${tableName}"

columns:
  - name: ID
    type: NUMBER
    nullable: false
  - name: NAME
    type: VARCHAR2(100)
    nullable: true
  - name: UPDATED_AT
    type: TIMESTAMP
    nullable: false

elasticsearch:
  index: ${tableName.toLowerCase()}
  id_field: ID
  mapping:
    dynamic: strict
    properties:
      ID:
        type: long
      NAME:
        type: keyword
      UPDATED_AT:
        type: date

range:
  default: 5m
  options:
    - 5m
    - 15m
    - 30m
    - 60m

cdc:
  mode: timestamp
  delete_handling: ignore
  update_handling: upsert
`;

  return template;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node scripts/generate-from-spec.js <table_name>  - Generate from specific spec');
    console.log('  node scripts/generate-from-spec.js --all         - Generate from all specs');
    console.log('  node scripts/generate-from-spec.js --new <name>  - Create new spec template');
    process.exit(1);
  }

  if (args[0] === '--new') {
    if (!args[1]) {
      console.error('Error: Table name required');
      process.exit(1);
    }
    const tableName = args[1].toLowerCase();
    const specPath = path.join(SPECS_DIR, `${tableName}.yaml`);

    if (fs.existsSync(specPath)) {
      console.error(`Error: Spec already exists: ${specPath}`);
      process.exit(1);
    }

    const template = generateSpecTemplate(tableName);
    fs.writeFileSync(specPath, template);
    console.log(`Created spec template: ${specPath}`);
    console.log('\nNext steps:');
    console.log(`1. Edit ${specPath} with your table details`);
    console.log(`2. Run: node scripts/generate-from-spec.js ${tableName}`);
    return;
  }

  let specs;

  if (args[0] === '--all') {
    specs = loadAllSpecs();
    console.log(`Processing ${specs.length} spec file(s)...`);
  } else {
    const tableName = args[0].toLowerCase();
    specs = [{ tableName, spec: loadSpec(tableName) }];
  }

  let allNewEntries = {};

  for (const { tableName, spec } of specs) {
    console.log(`\nProcessing: ${tableName}`);

    // Generate SQL Registry entries
    const entries = generateSqlRegistryEntries(spec);
    Object.assign(allNewEntries, entries);

    console.log(`  Generated ${Object.keys(entries).length} SQL entries`);
  }

  // Update SQL Registry
  const addedKeys = updateSqlRegistry(allNewEntries);
  console.log(`\nUpdated SQL Registry: ${SQL_REGISTRY_PATH}`);
  addedKeys.forEach(key => console.log(`  + ${key}`));

  // Update Flow LookupService
  updateFlowLookupService(allNewEntries);
  console.log(`\nUpdated Flow LookupService: ${FLOW_PATH}`);

  console.log('\nGeneration complete!');
  console.log('\nRun tests to verify:');
  console.log('  npm test');
}

main();
