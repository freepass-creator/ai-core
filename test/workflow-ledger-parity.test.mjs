import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';
import { createWorkLedgerShadow } from '../src/workflow/work-ledger-shadow.mjs';
import { lifecycleGraph } from '../src/workflow/registry.mjs';

const registry = JSON.parse(readFileSync(new URL('../registry/workflows.json', import.meta.url), 'utf8'));
const workflow = registry.workflows.find(item => item.workflow_id === 'ai-core.work-lifecycle');
const shadow = createWorkLedgerShadow(workflow);

const REV_A = 'a'.repeat(40);
const REV_B = 'b'.repeat(40);
const STATES = [
  'RECEIVED', 'PLANNED', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_AUTHORIZATION',
  'READY', 'EXECUTED', 'OBSERVING', 'CLOSED', 'BLOCKED', 'CANCELLED'
];

const PATHS = {
  RECEIVED: [],
  PLANNED: ['PLANNED'],
  IN_PROGRESS: ['PLANNED', 'IN_PROGRESS'],
  VERIFYING: ['PLANNED', 'IN_PROGRESS', 'VERIFYING'],
  AWAITING_AUTHORIZATION: ['PLANNED', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_AUTHORIZATION'],
  READY: ['PLANNED', 'IN_PROGRESS', 'VERIFYING', 'READY'],
  EXECUTED: ['PLANNED', 'IN_PROGRESS', 'VERIFYING', 'READY', 'EXECUTED'],
  OBSERVING: ['PLANNED', 'IN_PROGRESS', 'VERIFYING', 'READY', 'EXECUTED', 'OBSERVING'],
  CLOSED: ['PLANNED', 'IN_PROGRESS', 'VERIFYING', 'READY', 'EXECUTED', 'OBSERVING', 'CLOSED'],
  BLOCKED: ['BLOCKED'],
  CANCELLED: ['CANCELLED']
};

function rawType(from, to) {
  if (to === 'BLOCKED') return 'BLOCKED';
  if (to === 'CANCELLED') return 'CANCELLED';
  if (from === 'BLOCKED') return 'RESUMED';
  return 'TRANSITIONED';
}

async function openFixture(targetState, { verifiedBlocked = false, revision = REV_A } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-parity-'));
  const path = join(dir, 'ledger.jsonl');
  let head = null;
  let projection = null;
  let sequence = 0;

  const nextId = () => `PARITY-${String(++sequence).padStart(3, '0')}`;
  const makeEvent = ({
    type,
    from_state,
    to_state,
    subject_revision = revision,
    project_id = 'ai-core',
    evidence_refs = [],
  }) => ({
    event_id: nextId(),
    work_id: 'WORK-001',
    project_id,
    type,
    from_state,
    to_state,
    actor: 'workflow-parity-test',
    subject_revision,
    observed_at: '2026-09-19T12:00:00.000Z',
    evidence_refs,
  });

  async function append(event) {
    const ledger = await appendLedgerEvent(path, event, head);
    head = ledger.head;
    const shadowResult = shadow.apply(projection, event);
    assert.equal(shadowResult.status, 'ACCEPTED', JSON.stringify(shadowResult.inspection));
    projection = shadowResult.projection;
    return event;
  }

  await append(makeEvent({
    type: 'CREATED',
    from_state: null,
    to_state: 'RECEIVED',
  }));

  const steps = verifiedBlocked
    ? ['PLANNED', 'IN_PROGRESS', 'VERIFYING', 'READY', 'BLOCKED']
    : PATHS[targetState];

  for (const to of steps) {
    const from = projection.states.lifecycle;
    await append(makeEvent({
      type: rawType(from, to),
      from_state: from,
      to_state: to,
      evidence_refs: to === 'CLOSED' ? ['close-proof'] : [],
    }));
  }

  assert.equal(projection.states.lifecycle, targetState);

  return {
    dir,
    path,
    get head() { return head; },
    get projection() { return projection; },
    makeEvent,
    close: () => rm(dir, { recursive: true, force: true }),
  };
}

async function ledgerAccepts(fixture, event) {
  try {
    await appendLedgerEvent(fixture.path, event, fixture.head);
    return true;
  } catch {
    return false;
  }
}

test('SHADOW workflow matches every normal Work Ledger state-pair decision from canonical state contexts', async () => {
  for (const from of STATES) {
    for (const to of STATES) {
      const fixture = await openFixture(from);
      try {
        const event = fixture.makeEvent({
          type: rawType(from, to),
          from_state: from,
          to_state: to,
          evidence_refs: to === 'CLOSED' ? ['close-proof'] : [],
        });

        const [ledgerAllowed, shadowInspection] = await Promise.all([
          ledgerAccepts(fixture, event),
          Promise.resolve(shadow.inspect(fixture.projection, event)),
        ]);

        assert.equal(
          shadowInspection.eligible,
          ledgerAllowed,
          `${from} -> ${to}: shadow=${JSON.stringify(shadowInspection)}`,
        );
      } finally {
        await fixture.close();
      }
    }
  }
});

test('BLOCKED retains verification context exactly like the ledger when it was entered after verification', async () => {
  for (const to of STATES) {
    const fixture = await openFixture('BLOCKED', { verifiedBlocked: true });
    try {
      assert.equal(fixture.projection.verification_captured, true);
      assert.equal(fixture.projection.verified_revision, REV_A);

      const event = fixture.makeEvent({
        type: rawType('BLOCKED', to),
        from_state: 'BLOCKED',
        to_state: to,
        evidence_refs: to === 'CLOSED' ? ['close-proof'] : [],
      });

      const ledgerAllowed = await ledgerAccepts(fixture, event);
      const shadowInspection = shadow.inspect(fixture.projection, event);
      assert.equal(
        shadowInspection.eligible,
        ledgerAllowed,
        `verified BLOCKED -> ${to}: shadow=${JSON.stringify(shadowInspection)}`,
      );
    } finally {
      await fixture.close();
    }
  }
});

test('REOBSERVED parity covers allowed states, evidence, revision change and project identity', async () => {
  for (const state of ['RECEIVED', 'PLANNED', 'IN_PROGRESS', 'VERIFYING']) {
    const fixture = await openFixture(state);
    try {
      const event = fixture.makeEvent({
        type: 'REOBSERVED',
        from_state: state,
        to_state: state,
        subject_revision: REV_B,
        evidence_refs: ['revision-observed'],
      });
      const ledgerAllowed = await ledgerAccepts(fixture, event);
      const inspection = shadow.inspect(fixture.projection, event);
      assert.equal(inspection.eligible, ledgerAllowed, `REOBSERVED at ${state}`);

      if (ledgerAllowed) {
        const applied = shadow.apply(fixture.projection, event);
        assert.equal(applied.status, 'ACCEPTED');
        assert.equal(applied.projection.states.lifecycle, state);
        assert.equal(applied.projection.subject_revision, REV_B);
        assert.deepEqual(applied.projection.revisions, [REV_A, REV_B]);

        const verified = verifyLedgerText(await readFile(fixture.path, 'utf8'));
        assert.equal(verified.status, 'VALID');
        assert.equal(verified.work['WORK-001'].state, applied.projection.states.lifecycle);
        assert.equal(verified.work['WORK-001'].subject_revision, applied.projection.subject_revision);
        assert.deepEqual(verified.work['WORK-001'].revisions, applied.projection.revisions);
      }
    } finally {
      await fixture.close();
    }
  }

  const cases = [
    { name: 'same revision', patch: { subject_revision: REV_A, evidence_refs: ['revision-observed'] } },
    { name: 'missing evidence', patch: { subject_revision: REV_B, evidence_refs: [] } },
    { name: 'project changed', patch: { subject_revision: REV_B, evidence_refs: ['revision-observed'], project_id: 'other-project' } },
    { name: 'state changed', patch: { subject_revision: REV_B, evidence_refs: ['revision-observed'], to_state: 'PLANNED' } },
  ];

  for (const sample of cases) {
    const fixture = await openFixture('RECEIVED');
    try {
      const event = fixture.makeEvent({
        type: 'REOBSERVED',
        from_state: 'RECEIVED',
        to_state: 'RECEIVED',
        ...sample.patch,
      });
      const ledgerAllowed = await ledgerAccepts(fixture, event);
      const inspection = shadow.inspect(fixture.projection, event);
      assert.equal(ledgerAllowed, false, sample.name);
      assert.equal(inspection.eligible, false, sample.name);
    } finally {
      await fixture.close();
    }
  }
});

test('normal revision drift is rejected after verification and re-observation is the only revision-moving path', async () => {
  const fixture = await openFixture('READY');
  try {
    const drift = fixture.makeEvent({
      type: 'TRANSITIONED',
      from_state: 'READY',
      to_state: 'EXECUTED',
      subject_revision: REV_B,
    });
    assert.equal(await ledgerAccepts(fixture, drift), false);
    const inspection = shadow.inspect(fixture.projection, drift);
    assert.equal(inspection.eligible, false);
    assert.ok(inspection.reasons.includes('GUARD_FAILED:work.subject-revision-same'));
  } finally {
    await fixture.close();
  }
});

test('CLOSED requires a non-null subject revision and evidence exactly like the current ledger', async () => {
  const fixture = await openFixture('OBSERVING', { revision: null });
  try {
    assert.equal(fixture.projection.verification_captured, true);
    assert.equal(fixture.projection.verified_revision, null);

    const close = fixture.makeEvent({
      type: 'TRANSITIONED',
      from_state: 'OBSERVING',
      to_state: 'CLOSED',
      subject_revision: null,
      evidence_refs: ['close-proof'],
    });

    assert.equal(await ledgerAccepts(fixture, close), false);
    const inspection = shadow.inspect(fixture.projection, close);
    assert.equal(inspection.eligible, false);
    assert.ok(inspection.reasons.includes('GUARD_FAILED:work.subject-revision-present'));
  } finally {
    await fixture.close();
  }
});

test('unverified BLOCKED cannot jump into verified-path states in either implementation', async () => {
  const fixture = await openFixture('BLOCKED');
  try {
    assert.equal(fixture.projection.verification_captured, false);
    for (const to of ['AWAITING_AUTHORIZATION', 'READY', 'OBSERVING']) {
      const event = fixture.makeEvent({
        type: 'RESUMED',
        from_state: 'BLOCKED',
        to_state: to,
      });
      assert.equal(await ledgerAccepts(fixture, event), false, to);
      const inspection = shadow.inspect(fixture.projection, event);
      assert.equal(inspection.eligible, false, to);
      assert.ok(inspection.reasons.includes('GUARD_FAILED:work.verified-revision-present'), to);
    }
  } finally {
    await fixture.close();
  }
});


test('CANONICAL Work state graph remains pinned to the exact Work Ledger integration blobs', () => {
  assert.equal(workflow.adoption_status, 'CANONICAL');
  assert.ok(workflow.source_authority);
  for (const source of workflow.source_authority.files) {
    const actual = execFileSync('git', ['hash-object', source.path], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    }).trim();
    assert.equal(actual, source.blob_sha, source.path);
  }
});


