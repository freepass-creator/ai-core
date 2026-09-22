#!/usr/bin/env node
import { loadHubRouting, validateHubRegistry, validateRoutingRules } from './hub-router.mjs';

try {
  const { registry, routingRules } = loadHubRouting();
  const errors = [
    ...validateHubRegistry(registry),
    ...validateRoutingRules(routingRules, registry)
  ];
  if (errors.length) {
    console.error(JSON.stringify({status:'FAIL',errors},null,2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      status:'PASS',
      hub_count:registry.hubs.length,
      hub_ids:registry.hubs.map((hub)=>hub.id),
      routing_rule_count:routingRules.rules.length,
      control_plane_is_hub:registry.control_plane.is_hub
    },null,2));
  }
} catch (error) {
  console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
  process.exitCode = 1;
}
