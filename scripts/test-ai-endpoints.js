const fetch = require('node-fetch');
(async()=>{
  const base = 'http://localhost:3001';
  console.log('GET /api/admin/ai');
  console.log(await (await fetch(base+'/api/admin/ai')).text());

  console.log('POST /api/admin/ai update settings');
  console.log(await (await fetch(base+'/api/admin/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini',temperature:0.4,rateLimitPerMinute:10})})).text());

  console.log('Call /api/ai/suggest 12 times to test rate limit');
  let ok=0,rl=0;
  for(let i=0;i<12;i++){
    const r = await fetch(base+'/api/ai/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal:'test'+i,sampleCustomer:{name:'T'+i}})});
    if(r.status===429) rl++; else ok++;
    const txt = await r.text();
    console.log('resp',i,r.status,txt);
  }
  console.log('ok',ok,'rate_limited',rl);

  console.log('GET /api/admin/openai/logs');
  const logs = await (await fetch(base+'/api/admin/openai/logs?limit=50')).json();
  console.log('logs count', logs.length);
  console.log(logs.slice(0,5));
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
