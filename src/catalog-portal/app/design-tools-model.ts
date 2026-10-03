export function contrast(foreground:string,background:string){
 function luminance(hex:string){if(!/^#[\da-f]{6}$/i.test(hex))throw Error('6자리 HEX 색상을 입력하세요.');const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;}
 const a=luminance(foreground),b=luminance(background),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);return {ratio,normalAA:ratio>=4.5,largeAA:ratio>=3};
}
export function dimension(raw:string,min:number,max:number){const n=Number(raw);if(!raw.trim()||!Number.isFinite(n)||n<min||n>max)throw Error(`${min}~${max} 범위의 숫자를 입력하세요.`);return n;}
export function gridRecipe(columns:number,gap:number){if(!Number.isInteger(columns)||columns<1||columns>6||!Number.isFinite(gap)||gap<0||gap>64)throw Error('격자 값이 범위를 벗어났습니다.');return `.layout {\n  display: grid;\n  grid-template-columns: repeat(${columns}, minmax(0, 1fr));\n  gap: ${gap}px;\n}\n@media (max-width: 640px) {\n  .layout { grid-template-columns: 1fr; }\n}\n/* 실험 예제. 적용 프로젝트의 승인된 토큰·경계값으로 교체하세요. */`;}
