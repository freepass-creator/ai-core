'use client';
import { useEffect, useState } from 'react';
import { Button } from './primitives';

export default function SessionTour({go}:{go:(page:string)=>void}) {
 const [text,setText]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0),[copyState,setCopyState]=useState('');
 useEffect(()=>{let alive=true;setError('');fetch('/session-tour.md').then(r=>{if(!r.ok)throw Error('견학 안내를 불러오지 못했습니다.');return r.text()}).then(t=>{if(!t.trim())throw Error('견학 안내가 비어 있습니다.');if(alive)setText(t)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[retry]);
 async function copy(){try{const request=text.split('## 다른 세션에 전달할 요청')[1]?.trim();if(!request)throw Error();await navigator.clipboard.writeText(request);setCopyState('요청문 복사됨')}catch{setCopyState('복사하지 못했습니다. 아래 요청문을 직접 선택해 주세요.')}}
 return <section aria-label="개발센터 견학">
  <div className="mini-card"><h2>이번 작업에 가져갈 것을 찾으세요</h2><p>정본의 위치, 재사용할 부품, 새로 만들 이유, 확인할 증거를 남깁니다.</p><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{[['catalog','1. 정본 찾기'],['lab','2. 원자 써보기'],['styles','3. CSS 확인'],['functions','4. 기능 찾기'],['conflicts','5. 반례 확인']].map(([id,label])=><Button key={id} variant="outline" onClick={()=>go(id)}>{label}</Button>)}</div></div>
  {error?<div className="error-box" role="alert">{error}<Button onClick={()=>setRetry(x=>x+1)}>다시 불러오기</Button></div>:!text?<p role="status">견학 안내를 불러오는 중입니다.</p>:<>
   <div className="code-toolbar"><a href="/session-tour.md" target="_blank" rel="noreferrer">견학 안내 원문</a><Button onClick={copy}>다른 세션용 요청 복사</Button></div><p role="status">{copyState}</p>
   {text.split(/^## /m).map((section,i)=>{const [heading,...body]=section.split('\n');return <article className="mini-card" key={i} style={{marginBottom:16}}><h2>{heading.replace(/^# /,'')}</h2>{body.join('\n').trim().split(/\n\s*\n/).map((p,j)=><p key={j} style={{overflowWrap:'anywhere',lineHeight:1.8}}>{p}</p>)}</article>})}
  </>}
 </section>;
}
