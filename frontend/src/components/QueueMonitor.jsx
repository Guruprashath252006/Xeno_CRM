import React from 'react';
import { RefreshCw, Play, AlertTriangle, CheckCircle, Clock, Trash2 } from 'lucide-react';

export default function QueueMonitor({ 
  messages, 
  onRetry, 
  onClearDb,
  API_BASE 
}) {
  const queued = (messages || []).filter(m => m.status === 'queued');
  const sending = (messages || []).filter(m => m.status === 'sending');
  const delivered = (messages || []).filter(m => m.status === 'delivered');
  const failed = (messages || []).filter(m => m.status === 'failed');
  const opened = (messages || []).filter(m => m.status === 'opened');
  const clicked = (messages || []).filter(m => m.status === 'clicked');
  const attributed = (messages || []).filter(m => m.status === 'attributed');

  // Build sequential list of all history updates for real-time tracking
  const logEvents = [];
  (messages || []).forEach(m => {
    (m.history || []).forEach(h => {
      logEvents.push({
        messageId: m.id,
        recipient: m.recipient?.name || m.recipient?.phone || m.recipient?.email || 'Unknown',
        channel: m.channel,
        event: h.event?.type || 'event',
        detail: h.event?.detail || h.event?.amount ? `Amount: $${h.event?.amount}` : '',
        at: new Date(h.at)
      });
    });
  });

  // Sort logs by time (latest first)
  const sortedLogs = logEvents.sort((a, b) => b.at - a.at).slice(0, 50);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'queued':
        return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1"><Clock size={10}/> Queued</span>;
      case 'sending':
        return <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 animate-pulse"><RefreshCw size={10} className="animate-spin"/> Sending</span>;
      case 'delivered':
        return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1"><CheckCircle size={10}/> Delivered</span>;
      case 'opened':
        return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Opened</span>;
      case 'clicked':
        return <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Clicked</span>;
      case 'attributed':
        return <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">ROI Attributed</span>;
      case 'failed':
        return <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1"><AlertTriangle size={10}/> Failed</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{status}</span>;
    }
  };

  const getLogEventColor = (evtType) => {
    switch(evtType) {
      case 'created': return 'text-indigo-400';
      case 'sending': return 'text-amber-500';
      case 'delivered': return 'text-blue-500';
      case 'opened': return 'text-emerald-500';
      case 'clicked': return 'text-pink-500';
      case 'order': return 'text-teal-500 font-bold';
      case 'failed': return 'text-rose-500 font-semibold';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Messages</span>
          <span className="text-2xl font-bold text-slate-800 mt-2">{(messages || []).length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Active Queue</span>
          <span className="text-2xl font-bold text-indigo-600 mt-2 flex items-center gap-2">
            {queued.length + sending.length}
            {(queued.length + sending.length > 0) && (
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></span>
            )}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Delivered</span>
          <span className="text-2xl font-bold text-emerald-600 mt-2">
            {delivered.length + opened.length + clicked.length + attributed.length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Conversions (Orders)</span>
          <span className="text-2xl font-bold text-teal-600 mt-2">{attributed.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Failed</span>
          <span className="text-2xl font-bold text-rose-600 mt-2">{failed.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Logs Console */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl p-4 shadow-inner border border-slate-800 flex flex-col h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-mono font-bold text-emerald-500">SIMULATED DELIVERY NETWORK LOGS</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={onClearDb}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 px-2 py-1 rounded border border-slate-700 flex items-center gap-1 transition-all"
              >
                <Trash2 size={10}/> Clear DB
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto mt-4 font-mono text-[10px] text-slate-300 space-y-2.5 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
            {sortedLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                [ Waiting for campaign launches or network callbacks... ]
              </div>
            ) : (
              sortedLogs.map((log, i) => (
                <div key={i} className="border-b border-slate-800/40 pb-1.5 flex justify-between items-start gap-4 hover:bg-slate-800/10 rounded px-1 transition-all">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-600">[{log.at.toLocaleTimeString()}]</span>
                    <div>
                      <span className="text-indigo-400 font-bold">{log.messageId.slice(0, 8)}</span>
                      <span className="text-slate-400"> to </span>
                      <span className="text-slate-200 font-semibold">{log.recipient}</span>
                      <span className="text-slate-500"> ({log.channel.toUpperCase()}) </span>
                      <span className="text-slate-400">→</span>{' '}
                      <span className={getLogEventColor(log.event)}>{log.event.toUpperCase()}</span>
                      {log.detail && <span className="text-slate-500 font-semibold"> [{log.detail}]</span>}
                    </div>
                  </div>
                  <span className="text-slate-600 shrink-0">Carrier: StubService</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Actions & Retry Queue */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 h-[500px] flex flex-col">
          <h3 className="text-sm font-semibold text-slate-800 pb-3 border-b border-slate-100">Delivery Status Queue</h3>
          
          <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-100">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No messages generated.
              </div>
            ) : (
              [...messages].reverse().slice(0, 50).map(m => (
                <div key={m.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 flex justify-between items-start gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{m.recipient?.name || 'Shopper'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{m.id.slice(0, 8)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic max-w-[180px] truncate">"{m.content}"</p>
                    <div className="pt-1">{getStatusBadge(m.status)}</div>
                  </div>
                  
                  {m.status === 'failed' && (
                    <button 
                      onClick={() => onRetry(m.id)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-2.5 rounded text-[10px] flex items-center gap-1 transition-colors mt-1"
                    >
                      <Play size={10}/> Retry
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
