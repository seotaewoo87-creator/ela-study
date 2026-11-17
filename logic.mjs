export function number(text) {
 const s=String(text).trim();
 if(!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) throw Error('숫자만 입력하세요');
 const n=Number(s.replaceAll(',','')); if(!Number.isFinite(n))throw Error('유한한 숫자를 입력하세요'); return n;
}
export function grade(p,a,input){
 if(p.type==='choice'){if(!/^\d+$/.test(String(input))||+input>=p.choices.length)throw Error('보기를 선택하세요');return +input===a.index;}
 const n=number(input), tolerance=a.value===0?(a.abs_tolerance??1e-9):Math.abs(a.value)*a.tolerance_pct/100;
 return Math.abs(n-a.value)<=tolerance;
}
export function circuit(mode,v,resistors,closed=true){
 v=number(v); const r=resistors.map(number);
 if(v<0||v>1000||r.some(n=>n<0||n>1e7)||!r.length)throw Error('전압 0~1000 V, 저항 0~10000000 Ω 범위로 입력하세요');
 if(!['single','series','parallel','relay'].includes(mode))throw Error('회로 모드를 확인하세요');
 if(mode==='relay')return {coil:closed,a:closed,b:!closed};
 const total=mode==='parallel'?(r.includes(0)?0:1/r.reduce((a,b)=>a+1/b,0)):r.reduce((a,b)=>a+b,0);
 if(!closed)return {total,current:0,power:0,branches:r.map(()=>({voltage:0,current:0,power:0})),short:false};
 if(total===0)return {total,short:true,current:null,power:null,branches:[]};
 const current=v/total;
 return {total,current,power:v*current,short:false,branches:r.map(x=>{const voltage=mode==='parallel'?v:current*x;const i=mode==='parallel'?v/x:current;return {voltage,current:i,power:voltage*i}})};
}
export function amperes(n){return n===null?'단락: 전류 제한 없음':Math.abs(n)>=1?`${+n.toPrecision(5)} A`:Math.abs(n)>=.001?`${+(n*1000).toPrecision(5)} mA`:`${+(n*1e6).toPrecision(5)} µA`;}

// E12 decades, inclusive of both touch-slider endpoints.
export const resistanceSteps=[...[10,100,1000,10000].flatMap(d=>[1,1.2,1.5,1.8,2.2,2.7,3.3,3.9,4.7,5.6,6.8,8.2].map(n=>Math.round(n*d))),100000];
export function touchVoltage(input){const v=number(input);if(v<0||v>48)throw Error('전압 0~48 V 범위로 입력하세요');return v;}
