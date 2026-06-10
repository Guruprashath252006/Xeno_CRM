const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

function randDelay(){ return 500 + Math.floor(Math.random()*2000); }

app.post('/send', (req,res)=>{
  const { messageId, to, channel, content, callback_url } = req.body;
  console.log('Channel stub received send for', messageId, to, channel);
  res.json({ok:true});

  // simulate async lifecycle
  // 1. accepted -> delivered/failed
  setTimeout(()=>{
    const delivered = Math.random() > 0.1; // 90% delivered
    const event = { type: delivered ? 'delivered' : 'failed', detail: delivered ? 'delivered to carrier' : 'delivery failed' };
    fetch(callback_url, { method:'POST', body: JSON.stringify({ messageId, event }), headers: { 'Content-Type':'application/json' }})
      .catch(err=>console.error('callback failed', err));

    if(delivered){
      // then maybe opened
      setTimeout(()=>{
        const opened = Math.random() > 0.3;
        if(opened){
          const ev = { type: 'opened' };
          fetch(callback_url, { method:'POST', body: JSON.stringify({ messageId, event: ev }), headers: { 'Content-Type':'application/json' }})
            .catch(err=>console.error('callback failed', err));

          // maybe clicked
          setTimeout(()=>{
            const clicked = Math.random() > 0.6;
            if(clicked){
              const ev2 = { type: 'clicked' };
              fetch(callback_url, { method:'POST', body: JSON.stringify({ messageId, event: ev2 }), headers: { 'Content-Type':'application/json' }})
                .catch(err=>console.error('callback failed', err));
              // after a click, small chance of an order attributed to the message
              setTimeout(()=>{
                const orderHappens = Math.random() > 0.7;
                if(orderHappens){
                  const orderEvent = { type: 'order', amount: Math.floor(20 + Math.random()*100) };
                  fetch(callback_url, { method:'POST', body: JSON.stringify({ messageId, event: orderEvent }), headers: { 'Content-Type':'application/json' }})
                    .catch(err=>console.error('callback failed', err));
                }
              }, randDelay());
            }
          }, randDelay());
        }
      }, randDelay());
    }
  }, randDelay());
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, ()=> console.log('Channel stub running on', PORT));
