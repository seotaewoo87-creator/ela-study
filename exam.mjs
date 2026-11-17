export function shuffle(items,random=Math.random){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function selectQuestions(exam,banks,random=Math.random){
 const slots=exam.parts.flatMap(part=>Array.from({length:part.count},()=>shuffle((banks[part.bank]||[]).filter(p=>!part.topics?.length||part.topics.includes(p.topic)),random)));
 const owners=new Map(),selected=[];
 function assign(i,seen){for(const p of slots[i]){if(seen.has(p.id))continue;seen.add(p.id);if(!owners.has(p.id)||assign(owners.get(p.id),seen)){owners.set(p.id,i);selected[i]=p;return true;}}return false;}
 if(!slots.every((_,i)=>assign(i,new Set())))throw Error('중복 없이 뽑을 문제가 부족합니다.');
 return selected.map(p=>({id:p.id,order:exam.shuffle_choices?shuffle([0,1,2,3],random):[0,1,2,3]}));
}
export function scoreExam(run,questions,answers,pass){
 const subjects={},topics={};let correct=0;
 const rows=run.items.map(item=>{const p=questions.find(p=>p.id===item.id);if(!p||!answers[p.id])throw Error('채점 자료가 없습니다: '+item.id);const input=run.inputs[item.id];const ok=Number.isInteger(input)&&input===answers[p.id].answer.index;if(ok)correct++;
 for(const [map,key]of [[subjects,p.subject],[topics,p.topic]]){map[key]??={correct:0,total:0,pct:0};map[key].total++;map[key].correct+=+ok;map[key].pct=map[key].correct/map[key].total*100;}
 return {id:p.id,input,correct:ok};});
 const pct=run.items.length?correct/run.items.length*100:0;
 return {correct,total:run.items.length,pct,passed:pct>=pass.total_pct&&Object.values(subjects).every(s=>s.pct>=(pass.subject_min_pct||0)),subjects,topics,rows};
}
export const remaining=(run,now=Date.now())=>run.deadline===null?null:Math.max(0,Math.ceil((run.deadline-now)/1000));
