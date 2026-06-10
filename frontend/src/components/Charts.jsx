import React from 'react';

/**
 * Custom Funnel Chart using SVGs
 */
export function FunnelChart({ stats }) {
  const { sent = 0, delivered = 0, opened = 0, clicked = 0, attributed = 0 } = stats || {};
  
  const stages = [
    { label: 'Sent', value: sent, color: 'from-indigo-500 to-indigo-600' },
    { label: 'Delivered', value: delivered, color: 'from-blue-500 to-blue-600' },
    { label: 'Opened', value: opened, color: 'from-teal-500 to-teal-600' },
    { label: 'Clicked', value: clicked, color: 'from-pink-500 to-pink-600' },
    { label: 'Orders', value: attributed, color: 'from-rose-500 to-rose-600' }
  ];

  const maxVal = sent || 1;
  
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-6">Campaign Conversion Funnel</h3>
      <div className="space-y-4">
        {stages.map((s, idx) => {
          const percent = maxVal > 0 ? (s.value / maxVal) * 100 : 0;
          const prevPercent = idx > 0 && stages[idx - 1].value > 0 ? (s.value / stages[idx - 1].value) * 100 : 100;
          
          return (
            <div key={s.label} className="relative">
              <div className="flex justify-between items-center text-xs font-medium text-slate-600 mb-1">
                <span>{s.label}</span>
                <span className="font-semibold text-slate-900">{s.value} <span className="text-slate-400 font-normal">({percent.toFixed(0)}%)</span></span>
              </div>
              <div className="w-full h-8 bg-slate-50 rounded-lg overflow-hidden border border-slate-100/50 flex items-center">
                <div 
                  className={`h-full bg-gradient-to-r ${s.color} rounded-l-lg transition-all duration-700 ease-out flex items-center pl-3`}
                  style={{ width: `${Math.max(percent, 4)}%` }}
                >
                  {percent > 12 && (
                    <span className="text-[10px] text-white font-bold whitespace-nowrap">
                      {idx > 0 ? `${prevPercent.toFixed(0)}% conversion` : 'Base Audience'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Custom Line Chart using SVGs for Sales Trends
 */
export function SalesLineChart({ orders }) {
  // Group orders by date
  const dateMap = {};
  (orders || []).forEach(o => {
    const d = o.created_at ? o.created_at.split('T')[0] : 'Unknown';
    dateMap[d] = (dateMap[d] || 0) + (o.amount || 0);
  });

  const sortedDates = Object.keys(dateMap).sort().slice(-7); // last 7 points
  const points = sortedDates.map(d => ({ date: d, value: dateMap[d] }));

  // Fallback data if empty
  if (points.length === 0) {
    points.push({ date: 'No Data', value: 0 });
  }

  const maxVal = Math.max(...points.map(p => p.value), 100);
  const width = 500;
  const height = 180;
  const padding = 30;

  // Calculate coordinates
  const coords = points.map((p, idx) => {
    const x = padding + (idx / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (p.value / maxVal) * (height - padding * 2);
    return { x, y, ...p };
  });

  // Create SVG path
  let pathD = '';
  if (coords.length > 0) {
    pathD = `M ${coords[0].x} ${coords[0].y} ` + coords.slice(1).map(c => `L ${c.x} ${c.y}`).join(' ');
  }

  // Create SVG area path
  let areaD = '';
  if (coords.length > 0) {
    areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;
  }

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Attributed Sales Revenue ($)</h3>
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Y Axis Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = height - padding - ratio * (height - padding * 2);
            return (
              <g key={i}>
                <line 
                  x1={padding} 
                  y1={y} 
                  x2={width - padding} 
                  y2={y} 
                  stroke="#f1f5f9" 
                  strokeWidth="1" 
                  strokeDasharray="4 4" 
                />
                <text 
                  x={padding - 5} 
                  y={y + 4} 
                  textAnchor="end" 
                  fontSize="10" 
                  fill="#94a3b8"
                  className="font-medium"
                >
                  ${(ratio * maxVal).toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Area under the line */}
          {coords.length > 1 && (
            <path 
              d={areaD} 
              fill="url(#salesGrad)" 
              opacity="0.15"
            />
          )}

          {/* Line */}
          <path 
            d={pathD} 
            fill="none" 
            stroke="#6366f1" 
            strokeWidth="3" 
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {coords.map((c, i) => (
            <g key={i} className="group cursor-pointer">
              <circle 
                cx={c.x} 
                cy={c.y} 
                r="5" 
                fill="#ffffff" 
                stroke="#6366f1" 
                strokeWidth="3" 
                className="transition-all duration-200 hover:r-7"
              />
              {/* Tooltip on Hover */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <rect 
                  x={c.x - 40} 
                  y={c.y - 35} 
                  width="80" 
                  height="22" 
                  rx="4" 
                  fill="#1e293b" 
                />
                <text 
                  x={c.x} 
                  y={c.y - 20} 
                  textAnchor="middle" 
                  fill="#ffffff" 
                  fontSize="10" 
                  fontWeight="bold"
                >
                  ${c.value.toFixed(0)}
                </text>
              </g>
            </g>
          ))}

          {/* X Axis Labels */}
          {coords.map((c, i) => {
            const dateStr = c.date !== 'Unknown' && c.date !== 'No Data' ? c.date.split('-').slice(1).join('/') : c.date;
            return (
              <text 
                key={i} 
                x={c.x} 
                y={height - padding + 15} 
                textAnchor="middle" 
                fontSize="10" 
                fill="#94a3b8"
                className="font-medium"
              >
                {dateStr}
              </text>
            );
          })}

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

/**
 * Custom Channel breakdown chart
 */
export function ChannelDistributionChart({ messages }) {
  // Count counts of messages per channel
  const channels = { whatsapp: 0, sms: 0, email: 0, rcs: 0 };
  const attributedCount = { whatsapp: 0, sms: 0, email: 0, rcs: 0 };
  
  (messages || []).forEach(m => {
    const ch = String(m.channel || 'sms').toLowerCase();
    if (ch in channels) {
      channels[ch]++;
      if (m.status === 'attributed') {
        attributedCount[ch]++;
      }
    }
  });

  const total = Object.values(channels).reduce((a, b) => a + b, 0) || 1;

  const channelInfo = [
    { label: 'WhatsApp', key: 'whatsapp', color: 'bg-emerald-500', count: channels.whatsapp, conv: attributedCount.whatsapp },
    { label: 'SMS', key: 'sms', color: 'bg-blue-500', count: channels.sms, conv: attributedCount.sms },
    { label: 'Email', key: 'email', color: 'bg-purple-500', count: channels.email, conv: attributedCount.email },
    { label: 'RCS', key: 'rcs', color: 'bg-amber-500', count: channels.rcs, conv: attributedCount.rcs }
  ];

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-6">Channel Performance</h3>
      <div className="space-y-5">
        {channelInfo.map(ch => {
          const percent = (ch.count / total) * 100;
          return (
            <div key={ch.label}>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${ch.color}`}></span>
                  <span>{ch.label}</span>
                </div>
                <div className="font-semibold text-slate-900">
                  {ch.count} <span className="text-slate-400 font-normal">({percent.toFixed(0)}%)</span>
                  {ch.count > 0 && (
                    <span className="ml-2 text-rose-500 text-[10px] font-bold">
                      {( (ch.conv / ch.count) * 100 ).toFixed(0)}% ROI
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                <div 
                  className={`h-full ${ch.color} rounded-full transition-all duration-500`} 
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
