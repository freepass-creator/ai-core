import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertAllowedGoogleApiUrl } from '../shared-services/google/api-url-boundary.mjs';

const provenance=JSON.parse(readFileSync(new URL('../shared-services/PROVENANCE.json',import.meta.url),'utf8'));
const entry=provenance.entries.find(item=>item.destination_path==='shared-services/google/api-url-boundary.mjs');

test('Google URL boundary provenance stays a non-authoritative function-slice shadow',()=>{
  assert.ok(entry);
  assert.equal(entry.source_path,'lib/goog.mjs');
  assert.equal(entry.source_symbol,'assertAllowedGoogleApiUrl');
  assert.equal(entry.source_blob_sha,'447deabfbfedf9e0eb26ab2dffbaed4f8ada0100');
  assert.equal(entry.disposition,'FUNCTION_SLICE_SHADOW');
  assert.equal(entry.source_runtime_authority,'AIOPS');
  assert.equal(entry.ai_core_runtime_authority,false);
  assert.equal(entry.consumer_cutover_authorized,false);
});

test('Google URL boundary permits only current Sheets and Drive API surfaces',()=>{
  const allowed=[
    'https://sheets.googleapis.com/v4/spreadsheets/abc/values/A1',
    'https://www.googleapis.com/drive/v3/files',
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  ];
  for(const url of allowed) assert.equal(assertAllowedGoogleApiUrl(url).href,new URL(url).href);

  const rejected=[
    'http://sheets.googleapis.com/v4/spreadsheets/abc/values/A1',
    'http://www.googleapis.com/drive/v3/files',
    'https://oauth2.googleapis.com/token',
    'https://firestore.googleapis.com/v1/projects/demo/databases/(default)/documents',
    'https://www.googleapis.com/calendar/v3/calendars',
    'https://evil.example/drive/v3/files',
    'https://sheets.googleapis.com/v3/spreadsheets'
  ];
  for(const url of rejected) assert.throws(()=>assertAllowedGoogleApiUrl(url),/허용되지 않은 Google API URL/);
});
