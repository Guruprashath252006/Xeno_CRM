const fetch = require('node-fetch');

const BASE = 'http://localhost:3001';

async function check(){
  try{
    console.log('GET /api/customers');
    let r = await fetch(BASE+'/api/customers');
    console.log('->', r.status);
    console.log(await r.json());

    console.log('GET /api/analytics');
    r = await fetch(BASE+'/api/analytics');
    console.log('->', r.status);
    console.log(await r.json());

    console.log('POST /api/campaigns');
    r = await fetch(BASE+'/api/campaigns', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:'smoke', audience:'lifetime_value>0', message:'Hi {{name}}', channel:'sms' }) });
    console.log('->', r.status);
    const camp = await r.json();
    console.log(camp);

    console.log('POST /api/send');
    r = await fetch(BASE+'/api/send', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ campaignId: camp.id }) });
    console.log('->', r.status);
    console.log(await r.json());

    console.log('Waiting 4s for channel callbacks...');
    await new Promise(r2=>setTimeout(r2,4000));

    console.log('GET /api/messages');
    r = await fetch(BASE+'/api/messages');
    console.log('->', r.status);
    console.log(await r.json());

    console.log('\nSmoke test complete');
  }catch(err){
    console.error('Test failed', err);
    process.exit(1);
  }
}

check();
