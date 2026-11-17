const maps=['sections','labs','unit_feedback','drafts','settings'];
const stable=x=>JSON.stringify(x);
export function empty(device_id='device'){return {schema_version:'2.0',device_id,seq:0,updated_at:new Date().toISOString(),sections:{},labs:{},unit_feedback:{},drafts:{},settings:{},attempts:[],study_sessions:[],conflicts:[]};}
export function record(state,value){const seq=++state.seq;return {...value,id:state.device_id+':'+seq+':'+crypto.randomUUID(),device_id:state.device_id,seq,updated_at:new Date().toISOString()};}
export function migrate(input){
 if(input?.schema_version==='2.0'){validate(input);return structuredClone(input);}
 if(input?.schema_version!=='1.0'||!Array.isArray(input.attempts)||!input.sections||!input.labs||!input.unit_feedback)throw Error('지원하는 학습기록 파일이 아닙니다');
 const s=empty('legacy-v1');const wrap=(v,key)=>({...v,id:'legacy:'+key+':'+JSON.stringify(v),device_id:'legacy-v1',seq:0,updated_at:v.at||v.completed_at||input.updated_at});
 for(const k of ['sections','labs','unit_feedback'])for(const [id,v]of Object.entries(input[k]))s[k][id]=wrap({...v,...(['sections','labs'].includes(k)?{completed:!!v.completed_at}:{})},k+id);
 s.attempts=input.attempts.map((v,i)=>wrap(v,'attempt'+i));validate(s);return s;
}
export function validate(s){
 if(s.schema_version!=='2.0'||typeof s.device_id!=='string'||!Number.isInteger(s.seq)||s.seq<0)throw Error('기록 버전·기기·순번 오류');
 for(const k of maps)if(!s[k]||typeof s[k]!=='object'||Array.isArray(s[k]))throw Error(k+': 기록 형식 오류');
 for(const k of ['attempts','study_sessions','conflicts'])if(!Array.isArray(s[k]))throw Error(k+': 기록 형식 오류');
 for(const r of [...maps.flatMap(k=>Object.values(s[k])),...s.attempts,...s.study_sessions]){
  if(!r||typeof r.id!=='string'||!r.id||typeof r.device_id!=='string'||!r.device_id||!Number.isInteger(r.seq)||r.seq<0||!Number.isFinite(Date.parse(r.updated_at)))throw Error('기록 ID·기기·시간 오류');
 }
 for(const a of s.attempts)if(typeof a.problem_id!=='string'||typeof a.input!=='string'||typeof a.correct!=='boolean')throw Error('문제 시도 형식 오류');
 for(const a of s.study_sessions)if(!Number.isFinite(a.seconds)||a.seconds<0)throw Error('학습시간 형식 오류');
 for(const k of ['sections','labs'])for(const r of Object.values(s[k]))if(typeof r.completed!=='boolean')throw Error('완료 기록 형식 오류');
 for(const r of Object.values(s.labs))if(r.note!==undefined&&typeof r.note!=='string')throw Error('실습 메모 형식 오류');
 for(const r of Object.values(s.unit_feedback))if(![r.understanding,r.difficulty].every(n=>Number.isInteger(n)&&n>=1&&n<=5)||typeof r.comment!=='string')throw Error('단원 의견 형식 오류');
 for(const c of s.conflicts)if(!c||typeof c.id!=='string'||typeof c.field!=='string'||typeof c.key!=='string'||!c.winner||!c.loser)throw Error('충돌 기록 형식 오류');

}
const payload=r=>{const {id,device_id,seq,updated_at,...v}=r;return stable(v)};
export function merge(local,source){
 validate(local);const incoming=migrate(source),out=structuredClone(local);let added=0;
 const conflicts=new Map([...local.conflicts,...incoming.conflicts].map(c=>[c.id,c]));
 for(const k of ['attempts','study_sessions']){
  const all=new Map(out[k].map(r=>[r.id,r]));for(const r of incoming[k])if(!all.has(r.id)){all.set(r.id,r);added++;}out[k]=[...all.values()].sort((a,b)=>a.updated_at.localeCompare(b.updated_at)||a.id.localeCompare(b.id));
 }
 for(const k of maps)for(const [key,r]of Object.entries(incoming[k])){
  const old=out[k][key];if(!old){out[k][key]=r;added++;continue;}if(old.id===r.id)continue;
  const compare=old.device_id===r.device_id?old.seq-r.seq||old.updated_at.localeCompare(r.updated_at)||old.id.localeCompare(r.id):old.updated_at.localeCompare(r.updated_at)||old.id.localeCompare(r.id);
  const winner=compare>=0?old:r,loser=compare>=0?r:old;
  if(k!=='settings'&&old.device_id!==r.device_id&&payload(old)!==payload(r)){
   const id=k+':'+key+':'+[old.id,r.id].sort().join('|');conflicts.set(id,{id,device_id:winner.device_id,seq:winner.seq,updated_at:winner.updated_at,field:k,key,winner,loser});
  }
  out[k][key]=winner;
 }
 out.conflicts=[...conflicts.values()];out.seq=[...maps.flatMap(k=>Object.values(out[k])),...out.attempts,...out.study_sessions].filter(r=>r.device_id===out.device_id).reduce((seq,r)=>Math.max(seq,r.seq),out.seq);
 out.updated_at=new Date().toISOString();return {state:out,added,conflicts:out.conflicts.length-local.conflicts.length};
}
export async function openStore(){
 return new Promise((resolve,reject)=>{const req=indexedDB.open('ela',1);req.onupgradeneeded=()=>req.result.createObjectStore('progress');req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result)});
}
export function readStore(db){return new Promise((resolve,reject)=>{const r=db.transaction('progress').objectStore('progress').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});}
// The read and write must share a transaction: IDB serializes competing windows.
export function writeStore(db,state){return new Promise((resolve,reject)=>{
 const t=db.transaction('progress','readwrite'),store=t.objectStore('progress'),r=store.get('state');let saved;
 r.onsuccess=()=>{try{saved=r.result?merge(r.result,state).state:structuredClone(state);store.put(saved,'state');}catch(e){reject(e);t.abort();}};
 t.oncomplete=()=>resolve(saved);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||Error('기록 저장 취소'));
});}
export function exportProgress(state){const out=structuredClone(state);out.settings={};out.conflicts=out.conflicts.filter(c=>c.field!=='settings');return out;}
export function importProgress(local,source){
 const incoming=exportProgress(migrate(source)),result=merge(local,incoming),out=result.state;
 const newItems=k=>out[k].filter(r=>!local[k].some(old=>old.id===r.id));
 const changed=k=>Object.entries(out[k]).filter(([key,r])=>payload(r)!== (local[k][key]?payload(local[k][key]):undefined));
 const attempts=newItems('attempts').length,sections=changed('sections').filter(([,r])=>r.completed).length,labs=changed('labs').length,seconds=newItems('study_sessions').reduce((n,r)=>n+r.seconds,0),feedback=changed('unit_feedback').length;
 const any=attempts||seconds||['sections','labs','unit_feedback','drafts'].some(k=>changed(k).length)||result.conflicts;
 return {...result,message:!any?'새로 추가된 기록 없음':`가져오기 완료: 문제 풀이 ${attempts}건, 완료한 절 ${sections}개, 실습 ${labs}개, 학습시간 ${+(seconds/60).toFixed(2)}분 추가, 단원 의견 ${feedback}개. ${result.conflicts?`충돌 ${result.conflicts}건 (오늘 화면에서 확인)`:'충돌 없음'}`};
}
