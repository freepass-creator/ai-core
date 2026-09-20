import { buildAdapterReceipt } from '../contracts/adapter-receipt.mjs';
import { resolveBinding, validateAdapterContract } from '../contracts/engine-adapter-contract.mjs';
import { createAdapterInvocationRuntime } from './adapter-invocation-runtime.mjs';

const need=(condition,code,details={})=>{if(!condition){const e=new Error(code);e.code=code;e.details=details;throw e;}};

export function createPortRuntime({
  engine,
  adapters=[],
  profile,
  implementations,
  connectors=null,
  clock=Date.now,
  requireVerifiedBinding=true,
}={}){
  const binding=resolveBinding({engine,adapters,profile,requireVerified:requireVerifiedBinding});
  const invocation=createAdapterInvocationRuntime({
    selectedAdapters:binding.selected_adapters,
    adapters,
    profile,
    implementations,
    connectors,
    validateAdapter:validateAdapterContract,
    clock,
  });

  function describe(){
    return {
      status:binding.status,
      authorization:'NOT_GRANTED',
      engine_id:engine?.engine_id??null,
      engine_version:engine?.version??null,
      project_id:profile?.project_id??null,
      environment:profile?.environment??null,
      subject_revision:profile?.subject_revision??null,
      verification_state:profile?.verification_state??null,
      selected_adapters:binding.selected_adapters.map(x=>({...x})),
      errors:[...binding.errors],
    };
  }

  async function invoke(portId,input,options={}){
    need(binding.status==='RESOLVED','PORT_RUNTIME_BINDING_HOLD',{errors:binding.errors});
    return invocation.invoke(portId,input,options);
  }

  async function invokeWithReceipt(portId,input,options={}){
    const {receipt:receiptOptions,...invokeOptions}=options;
    need(receiptOptions&&typeof receiptOptions==='object','RECEIPT_OPTIONS_REQUIRED');
    const adapter_result=await invoke(portId,input,invokeOptions);
    const receipt=buildAdapterReceipt({
      ...receiptOptions,
      adapter_result,
      input
    });
    return {adapter_result,receipt};
  }

  return Object.freeze({
    binding:Object.freeze(describe()),
    describe,
    invoke,
    invokeWithReceipt
  });
}
