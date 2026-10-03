"""Parse Python syntax only; never import inspected modules or expose literals."""
import ast, hashlib, json, sys
sys.stdin.reconfigure(encoding='utf-8')
files=json.load(sys.stdin)
functions=[]
modules=[]
for item in files:
    row={'id':item['id'],'functions':0,'callableNodes':0,'parseErrors':[]}
    try:
        raw=open(item['file'],'rb').read()
        row['sha256']=hashlib.sha256(raw).hexdigest()
        tree=ast.parse(raw,filename=item['path'])
        for node in ast.walk(tree):
            if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef,ast.Lambda)): row['callableNodes']+=1
            if not isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)): continue
            args=node.args
            parameters=[{'name':p.arg,'type':'미명시' if p.annotation is None else type(p.annotation).__name__,'optional':i>=len(args.posonlyargs+args.args)-len(args.defaults),'rest':False} for i,p in enumerate(args.posonlyargs+args.args)]
            parameters.extend({'name':p.arg,'type':'미명시' if p.annotation is None else type(p.annotation).__name__,'optional':default is not None,'rest':False} for p,default in zip(args.kwonlyargs,args.kw_defaults))
            parameters.extend({'name':p.arg,'type':'미명시','optional':True,'rest':True} for p in [args.vararg,args.kwarg] if p)
            key=f"{item['path']}:{node.lineno}:{node.col_offset}"
            functions.append({'id':hashlib.sha256(key.encode()).hexdigest()[:16],'moduleId':item['id'],'project':item['project'],'name':node.name,'line':node.lineno,'endLine':node.end_lineno,'kind':'python-function','parameters':parameters,'output':'미명시' if node.returns is None else type(node.returns).__name__,'async':isinstance(node,ast.AsyncFunctionDef),'runtimeVerified':False})
            row['functions']+=1
    except SyntaxError as e:
        row['parseErrors']=[{'line':e.lineno or 1,'code':'python_syntax'}]
    except Exception:
        row['parseErrors']=[{'line':1,'code':'python_read_or_encoding'}]
    modules.append(row)
json.dump({'functions':functions,'modules':modules},sys.stdout,ensure_ascii=True)
