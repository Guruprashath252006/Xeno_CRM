import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, ArrowRight, Check, Play, RefreshCw } from 'lucide-react';

export default function CopilotSidebar({ 
  isOpen, 
  onClose, 
  API_BASE, 
  onRefreshData,
  onSelectSegmentRule,
  onSelectTab
}) {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: 'Hi! I am **Xeno Copilot**, your intelligent campaign assistant. Ask me to find shoppers, draft messages, or automate campaigns. \n\n*Try asking: "Find customers who spent more than $100 and create a segment"*' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue;
    setInputValue('');
    
    // Add user message to state
    const updatedMessages = [...messages, { role: 'user', content: userText }];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Call backend AI chat endpoint
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: updatedMessages
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.message,
        action: data.action // Attach action if returned
      }]);
    } catch (err) {
      console.error('Copilot connection error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I'm having trouble connecting to the AI helper. Make sure you've set \`GEMINI_API_KEY\` or \`OPENAI_API_KEY\` in the backend environment. \n\n*Error: ${err.message}*`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute the AI proposed action
  const handleExecuteAction = async (msgIndex, action) => {
    try {
      setIsLoading(true);
      
      let feedbackText = '';
      
      if (action.type === 'create_segment') {
        const { name, rule } = action.payload;
        const res = await fetch(`${API_BASE}/api/segments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, rule })
        });
        const created = await res.json();
        feedbackText = `✅ Segment **"${created.name}"** successfully created and saved!`;
        
        // Let the segment page preview it
        if (onSelectSegmentRule) {
          onSelectSegmentRule(created.rule, created.name);
          if (onSelectTab) onSelectTab('segments');
        }
      } 
      
      else if (action.type === 'create_campaign') {
        const { name, audience, message, channel } = action.payload;
        const res = await fetch(`${API_BASE}/api/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, audience, message, channel })
        });
        const campaign = await res.json();
        
        feedbackText = `✅ Campaign **"${campaign.name}"** (${channel.toUpperCase()}) drafted. Campaign ID: \`${campaign.id}\`. You can send it from the Campaigns Studio or trigger it now.`;
        
        if (onSelectTab) onSelectTab('campaigns');
      } 
      
      else if (action.type === 'send_campaign') {
        const { campaignId } = action.payload;
        const res = await fetch(`${API_BASE}/api/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId })
        });
        const result = await res.json();
        
        feedbackText = `🚀 Campaign launched! Queued **${result.sent}** messages for dispatch. Track the progress in the Queue Monitor.`;
        
        if (onSelectTab) onSelectTab('logs');
      }

      // Mark action as executed in UI
      setMessages(prev => {
        const next = [...prev];
        next[msgIndex] = {
          ...next[msgIndex],
          actionExecuted: true,
          actionFeedback: feedbackText
        };
        return next;
      });

      // Refresh parent app state
      if (onRefreshData) onRefreshData();

    } catch (err) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to render markdown-like bold/italic in messages
  const formatMessageText = (text) => {
    if (!text) return '';
    // Bold **text**
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code blocks `text`
    formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono text-xs font-semibold">$1</code>');
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br/>');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div 
      className={`fixed top-0 right-0 h-full w-96 bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-out transform ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200/60 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
            <Sparkles size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Xeno AI Copilot</h3>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Live CRM Agent
            </span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100/80 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200">
        {messages.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'
              }`}
            >
              {formatMessageText(msg.content)}
            </div>

            {/* Action Offer Card */}
            {msg.action && !msg.actionExecuted && (
              <div className="mt-2.5 w-full bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 shadow-sm flex flex-col gap-2">
                <div className="font-bold flex items-center gap-1.5 text-indigo-700">
                  <Sparkles size={14} />
                  Proposed Action
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-indigo-100/50 font-mono text-[10px] text-indigo-950 overflow-x-auto">
                  {msg.action.type === 'create_segment' && (
                    <div>
                      <span className="text-slate-500">Action:</span> Create Segment<br/>
                      <span className="text-slate-500">Name:</span> {msg.action.payload.name}<br/>
                      <span className="text-slate-500">Rule:</span> {JSON.stringify(msg.action.payload.rule)}
                    </div>
                  )}
                  {msg.action.type === 'create_campaign' && (
                    <div>
                      <span className="text-slate-500">Action:</span> Draft Campaign<br/>
                      <span className="text-slate-500">Name:</span> {msg.action.payload.name}<br/>
                      <span className="text-slate-500">Channel:</span> {msg.action.payload.channel.toUpperCase()}<br/>
                      <span className="text-slate-500">Msg:</span> "{msg.action.payload.message}"
                    </div>
                  )}
                  {msg.action.type === 'send_campaign' && (
                    <div>
                      <span className="text-slate-500">Action:</span> Send Campaign<br/>
                      <span className="text-slate-500">Campaign ID:</span> {msg.action.payload.campaignId}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => handleExecuteAction(index, msg.action)}
                  className="w-full mt-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 transition-all"
                >
                  Confirm & Execute <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* Action Feedback Result */}
            {msg.actionExecuted && (
              <div className="mt-2 w-[85%] bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-[11px] text-slate-700 flex items-start gap-2 shadow-sm">
                <div className="p-1 bg-emerald-500 rounded-full text-white mt-0.5">
                  <Check size={10} />
                </div>
                <div>{formatMessageText(msg.actionFeedback)}</div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium pl-1">
            <RefreshCw size={12} className="animate-spin text-indigo-500" />
            <span>Copilot is thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input box */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask Copilot..." 
          disabled={isLoading}
          className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white disabled:opacity-50 text-slate-800"
        />
        <button 
          type="submit" 
          disabled={isLoading || !inputValue.trim()}
          className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-md flex items-center justify-center"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