test('registry-backed graph preserves the frozen legacy transition matrix', () => {
  const legacy = new Map([
    ['RECEIVED', ['PLANNED', 'BLOCKED', 'CANCELLED']],
    ['PLANNED', ['IN_PROGRESS', 'BLOCKED', 'CANCELLED']],
    ['IN_PROGRESS', ['VERIFYING', 'BLOCKED', 'CANCELLED']],
    ['VERIFYING', ['IN_PROGRESS', 'AWAITING_AUTHORIZATION', 'READY', 'BLOCKED']],
    ['AWAITING_AUTHORIZATION', ['READY', 'BLOCKED', 'CANCELLED']],
    ['READY', ['EXECUTED', 'BLOCKED', 'CANCELLED']],
    ['EXECUTED', ['OBSERVING', 'BLOCKED']],
    ['OBSERVING', ['CLOSED', 'BLOCKED']],
    ['CLOSED', []],
    ['BLOCKED', ['PLANNED', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_AUTHORIZATION', 'READY', 'OBSERVING', 'CANCELLED']],
    ['CANCELLED', []],
  ]);
  const graph = lifecycleGraph('ai-core.work-lifecycle');
  assert.deepEqual(
    Object.fromEntries([...graph.transitions.entries()].map(([key, value]) => [key, [...value]])),
    Object.fromEntries(legacy),
  );
  assert.deepEqual(graph.reobservable, ['RECEIVED', 'PLANNED', 'IN_PROGRESS']);
  assert.deepEqual(
    [...graph.verifiedPath].sort(),
    ['AWAITING_AUTHORIZATION', 'CLOSED', 'EXECUTED', 'OBSERVING', 'READY'].sort(),
  );
});
