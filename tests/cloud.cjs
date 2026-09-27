const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../cloud.js'),'utf8');
async function main(){
 const elements=new Map(),local=new Map(),tabStore=new Map(),calls=[],users={alpha:{id:'a',user_metadata:{username:'Alpha',bird_best_score:8,piggy:'untouched'}},beta:{id:'b',user_metadata:{username:'Beta',bird_best_score:2}}};
 const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,events:{},addEventListener(k,fn){this.events[k]=fn;}});return elements.get(id);};
 let current='alpha',fail=false,expired=false,refreshCount=0,paused=0,applied=0;
 const storage=map=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 const newSession=()=>({user:structuredClone(users[current]),access_token:'test-token',refresh_token:'test-refresh',expires_at:expired?0:Date.now()/1000+3600});
 const ctx={console,AbortController,setTimeout,clearTimeout,localStorage:storage(local),sessionStorage:storage(tabStore),document:{hidden:false,getElementById:el,addEventListener(){}},window:{BIRD_SUPABASE:{url:'https://example.test',key:'public'},pauseBirdForAccount(){paused++;},applyBirdCloudBest(n){applied=n;},addEventListener(){}},fetch:async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url,options,body});
  if(fail)throw new Error('offline');
  let result={};
  if(url.includes('/functions/')){current=body.username.toLowerCase();result={session:newSession()};}
  else if(url.includes('/token?')){refreshCount++;expired=false;result=newSession();}
  else if(url.endsWith('/user')){assert.equal(options.headers.Authorization,'Bearer test-token');if(options.method==='PUT'){assert.deepEqual(Object.keys(body.data),['bird_best_score']);users[current].user_metadata.bird_best_score=body.data.bird_best_score;}result=structuredClone(users[current]);}
  return {ok:true,status:200,json:async()=>result};
 }};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const flush=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setImmediate(resolve));};
 ctx.window.birdCloud.submit(100);await flush();assert.equal(calls.length,0,'guest score must not upload');
 el('auth-name').value='invalid123';el('auth-password').value='12345678';await el('auth-form').events.submit({preventDefault(){}});await flush();assert.equal(calls.length,0);
 el('auth-name').value='Alpha';await el('auth-form').events.submit({preventDefault(){}});await flush();assert.equal(applied,8);assert.equal(el('auth-password').value,'');assert.equal(el('auth-form').hidden,true);
 ctx.window.birdCloud.submit(15);ctx.window.birdCloud.submit(21);await flush();assert.equal(users.alpha.user_metadata.bird_best_score,21);assert.equal(users.alpha.user_metadata.piggy,'untouched');
 ctx.window.birdCloud.submit(3);await flush();assert.equal(users.alpha.user_metadata.bird_best_score,21,'lower score must not overwrite best');
 fail=true;ctx.window.birdCloud.submit(30);await flush();assert.match(el('cloud-status').textContent,/暂时无法/);assert.equal(JSON.parse(local.get('candle-wings-account-best:a')),30);
 fail=false;el('cloud-sync').events.click();await flush();assert.equal(users.alpha.user_metadata.bird_best_score,30);
 await el('auth-logout').events.click();assert.equal(tabStore.size,0);assert.equal(el('auth-form').hidden,false);
 expired=true;el('auth-name').value='Beta';el('auth-password').value='12345678';el('auth-form').events.submit({preventDefault(){}});await flush();assert.equal(refreshCount,1);assert.equal(users.beta.user_metadata.bird_best_score,2,'account A and guest scores must not leak to account B');assert.equal(applied,2);
 el('auth-panel').events.focusin();assert.equal(paused,1);
 for(const [key,value]of [...local,...tabStore])assert.ok(!value.includes('12345678'),'password persisted: '+key);
 console.log('PASS cloud: guest, input validation, login, highest-score merge, queued submits, metadata preservation, offline retry, logout, refresh, account isolation, password non-persistence.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
