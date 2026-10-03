'use client';
import {useEffect,useRef,useState} from 'react';
import {Button,Input} from './primitives';
type Index={modules:[string,string][];entries:[string,number,number][]};
export function validateSearchIndex(value:unknown):Index{
 const invalid=()=>{throw Error('전체 기능 색인의 형식이 잘못되었습니다. 다시 검색해 주세요.');};
 if(!value||typeof value!=='object')return invalid();const d=value as Index;
 if(!Array.isArray(d.modules)||!Array.isArray(d.entries))return invalid();
 if(!d.modules.every(m=>Array.isArray(m)&&m.length===2&&m.every(v=>typeof v==='string'&&v.length>0)))return invalid();
 if(!d.entries.every(e=>Array.isArray(e)&&e.length===3&&typeof e[0]==='string'&&e[0].length>0&&Number.isInteger(e[1])&&e[1]>=0&&e[1]<d.modules.length&&Number.isSafeInteger(e[2])&&e[2]>0))return invalid();
 return d;
}
export default function FunctionSearch({select}:{select:(project:string,name:string)=>void}){
 const [query,setQuery]=useState(''),[index,setIndex]=useState<Index|null>(null),[results,setResults]=useState<Index['entries']>([]),[searched,setSearched]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),request=useRef<AbortController|null>(null);
 useEffect(()=>()=>{generation.current++;request.current?.abort()},[]);
 function change(value:string){generation.current++;request.current?.abort();setQuery(value);setLoading(false);setSearched(false);setResults([]);setError('')}
 async function search(){request.current?.abort();const run=++generation.current;setSearched(false);setResults([]);setError('');if(query.trim().length<2){setLoading(false);setError('두 글자 이상 입력하세요.');return}const controller=new AbortController();request.current=controller;setLoading(true);
  try{let d=index;if(!d){const r=await fetch('/catalog/function-search.json',{signal:controller.signal});if(!r.ok)throw Error('전체 기능 색인을 불러오지 못했습니다. 다시 검색해 주세요.');d=validateSearchIndex(await r.json());if(run!==generation.current)return;setIndex(d)}const q=query.trim().toLowerCase();if(run!==generation.current)return;setResults(d.entries.filter(([name,m])=>`${name} ${d!.modules[m][0]}`.toLowerCase().includes(q)));setSearched(true)}catch(e){if(run===generation.current)setError(e instanceof SyntaxError?'전체 기능 색인의 JSON을 읽지 못했습니다. 다시 검색해 주세요.':e instanceof Error?e.message:'검색 실패')}finally{if(run===generation.current)setLoading(false)}
 }
 return <section className="mini-card learning-panel" style={{margin:'16px 0'}}><h3>어느 프로젝트에 있는지 몰라도 찾기</h3><form className="search-row" onSubmit={e=>{e.preventDefault();if(!loading)void search()}}><Input aria-label="전체 프로젝트 기능 검색" placeholder="함수 이름 또는 경로 · 두 글자 이상" value={query} onChange={e=>change(e.target.value)}/><Button type="submit" disabled={loading}>{loading?'검색 중':'전체 기능 검색'}</Button></form>{error&&<p role="alert">{error}</p>}{searched&&!loading&&<><p role="status">전체 프로젝트 검색 결과 {results.length.toLocaleString()}건 · 처음 30건 표시 · 검색어 {query.trim()}</p>{results.slice(0,30).map(([name,m,line],i)=><button className="doc-row" key={`${m}:${line}:${i}`} onClick={()=>{select(index!.modules[m][1],name);setSearched(false)}}><span><strong>{name}</strong><code>{index!.modules[m][0]}:{line}</code></span></button>)}</>}</section>
}
