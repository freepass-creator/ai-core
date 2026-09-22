#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function normalizeRequest(input = '') {
  return String(input).trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validateHubRegistry(registry) {
  const errors = [];
  if (registry?.contract !== 'devcenter-hub-registry/v1') errors.push('HUB_REGISTRY_CONTRACT_INVALID');
  const hubs = Array.isArray(registry?.hubs) ? registry.hubs : [];
  const ids = hubs.map((hub) => hub.id);
  if (ids.length !== 7) errors.push('HUB_REGISTRY_COUNT_MUST_BE_7');
  if (new Set(ids).size !== ids.length) errors.push('HUB_REGISTRY_DUPLICATE_ID');
  const expected = ['design','data','document','engineering','integration','quality','delivery'];
  for (const id of expected) if (!ids.includes(id)) errors.push(`HUB_REGISTRY_MISSING:${id}`);
  if (registry?.control_plane?.is_hub !== false) errors.push('CONTROL_PLANE_MUST_NOT_BE_HUB');
  return errors;
}

export function validateRoutingRules(rules, registry) {
  const errors = [];
  const ids = new Set((registry?.hubs ?? []).map((hub) => hub.id));
  ids.add('control-plane');

  if (rules?.contract !== 'devcenter-hub-routing-rules/v1') errors.push('HUB_ROUTING_CONTRACT_INVALID');
  if (!Array.isArray(rules?.rules) || !rules.rules.length) errors.push('HUB_ROUTING_RULES_EMPTY');

  const ruleIds = new Set();
  for (const rule of rules?.rules ?? []) {
    if (!rule?.id || ruleIds.has(rule.id)) errors.push(`HUB_ROUTING_RULE_ID_INVALID:${rule?.id ?? '(missing)'}`);
    ruleIds.add(rule?.id);
    if (!ids.has(rule?.primary)) errors.push(`HUB_ROUTING_UNKNOWN_PRIMARY:${rule?.id}:${rule?.primary}`);
    for (const secondary of rule?.secondary ?? []) {
      if (!ids.has(secondary) || secondary === 'control-plane') errors.push(`HUB_ROUTING_UNKNOWN_SECONDARY:${rule?.id}:${secondary}`);
    }
    if (!Array.isArray(rule?.match_any) || !rule.match_any.length) errors.push(`HUB_ROUTING_MATCH_EMPTY:${rule?.id}`);
    if (!Number.isFinite(rule?.priority)) errors.push(`HUB_ROUTING_PRIORITY_INVALID:${rule?.id}`);
  }
  return errors;
}

function matchScore(text, rule) {
  let matches = [];
  for (const raw of rule.match_any ?? []) {
    const token = normalizeRequest(raw);
    if (token && text.includes(token)) matches.push(token);
  }
  if (!matches.length) return null;
  const longest = Math.max(...matches.map((x) => x.length));
  return {
    rule_id: rule.id,
    primary: rule.primary,
    secondary: rule.secondary ?? [],
    priority: rule.priority ?? 0,
    matched: matches,
    score: (rule.priority ?? 0) * 1000 + longest * 10 + matches.length
  };
}

export function routeHubRequest(input, { registry, routingRules } = {}) {
  const text = normalizeRequest(input);
  if (!text) return { status:'HOLD', reason:'EMPTY_REQUEST', request:text, candidates:[] };

  const registryErrors = validateHubRegistry(registry);
  const ruleErrors = validateRoutingRules(routingRules, registry);
  if (registryErrors.length || ruleErrors.length) {
    return { status:'HOLD', reason:'ROUTING_CONFIGURATION_INVALID', request:text, errors:[...registryErrors,...ruleErrors], candidates:[] };
  }

  const candidates = routingRules.rules
    .map((rule) => matchScore(text, rule))
    .filter(Boolean)
    .sort((a,b) => b.score - a.score || a.rule_id.localeCompare(b.rule_id));

  if (!candidates.length) return { status:'HOLD', reason:'NO_ROUTE_MATCH', request:text, candidates:[] };

  const top = candidates[0];
  const tied = candidates.filter((c) => c.score === top.score && c.primary !== top.primary);
  if (tied.length) {
    return { status:'HOLD', reason:'AMBIGUOUS_ROUTE', request:text, candidates:[top,...tied] };
  }

  return {
    status:'ROUTED',
    request:text,
    primary:top.primary,
    secondary:[...new Set(top.secondary)],
    rule_id:top.rule_id,
    matched:top.matched,
    candidates:candidates.slice(0,5)
  };
}

export function loadHubRouting(baseDir = HERE) {
  const rootRegistry = path.resolve(baseDir, '..', 'registry');
  const registry = JSON.parse(fs.readFileSync(path.join(rootRegistry,'hubs.json'),'utf8'));
  const routingRules = JSON.parse(fs.readFileSync(path.join(rootRegistry,'hub-routing-rules.json'),'utf8'));
  return { registry, routingRules };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const request = process.argv.slice(2).join(' ');
  const config = loadHubRouting();
  const result = routeHubRequest(request, config);
  console.log(JSON.stringify(result,null,2));
  process.exitCode = result.status === 'ROUTED' ? 0 : 2;
}
