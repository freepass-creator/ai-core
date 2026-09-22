#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

const LEVEL_POINTS={ABSENT:0,PARTIAL:1,VERIFIED:2};

export function validateReadiness(readiness, hubRegistry) {
  const errors=[];
  const axes=readiness?.scoring?.axes ?? [];
  const official=hubRegistry?.hubs?.map((h)=>h.id) ?? [];
  const hubs=readiness?.hubs ?? [];

  if(readiness?.contract!=='devcenter-hub-readiness/v1') errors.push('READINESS_CONTRACT_INVALID');
  if(readiness?.target_percent!==90) errors.push('READINESS_TARGET_MUST_BE_90');
  if(axes.length!==8 || new Set(axes).size!==8) errors.push('READINESS_AXES_MUST_BE_8_UNIQUE');
  if(hubs.length!==7) errors.push('READINESS_HUB_COUNT_MUST_BE_7');

  const ids=hubs.map((h)=>h.id);
  if(new Set(ids).size!==ids.length) errors.push('READINESS_DUPLICATE_HUB');
  for(const id of official) if(!ids.includes(id)) errors.push(`READINESS_MISSING_HUB:${id}`);
  for(const hub of hubs){
    if(!official.includes(hub.id)) errors.push(`READINESS_UNKNOWN_HUB:${hub.id}`);
    for(const axis of axes){
      const item=hub.axes?.[axis];
      if(!item) { errors.push(`READINESS_AXIS_MISSING:${hub.id}:${axis}`); continue; }
      if(!(item.level in LEVEL_POINTS)) errors.push(`READINESS_LEVEL_INVALID:${hub.id}:${axis}`);
      if(item.level!=='ABSENT' && (!Array.isArray(item.evidence)||!item.evidence.length)) errors.push(`READINESS_EVIDENCE_REQUIRED:${hub.id}:${axis}`);
      if(item.level!=='VERIFIED' && !item.gap) errors.push(`READINESS_GAP_REQUIRED:${hub.id}:${axis}`);
    }
  }
  return errors;
}

export function scoreHub(hub, readiness) {
  const axes=readiness.scoring.axes;
  const critical=new Set(readiness.scoring.critical_axes);
  const max=axes.length*2;
  const points=axes.reduce((sum,axis)=>sum+(LEVEL_POINTS[hub.axes[axis].level]??0),0);
  const percent=Math.round((points/max)*10000)/100;
  const criticalVerified=[...critical].every((axis)=>hub.axes[axis].level==='VERIFIED');
  const status=percent>=readiness.target_percent && criticalVerified
    ? 'READY'
    : percent>=40 ? 'PARTIAL' : 'HOLD';
  const gaps=axes
    .filter((axis)=>hub.axes[axis].level!=='VERIFIED')
    .map((axis)=>({axis,level:hub.axes[axis].level,gap:hub.axes[axis].gap}));
  return {id:hub.id,status,percent,points,max,critical_verified:criticalVerified,gaps};
}

export function reportReadiness(readiness,hubRegistry){
  const errors=validateReadiness(readiness,hubRegistry);
  if(errors.length) return {status:'FAIL',errors};
  const hubs=readiness.hubs.map((hub)=>scoreHub(hub,readiness)).sort((a,b)=>b.percent-a.percent||a.id.localeCompare(b.id));
  return {
    status:'PASS',
    target_percent:readiness.target_percent,
    assessed_against:readiness.assessed_against,
    hubs,
    summary:{
      ready:hubs.filter((h)=>h.status==='READY').length,
      partial:hubs.filter((h)=>h.status==='PARTIAL').length,
      hold:hubs.filter((h)=>h.status==='HOLD').length
    },
    disclaimer:readiness.scoring.meaning
  };
}

export function loadReadiness(baseDir=HERE){
  return {
    readiness:JSON.parse(fs.readFileSync(path.join(baseDir,'hubs','readiness.json'),'utf8')),
    hubRegistry:JSON.parse(fs.readFileSync(path.resolve(baseDir,'..','registry','hubs.json'),'utf8'))
  };
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  try{
    const {readiness,hubRegistry}=loadReadiness();
    const report=reportReadiness(readiness,hubRegistry);
    console.log(JSON.stringify(report,null,2));
    process.exitCode=report.status==='PASS'?0:1;
  }catch(error){
    console.error(JSON.stringify({status:'FAIL',error:error.message},null,2));
    process.exitCode=1;
  }
}
