import { assertAllowedGoogleApiUrl } from './api-url-boundary.mjs';

const READ_METHODS=new Set(['GET','HEAD','OPTIONS']);
const RETRYABLE_STATUS=new Set([429,500,503]);
const MAX_RETRIES=6;
const defaultSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function fail(code,message){
  const error=new Error(message);
  error.code=code;
  throw error;
}

export function createGoogleReadTransport({
  accessToken,
  fetchImpl=globalThis.fetch,
  sleep=defaultSleep,
  maxRetries=MAX_RETRIES,
  retryWaitMs=20_000
}={}){
  if(typeof accessToken!=='string'||!accessToken.trim()) fail('GOOGLE_ACCESS_TOKEN_REQUIRED','Google bearer token is required');
  if(typeof fetchImpl!=='function') fail('GOOGLE_FETCH_REQUIRED','fetch implementation is required');
  if(typeof sleep!=='function') fail('GOOGLE_SLEEP_REQUIRED','sleep implementation is required');
  if(!Number.isInteger(maxRetries)||maxRetries<0||maxRetries>MAX_RETRIES){
    fail('GOOGLE_READ_RETRY_BUDGET_INVALID',`maxRetries must be an integer between 0 and ${MAX_RETRIES}`);
  }

  async function call(url,opts={},tries=0){
    let parsed;
    try{parsed=assertAllowedGoogleApiUrl(url);}
    catch(error){
      if(!error.code) error.code='GOOGLE_API_URL_NOT_ALLOWED';
      throw error;
    }

    const method=String(opts.method||'GET').toUpperCase();
    if(!READ_METHODS.has(method)) fail('GOOGLE_READ_METHOD_REQUIRED',`Google read transport rejects method: ${method}`);

    const response=await fetchImpl(parsed.href,{
      ...opts,
      method,
      headers:{
        ...(opts.headers||{}),
        'content-type':'application/json',
        Authorization:`Bearer ${accessToken}`
      }
    });

    const text=await response.text();
    let body;
    try{body=JSON.parse(text);}catch{body=text;}

    if(RETRYABLE_STATUS.has(response.status)&&tries<maxRetries){
      await sleep(retryWaitMs);
      return call(parsed.href,opts,tries+1);
    }
    if(!response.ok){
      const error=new Error(`${response.status} ${JSON.stringify(body).slice(0,500)}`);
      error.code='GOOGLE_API_HTTP_ERROR';
      error.status=response.status;
      throw error;
    }
    return body;
  }

  return Object.freeze({call});
}
