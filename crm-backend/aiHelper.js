const fetch = require('node-fetch');

// Helper to get active API keys from environment
function getApiKeys() {
  return {
    geminiKey: process.env.GEMINI_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY
  };
}

/**
 * Call Gemini API using REST
 */
async function callGemini(prompt, isJson = false) {
  const { geminiKey } = getApiKeys();
  if (!geminiKey) throw new Error('GEMINI_API_KEY_NOT_FOUND');

  // Use Gemini 1.5 Flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: isJson ? { responseMimeType: 'application/json' } : {}
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}

/**
 * Call OpenAI API using REST
 */
async function callOpenAI(messages, isJson = false, model = 'gpt-3.5-turbo', temp = 0.7) {
  const { openaiKey } = getApiKeys();
  if (!openaiKey) throw new Error('OPENAI_API_KEY_NOT_FOUND');

  const url = 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-3.5-turbo',
      messages,
      temperature: temp,
      response_format: isJson ? { type: 'json_object' } : undefined
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenAI');
  return text.trim();
}

/**
 * Centrally manages prompts. Dispatches to Gemini if GEMINI_API_KEY is present,
 * otherwise to OpenAI if OPENAI_API_KEY is present, or falls back to rules.
 */
async function runPrompt(systemPrompt, userPrompt, isJson = false, settings = {}) {
  const { geminiKey, openaiKey } = getApiKeys();

  if (geminiKey) {
    const combinedPrompt = `${systemPrompt}\n\nUser request:\n${userPrompt}`;
    return await callGemini(combinedPrompt, isJson);
  } else if (openaiKey) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    return await callOpenAI(messages, isJson, settings.model, settings.temperature);
  } else {
    throw new Error('NO_API_KEY_CONFIGURED');
  }
}

/**
 * Draft a promotional message.
 */
async function draftMessage(goal, sampleCustomer, tone, channel, settings = {}) {
  const name = sampleCustomer?.name || '{{name}}';
  const email = sampleCustomer?.email || '{{email}}';
  const ltv = sampleCustomer?.lifetime_value || 0;

  const systemPrompt = `You are an expert consumer marketing copywriter. 
Draft a highly personalized promotional message for a shopper.
Make sure to include personal tokens:
- Use {{name}} to represent the customer's name.
- You can also use other attributes: {{lifetime_value}} or {{email}} if appropriate.
Keep the message concise and optimized for the channel:
- Channel: ${channel || 'SMS'}
- Tone: ${tone || 'friendly'}
- Format: Do NOT add subject lines unless the channel is Email.
- Maximum length: SMS/WhatsApp/RCS: 140 chars; Email: 300 chars.
Include a clear, compelling call to action. Return ONLY the copy, nothing else.`;

  const userPrompt = `Target customer: ${name} (LTV: $${ltv}, Email: ${email}).
Campaign goal: ${goal || 'promote a 20% discount on next order'}.
Channel: ${channel || 'SMS'}.
Tone: ${tone || 'friendly'}.`;

  try {
    return await runPrompt(systemPrompt, userPrompt, false, settings);
  } catch (err) {
    console.warn('AI Message Draft failed, using fallback:', err.message);
    const cName = sampleCustomer?.name || 'there';
    return `Hi ${cName}! ${goal || 'We have an exclusive offer for you — enjoy 20% off your next purchase!'}`;
  }
}

/**
 * Compile a natural language description of a segment into a structured JSON condition.
 */
