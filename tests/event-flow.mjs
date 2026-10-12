import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { createServer } from 'node:net';
const portProbe = createServer();
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const database = join(tmpdir(), `karaoke-awards-test-${randomUUID()}.sqlite`);
const child = spawn(process.execPath, ['dist/server/index.js'], { env: { ...process.env, PORT:String(port), ADMIN_PASSWORD:'test-only', DATABASE_PATH:database }, stdio:['ignore','pipe','pipe'] });
const base=`http://127.0.0.1:${port}/api/`;
const assert=(condition,label)=>{ if(!condition) throw new Error(label); console.log('PASS '+label); };
try {
 await new Promise((resolve,reject)=>{ const timer=setTimeout(()=>reject(new Error('Server startup timed out')),10000); child.stdout.on('data',data=>{ if(String(data).includes('Karaoke server')){clearTimeout(timer);resolve();} }); child.on('error',reject); });
 let cookie = '';
 const api=async(path,data,auth=true)=>{const res=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(auth?{Authorization:'Bearer test-only'}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,data:await res.json()};};
 const page = await fetch(base.replace('/api/', '/'));
 assert(page.ok, 'Production audience page is served');
 const html = await page.text();
 for (const match of html.matchAll(/(?:src|href)="([^\"]*assets\/[^\"]+)"/g)) {
   assert((await fetch(new URL(match[1], page.url))).ok, 'Production asset loads: ' + match[1]);
 }
 assert((await api('queue',{singer:' ',song:'Song'})).status===400,'Blank singer names are rejected');
 assert((await api('music')).status===400,'Invalid song searches are rejected');
 const stream=await fetch(base+'event/stream');
 const reader=stream.body.getReader();
 const initial=await reader.read();
 assert(new TextDecoder().decode(initial.value).includes('"phase":"open"'),'Event stream sends initial state');
 for(const singer of ['Alex','Mia','Sam']) await api('queue',{singer,song:singer+' song'});
 let state=(await api('admin/event')).data;
 assert(state.performances.length===3,'Isolated test event has three singers');
 const [first,second,third]=state.performances;
 assert((await api('admin/certificate',{category:'costume',performance_id:first.id})).status===400,'Certificates reject unfinished performances');
 await api('admin/next',{});
 await api('vote',{id:first.id});
 assert((await api('vote',{id:first.id})).status===409,'Repeat votes from one browser are rejected');
 await api('admin/next',{});
 await api('admin/next',{});
 await api('admin/close',{});
 assert((await api('queue',{singer:'Late signup',song:'Song'})).status===400,'Closed event rejects new signups');
 assert((await api('vote',{id:third.id})).status===400,'Closed event rejects votes');
 for(const category of ['costume','presence','duet','unexpected']) assert((await api('admin/certificate',{category,performance_id:second.id})).status===200,'Saves certificate '+category);
 assert((await api('admin/certificate',{category:'invalid',performance_id:second.id})).status===400,'Rejects invalid certificate category');
 assert((await api('admin/certificate',{category:'costume',performance_id:second.id},false)).status===401,'Certificate selection requires host authentication');
 state=(await api('event')).data;
 assert(state.results===null && state.certificates===null,'Scores and certificate winners remain private before finale');
 await api('admin/reveal',{});
 state=(await api('event')).data;
 assert(state.results[0].id===first.id && state.results[0].votes===1,'Scored winners remain ranked by votes');
 assert(state.certificates.length===4 && state.certificates.every(c=>c.id===second.id),'Finale publishes all four saved certificates');
 assert(state.certificates.every(c=>Object.keys(c).every(key=>['category','id','singer','song'].includes(key))),'Certificates contain only winner details');
 await api('admin/certificate',{category:'costume',performance_id:null});
 assert((await api('event')).data.certificates.length===3,'Certificate selection can be cleared');
 await api('admin/performance/'+second.id+'/delete',{});
 assert((await api('event')).data.certificates.length===0,'Deleting a performance removes its certificates');
 const updated=await reader.read();
 assert(new TextDecoder().decode(updated.value).includes('data:'),'Live stream delivers event changes');
 await reader.cancel();
 await api('admin/reset',{confirmation:'RESET'});
 state=(await api('admin/event')).data;
 assert(state.performances.length===0 && state.certificates.length===0,'Reset clears performances and certificates');
} finally {
 child.kill();
 await new Promise(resolve=>child.once('exit',resolve));
 try{unlinkSync(database);}catch{}
}

