import { 브리핑 } from '../integration/core-brief.mjs';
import { defineCapabilityAdapter } from './adapter-contract.mjs';

export function createDefaultBuiltins({ readWorkProjection = null } = {}) {
  const adapters = new Map();

  adapters.set('core.brief', defineCapabilityAdapter({
    id: 'core.brief',
    modes: ['READ_ONLY'],
    invoke: async ({ input }) => ({
      status: 'SUCCEEDED',
      summary: 'AI Core 브리핑을 구성했습니다.',
      data: 브리핑(input ?? {}),
      evidence: ['READ: existing core brief evaluators @src/integration/core-brief.mjs'],
      checks: [{ name: 'core.brief', status: 'PASS' }],
      external_effect: false,
    }),
  }));

  adapters.set('work.projection', defineCapabilityAdapter({
    id: 'work.projection',
    modes: ['READ_ONLY'],
    invoke: async ({ input }) => {
      if (typeof readWorkProjection !== 'function') {
        return {
          status: 'HOLD',
          summary: '운영 Work projection provider가 연결되지 않았습니다.',
          blockers: ['WORK_PROJECTION_PROVIDER_REQUIRED'],
          next_action: '운영 source provider를 주입한 뒤 다시 읽습니다.',
          evidence: [],
          checks: [{ name: 'work.projection.provider', status: 'FAIL' }],
          external_effect: false,
        };
      }
      const projection = await readWorkProjection(input.order_id);
      const hold = projection?.status === 'HOLD' || projection?.status === 'UNLINKED';
      return {
        status: hold ? 'HOLD' : 'SUCCEEDED',
        summary: hold ? '정본 Work projection이 HOLD입니다.' : '정본 Work projection을 읽었습니다.',
        data: projection,
        blockers: hold ? [projection?.reason ?? projection?.status ?? 'WORK_PROJECTION_HOLD'] : [],
        evidence: ['READ: order/work canonical projection @src/integration/order-work-sources.mjs'],
        checks: [{ name: 'work.projection', status: hold ? 'FAIL' : 'PASS' }],
        external_effect: false,
      };
    },
  }));

  return adapters;
}