async function compileSegment(prompt, settings = {}) {
  const schemaDescription = `
Return a JSON object representing a condition tree.
The JSON must follow one of these two structures:

1. Condition node:
{
  "type": "condition",
  "field": "lifetime_value" | "name" | "email" | "phone" | "order_count" | "total_spent" | "last_order_days",
  "operator": "gt" | "gte" | "lt" | "lte" | "eq" | "contains" | "in_last_days" | "more_than_days",
  "value": number or string
}

2. Logical group node:
{
  "type": "logical",
  "operator": "AND" | "OR",
  "conditions": [ ... array of condition or logical nodes ... ]
}

Examples:
- "lifetime value over 100":
  {"type":"condition","field":"lifetime_value","operator":"gt","value":100}

- "customers who ordered at least 3 times and have name Alice":
  {
    "type": "logical",
    "operator": "AND",
    "conditions": [
      {"type":"condition","field":"order_count","operator":"gte","value":3},
      {"type":"condition","field":"name","operator":"contains","value":"Alice"}
    ]
  }

- "inactive customers (no orders in last 60 days)":
  {"type":"condition","field":"last_order_days","operator":"more_than_days","value":60}

- "highly active high spenders (spent > 200 OR ordered > 5 times)":
  {
    "type": "logical",
    "operator": "OR",
    "conditions": [
      {"type":"condition","field":"total_spent","operator":"gt","value":200},
      {"type":"condition","field":"order_count","operator":"gt","value":5}
    ]
  }
`;

  const systemPrompt = `You are a database query compiler. 
Your task is to translate natural language user descriptions of customer segments into a structured JSON query format.
Rules:
1. Output ONLY valid JSON. No markdown backticks, no markdown codeblocks, no text.
2. Rely only on the specified schema:
${schemaDescription}
3. If the prompt is unclear, fallback to a query that matches everyone: {"type":"condition","field":"lifetime_value","operator":"gte","value":0}`;

  const userPrompt = `Translate this segment description: "${prompt}"`;

  try {
    const rawResult = await runPrompt(systemPrompt, userPrompt, true, settings);
    // Remove potential markdown code blocks if the LLM outputted them anyway
    const cleanJson = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.warn('AI Segment compilation failed, compiling using fallback matching rule:', err.message);
    // Basic regex compilation fallback
    if (prompt.includes('lifetime') || prompt.includes('LTV') || prompt.includes('spent')) {
      const match = prompt.match(/\d+/);
      const val = match ? Number(match[0]) : 50;
      return { type: 'condition', field: 'lifetime_value', operator: 'gt', value: val };
    }
    return { type: 'condition', field: 'lifetime_value', operator: 'gte', value: 0 };
  }
}

/**
 * CRM AI Copilot chatbot. Handles interactive natural language actions.
 */
async function chatAgent(history, userMessage, dbSummary, settings = {}) {
  const systemPrompt = `You are "Xeno Copilot", an intelligent marketing automation AI agent for a DTC brand CRM.
You help marketers analyze customer demographics, segment customers, construct campaign message templates, and run bulk sending jobs.

You have access to the current state of the database:
${JSON.stringify(dbSummary, null, 2)}

Instructions:
1. You can communicate with the user via natural language using the "message" field of your output.
2. In addition, you can trigger actions inside the CRM by setting the "action" field.
3. The response MUST be a JSON object containing EXACTLY:
{
  "message": "Write a friendly, insightful response. If triggering an action, briefly explain what you are doing.",
  "action": null | ActionObject
}

Supported Action Objects:

A. Create a Segment:
{
  "type": "create_segment",
  "payload": {
    "name": "A descriptive name for the segment",
    "rule": <A valid segment rule condition/logical JSON object matching the Segment Evaluator schema>
  }
}

B. Create a Campaign:
{
  "type": "create_campaign",
  "payload": {
    "name": "Campaign Name",
    "audience": <A valid segment rule JSON object, OR a string query like "lifetime_value>50">,
    "message": "Message text including optional {{name}}",
    "channel": "whatsapp" | "sms" | "email" | "rcs"
  }
}

C. Send a Campaign (only if you have a campaign ID, or after creating one):
{
  "type": "send_campaign",
  "payload": {
    "campaignId": "camp_..."
  }
}

Guidelines:
- Analyze customer data to answer marketer questions (e.g. "who are my top buyers?").
- If the marketer asks you to perform a task (e.g. "Create a segment of customers who spent > $100"), construct the action and include it.
- If the user asks to launch a campaign, create the campaign first, and tell them you've queued it.
- Maintain a helpful, conversational, professional tone.
- Output ONLY valid raw JSON. No conversational text outside the JSON. No backticks.`;

  const messages = [];
  // Build history (limit to last 10 messages)
  const conversation = (history || []).slice(-10).map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: typeof msg.content === 'object' ? JSON.stringify(msg.content) : String(msg.content)
  }));
  
  const userPrompt = `User message: "${userMessage}"`;
  
  try {
    const rawResult = await runPrompt(systemPrompt, userPrompt, true, settings);
    const cleanJson = rawResult.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('Chat agent error:', err);
    return {
      message: `I encountered an issue processing your request. Error details: ${err.message}. Please check if GEMINI_API_KEY or OPENAI_API_KEY is configured correctly.`,
      action: null
    };
  }
}

module.exports = {
  draftMessage,
  compileSegment,
  chatAgent,
  getApiKeys
};
