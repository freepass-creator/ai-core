import test from 'node:test';
import assert from 'node:assert/strict';
import { colL, num, serial2date, date2serial } from '../shared-services/google/sheets-utils.mjs';

test('Sheets column labels preserve AIOps zero-based behavior',()=>{
  assert.equal(colL(0),'A');
  assert.equal(colL(25),'Z');
  assert.equal(colL(26),'AA');
  assert.equal(colL(51),'AZ');
  assert.equal(colL(52),'BA');
});

test('Sheets numeric normalization preserves comma whitespace and won stripping',()=>{
  assert.equal(num('1,234 원'),1234);
  assert.equal(num(' 50,000원 '),50000);
  assert.equal(num(null),0);
  assert.equal(num('not-a-number'),0);
});

test('Sheets serial/date conversion preserves canonical spreadsheet epoch behavior',()=>{
  assert.equal(serial2date(25569),'1970-01-01');
  assert.equal(date2serial(1970,1,1),25569);
  const serial=date2serial(2026,9,23);
  assert.equal(serial2date(serial),'2026-09-23');
});
