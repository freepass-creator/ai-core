import test from 'node:test';
import assert from 'node:assert/strict';
import {captureWithChromium} from '../scripts/browser-capture.mjs';

test('capture runner fails closed when browser path is unavailable',()=>{
  const plan={
    contract:'devcenter-design-visual-plan/v1',
    result:{status:'PLANNED'},
    captures:[]
  };
  assert.throws(()=>captureWithChromium(plan,{outputDir:'.',browserPath:null}),/BROWSER_CAPTURE_CHROMIUM_NOT_FOUND/);
});

test('capture runner rejects non-http visual plan URLs before execution',()=>{
  const plan={
    contract:'devcenter-design-visual-plan/v1',
    result:{status:'PLANNED'},
    captures:[{
      case_id:'bad@390',
      url:'file:///tmp/x.html',
      locale:'ko-KR',
      viewport:{width:390,height:844},
      settle_ms:1,
      screenshot_ref:'visual/bad.png'
    }]
  };
  assert.throws(()=>captureWithChromium(plan,{outputDir:'.',browserPath:'/definitely/missing/browser'}),/ENOENT|BROWSER_CAPTURE_HTTP_ONLY|BROWSER_CAPTURE/);
});
