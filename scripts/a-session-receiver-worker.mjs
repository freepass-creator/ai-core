import { readFile, writeFile } from 'node:fs/promises';
import { syncReceiverInboxes } from './sync-a-session-receiver-inboxes.mjs';
import { reconcileRoutingReceipts } from './reconcile-a-session-routing.mjs';

const SHA40 = /^[0-9a-f]{40}$/;
const ROUTING_PATH = 'docs/research/a-session-routing-receipts.v1.json';
const EVIDENCE_PATH = 'docs/research/a-session-evidence-registry.v1.json';
const CONFIG_PATH = 'docs/research/a-session-receiver-workers.v1.json';
const INBOX_PATHS = {
  B:'docs/research/a-session-receiver-inbox-B.v1.json',
  C:'docs/research/a-session-receiver-inbox-C.v1.json',
  D:'docs/research/a-session-receiver-inbox-D.v1.json'
};

function clone(value){ return structuredClone(value); }

export function runReceiverIntake({ routing, inboxes, config, sessions=['B','C','D'], revision=null, observedAt=null }) {
  const nextRouting = clone(routing);
  const nextInboxes = Object.fromEntries(Object.entries(inboxes).map(([k,v])=>[k,clone(v)]));
  const sync = syncReceiverInboxes(nextRouting, nextInboxes, observedAt ?? nextRouting.observed_at);
  const selected = new Set(sessions);
  const workerBySession = new Map(config.workers.map((w)=>[w.session,w]));
  const acknowledged = [];

  for (const session of selected) {
    const worker = workerBySession.get(session);
    if (!worker || worker.enabled !== true) continue;
    if (worker.auto_review !== false || worker.auto_decide !== false) {
      throw new Error(`receiver worker ${session} must not auto-review or auto-decide`);
    }
    if (worker.inbox_path !== INBOX_PATHS[session]) {
      throw new Error(`receiver worker ${session} inbox path mismatch`);
    }
    if (!worker.auto_ack) continue;
    if (!SHA40.test(revision ?? '')) throw new Error('exact 40-hex --revision is required for auto acknowledgement');
    if (typeof observedAt !== 'string' || Number.isNaN(Date.parse(observedAt))) throw new Error('valid --at timestamp is required for auto acknowledgement');

    const inbox = nextInboxes[session];
    for (const item of inbox.items) {
      if (item.receiver_status !== 'PENDING') continue;
      item.receiver_status = 'ACKNOWLEDGED';
      item.acknowledgement = {
        session,
        ai_core_revision: revision,
        observed_at: observedAt,
        evidence_refs: [
          `${EVIDENCE_PATH}#${item.finding_id}`,
          `${ROUTING_PATH}#${item.route_id}`,
          CONFIG_PATH
        ]
      };
      item.review = null;
      item.decision = null;
      item.history.push({
        status:'ACKNOWLEDGED',
        observed_at:observedAt,
        basis_revision:revision,
        reason:'Receiver intake worker mechanically acknowledged delivery; no review or canonical decision is implied.'
      });
      inbox.observed_at = observedAt;
      acknowledged.push(item.route_id);
    }
  }

  const reconciled = reconcileRoutingReceipts(nextRouting, Object.values(nextInboxes));
  return {
    routing:reconciled.routing,
    inboxes:nextInboxes,
    synced:sync.changed,
    acknowledged,
    reconciled:reconciled.changed
  };
}

function arg(name){
  const i=process.argv.indexOf(name);
  return i>=0 ? process.argv[i+1] : null;
}

if (process.argv[1]?.endsWith('a-session-receiver-worker.mjs')) {
  const write=process.argv.includes('--write');
  const check=process.argv.includes('--check');
  const all=process.argv.includes('--all');
  const session=arg('--session');
  const sessions=all ? ['B','C','D'] : session ? [session] : ['B','C','D'];
  if (sessions.some((s)=>!['B','C','D'].includes(s))) {
    console.error('session must be B, C or D');
    process.exit(2);
  }
  const revision=arg('--revision');
  const observedAt=arg('--at');
  const routing=JSON.parse(await readFile(ROUTING_PATH,'utf8'));
  const config=JSON.parse(await readFile(CONFIG_PATH,'utf8'));
  const inboxes={};
  for(const s of ['B','C','D']) inboxes[s]=JSON.parse(await readFile(INBOX_PATHS[s],'utf8'));

  let effectiveRevision=revision;
  let effectiveAt=observedAt;
  if (check) {
    effectiveRevision = effectiveRevision ?? '0'.repeat(40);
    effectiveAt = effectiveAt ?? '2000-01-01T00:00:00Z';
  }

  const result=runReceiverIntake({routing,inboxes,config,sessions,revision:effectiveRevision,observedAt:effectiveAt});
  const changes=[...result.synced,...result.acknowledged,...result.reconciled];
  if(write){
    if(!revision||!observedAt){
      console.error('--write requires --revision <sha> and --at <ISO timestamp>');
      process.exit(2);
    }
    await writeFile(ROUTING_PATH,JSON.stringify(result.routing,null,2)+'\n');
    for(const s of ['B','C','D']) await writeFile(INBOX_PATHS[s],JSON.stringify(result.inboxes[s],null,2)+'\n');
  }
  console.log(JSON.stringify({
    sessions,
    synced:result.synced,
    acknowledged:result.acknowledged,
    reconciled:result.reconciled,
    wrote:write
  },null,2));
  if(check && changes.length) process.exitCode=1;
}
