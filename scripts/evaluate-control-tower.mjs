import { readFile, readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schema = JSON.parse(readFileSync(new URL('../contracts/control-tower.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const unique = (values) => new Set(values).size === values.length;
const result = (reasons) => ({ enabled: reasons.length === 0, reasons: [...new Set(reasons)] });

export function evaluateControlTower(snapshot) {
  if (!validate(snapshot)) {
    return {
      status: 'INVALID', execution_authorized: false,
      errors: validate.errors.map((error) => ({ code: `SCHEMA_${error.keyword.toUpperCase()}`, path: error.instancePath || '$' })),
      items: [],
    };
  }
  const errors = [];
  const asOf = Date.parse(snapshot.as_of);
  if (!unique(snapshot.items.map((item) => item.id))) errors.push({ code: 'ITEM_ID_DUPLICATE', path: 'items' });
  if (!unique(snapshot.capacities.map((item) => item.resource))) errors.push({ code: 'CAPACITY_RESOURCE_DUPLICATE', path: 'capacities' });

  const capacityByResource = new Map(snapshot.capacities.map((item) => [item.resource, item]));
  const allocationBlockers = new Map(snapshot.items.map((item) => [item.id, []]));
  const allocations = snapshot.items.flatMap((item) => item.allocations.map((allocation) => ({ ...allocation, itemId: item.id })));
  for (const allocation of allocations) {
    const capacity = capacityByResource.get(allocation.resource);
    if (!capacity || capacity.unit !== allocation.unit) allocationBlockers.get(allocation.itemId).push('CAPACITY_UNRESOLVED');
    if (Date.parse(allocation.start) >= Date.parse(allocation.end)) allocationBlockers.get(allocation.itemId).push('ALLOCATION_WINDOW_INVALID');
  }
  for (const capacity of snapshot.capacities) {
    const related = allocations.filter((item) => item.resource === capacity.resource && item.unit === capacity.unit);
    const boundaries = related.flatMap((item) => [Date.parse(item.start), Date.parse(item.end) - 1]);
    for (const point of boundaries) {
      const active = related.filter((item) => Date.parse(item.start) <= point && point < Date.parse(item.end));
      if (active.reduce((sum, item) => sum + item.amount, 0) > capacity.amount) {
        for (const item of active) allocationBlockers.get(item.itemId).push('RESOURCE_OVERCOMMITTED');
      }
    }
  }

  const snapshotInvalid = errors.length > 0;
  const items = snapshot.items.map((item) => {
    const common = snapshotInvalid ? ['SNAPSHOT_INVALID'] : [];
    const warnings = [];
    if (item.intent.status !== 'CONFIRMED' || item.intent.provenance !== 'USER_CONFIRMED') common.push('CONTROLLING_INTENT_UNCONFIRMED');
    for (const source of item.sources) {
      const findings = [];
      if (Date.parse(source.observed_at) > asOf) findings.push('OBSERVATION_FROM_FUTURE');
      if (Date.parse(source.valid_until) <= asOf) findings.push('OBSERVATION_EXPIRED');
      if (source.status !== 'CURRENT') findings.push(`SOURCE_${source.status}`);
      const coded = findings.map((finding) => `${source.severity}_${finding}`);
      if (source.severity === 'ADVISORY') warnings.push(...coded);
      else common.push(...coded);
    }
    if (!item.commitment.accepted || item.commitment.status !== 'ACTIVE') common.push('COMMITMENT_NOT_ACTIVE');
    if (!item.commitment.owner || !item.commitment.due_at) common.push('COMMITMENT_CONTROL_INCOMPLETE');
    if (item.commitment.dependencies.some((dependency) => !['SATISFIED', 'NOT_APPLICABLE'].includes(dependency.status))) common.push('DEPENDENCY_UNRESOLVED');
    common.push(...allocationBlockers.get(item.id));

    const execute = [...common];
    const authorizationConsistent = item.authorization.required
      ? item.authorization.status !== 'NOT_REQUIRED'
      : item.authorization.status === 'NOT_REQUIRED';
    if (!authorizationConsistent) execute.push('AUTHORIZATION_STATE_INVALID');
    if (item.authorization.required && item.authorization.status !== 'GRANTED') execute.push('AUTHORIZATION_REQUIRED');
    const close = [...execute];
    if (item.verification !== 'PASS') close.push('VERIFICATION_REQUIRED');
    if (item.execution !== 'CONFIRMED') close.push('EXECUTION_NOT_CONFIRMED');
    if (item.outcome !== 'SUCCESS') close.push('OUTCOME_NOT_CONFIRMED');
    return {
      id: item.id,
      warnings: [...new Set(warnings)],
      actions: {
        prepare: result(common.filter((reason) => ['SNAPSHOT_INVALID', 'CONTROLLING_INTENT_UNCONFIRMED'].includes(reason))),
        execute: result(execute),
        close: result(close),
      },
    };
  });
  return {
    status: errors.length ? 'INVALID' : items.some((item) => !item.actions.execute.enabled) ? 'HOLD' : 'READY',
    execution_authorized: false, errors, items,
  };
}

if (process.argv[1]?.endsWith('evaluate-control-tower.mjs')) {
  if (!process.argv[2]) { console.error('Usage: node scripts/evaluate-control-tower.mjs <snapshot.json>'); process.exit(2); }
  const snapshot = JSON.parse(await new Promise((resolve, reject) => readFile(process.argv[2], 'utf8', (error, data) => error ? reject(error) : resolve(data))));
  const evaluation = evaluateControlTower(snapshot);
  console.log(JSON.stringify(evaluation, null, 2));
  if (evaluation.status === 'INVALID') process.exitCode = 1;
}
