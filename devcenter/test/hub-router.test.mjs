import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHubRouting, routeHubRequest, validateHubRegistry, validateRoutingRules } from '../scripts/hub-router.mjs';

const config = loadHubRouting();

test('registry contains exactly seven official hubs and control plane is not a hub', () => {
  assert.deepEqual(validateHubRegistry(config.registry), []);
  assert.equal(config.registry.hubs.length, 7);
  assert.equal(config.registry.control_plane.is_hub, false);
});

test('routing rules only reference registered hubs', () => {
  assert.deepEqual(validateRoutingRules(config.routingRules, config.registry), []);
});

test('design unification routes to Design Hub with Quality secondary', () => {
  const result = routeHubRequest('프리패스 전체 디자인 통일시켜', config);
  assert.equal(result.status, 'ROUTED');
  assert.equal(result.primary, 'design');
  assert.deepEqual(result.secondary, ['quality']);
});

test('firebase integration routes to Integration Hub', () => {
  const result = routeHubRequest('Firebase 연동 구조 정리해', config);
  assert.equal(result.status, 'ROUTED');
  assert.equal(result.primary, 'integration');
  assert.ok(result.secondary.includes('engineering'));
  assert.ok(result.secondary.includes('quality'));
});

test('document request routes to Document Hub', () => {
  const result = routeHubRequest('계약서와 약관 양식 통일', config);
  assert.equal(result.status, 'ROUTED');
  assert.equal(result.primary, 'document');
});

test('deploy request routes to Delivery Hub', () => {
  const result = routeHubRequest('배포하고 롤백 준비해', config);
  assert.equal(result.status, 'ROUTED');
  assert.equal(result.primary, 'delivery');
  assert.deepEqual(result.secondary, ['quality']);
});

test('unknown request fails closed instead of guessing', () => {
  const result = routeHubRequest('이거 다음 거 해줘', config);
  assert.equal(result.status, 'HOLD');
  assert.equal(result.reason, 'NO_ROUTE_MATCH');
});

test('invalid registry fails closed', () => {
  const broken = structuredClone(config);
  broken.registry.hubs = broken.registry.hubs.slice(0,6);
  const result = routeHubRequest('디자인 통일', broken);
  assert.equal(result.status, 'HOLD');
  assert.equal(result.reason, 'ROUTING_CONFIGURATION_INVALID');
});
