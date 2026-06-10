import React from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';

export default function Header({ onToggleCopilot, copilotOpen, keysStatus }) {
  const isKeyLoaded = keysStatus?.geminiKeySet || keysStatus?.openaiKeySet;

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-200 hover:rotate-6 transition-all duration-300">
            X
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5">
              Xeno CRM
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                AI-Native
              </span>
            </div>
            <div className="text-xs text-slate-400 font-medium">Mini CRM for Intelligent Shopper Engagement</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* API Key Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
            <span className={`w-1.5 h-1.5 rounded-full ${isKeyLoaded ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-slate-500">
              {isKeyLoaded ? 'AI API Keys Loaded' : 'AI Sandbox (No Keys)'}
            </span>
          </div>

          {/* Copilot Toggle Button */}
          <button 
            onClick={onToggleCopilot}
            className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${
              copilotOpen 
                ? 'bg-slate-100 text-slate-700' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 hover:scale-[1.02] active:scale-95'
            }`}
          >
            <Sparkles size={14} className={!copilotOpen ? "animate-pulse" : ""} />
            <span>{copilotOpen ? 'Close Copilot' : 'Xeno Copilot'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
