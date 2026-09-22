import path from 'node:path';
import ts from '../portal/node_modules/typescript/lib/typescript.js';
export function typecheckGate(root,configs=['tsconfig.json','tsconfig.gallery.json']){
 for(const name of configs){
  const file=path.join(root,name),read=ts.readConfigFile(file,ts.sys.readFile);
  if(read.error)throw Error('Typecheck gate failed:\n'+ts.flattenDiagnosticMessageText(read.error.messageText,'\n'));
  const config=ts.parseJsonConfigFileContent(read.config,ts.sys,root,undefined,file);
  const program=ts.createProgram(config.fileNames,{...config.options,noEmit:true});
  const errors=[...config.errors,...ts.getPreEmitDiagnostics(program)].filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw Error('Typecheck gate failed:\n'+ts.formatDiagnostics(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
 }
}
