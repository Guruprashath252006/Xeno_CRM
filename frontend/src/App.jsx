import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import CopilotSidebar from './components/CopilotSidebar';
import QueueMonitor from './components/QueueMonitor';
import { 
  FunnelChart, 
  SalesLineChart, 
  ChannelDistributionChart 
} from './components/Charts';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  useNavigate, 
  useLocation, 
  Navigate 
} from 'react-router-dom';
import { 
  Users, 
  ShoppingBag, 
  Megaphone, 
  Sliders, 
  Activity, 
  Settings, 
  Plus, 
  FileUp, 
  Sparkles, 
  RefreshCw, 
  Send,
  CheckCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  Percent,
  Mail,
  MessageSquare,
  Smartphone,
  PhoneCall,
  Trash2
} from 'lucide-react';

function AppContent() {
  const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://localhost:3001' : '');
  
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Set tab based on current route
  const activeTab = currentPath.substring(1) || 'dashboard';

  // Navigation Helper
  const handleTabChange = (tabName) => {
    navigate(`/${tabName}`);
  };

  const [copilotOpen, setCopilotOpen] = useState(false);

  // CRM Data States
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [keysStatus, setKeysStatus] = useState(null);
  
  // Loading & Action States
  const [refreshing, setRefreshing] = useState(false);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [compilingSegment, setCompilingSegment] = useState(false);
  
  // Selected Details State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Campaign Creator State
  const [campaignName, setCampaignName] = useState('Summer Flash Sale');
  const [campaignAudience, setCampaignAudience] = useState('seg_1'); // default to VIP
  const [campaignMessage, setCampaignMessage] = useState('Hi {{name}}, enjoy 20% off your next purchase! Use code SUMMER20. LTV: ${{lifetime_value}}');
  const [campaignChannel, setCampaignChannel] = useState('sms');
  const [campaignTone, setCampaignTone] = useState('friendly');
  const [campaignGoal, setCampaignGoal] = useState('offer 20% discount on summer apparel');

  // Segment Creator State
  const [newSegmentName, setNewSegmentName] = useState('High Spenders');
  const [segmentRules, setSegmentRules] = useState({
    type: 'condition',
    field: 'lifetime_value',
    operator: 'gt',
    value: 100
  });
  const [aiSegmentPrompt, setAiSegmentPrompt] = useState('customers who spent more than $200');
  const [previewMatches, setPreviewMatches] = useState({ totalCount: 0, matchCount: 0, customers: [] });

  // Load Initial Data
  const loadData = async () => {
    setRefreshing(true);
    try {
      const [cRes, oRes, mRes, campRes, segRes, keysRes] = await Promise.all([
        fetch(`${API_BASE}/api/customers`),
        fetch(`${API_BASE}/api/orders`),
        fetch(`${API_BASE}/api/messages`),
        fetch(`${API_BASE}/api/campaigns`),
        fetch(`${API_BASE}/api/segments`),
        fetch(`${API_BASE}/api/admin/api-keys`)
      ]);

      setCustomers(await cRes.json());
      setOrders(await oRes.json());
      setMessages(await mRes.json());
      setCampaigns(await campRes.json());
      setSegments(await segRes.json());
      setKeysStatus(await keysRes.json());
    } catch (err) {
      console.error('Failed loading CRM data', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Poll messages and orders every 3s to show real-time callback conversions
  useEffect(() => {
    const pollId = setInterval(async () => {
      try {
        const [mRes, oRes] = await Promise.all([
          fetch(`${API_BASE}/api/messages`),
          fetch(`${API_BASE}/api/orders`)
        ]);
        setMessages(await mRes.json());
        setOrders(await oRes.json());
      } catch (e) {
        console.warn('Poller failed', e);
      }
    }, 3000);
    return () => clearInterval(pollId);
  }, []);

  // Trigger segment rule preview evaluation
  const evaluatePreview = async (rulesToEvaluate) => {
    try {
      const res = await fetch(`${API_BASE}/api/segments/evaluate-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: rulesToEvaluate })
      });
      const previewData = await res.json();
      setPreviewMatches(previewData);
    } catch (e) {
      console.warn('Preview evaluation failed', e);
    }
  };

  // Run preview whenever rules change on the segments route
  useEffect(() => {
    if (activeTab === 'segments') {
      evaluatePreview(segmentRules);
    }
  }, [segmentRules, activeTab, customers]);

  // Clean Seed Database Helper
  const handleClearSeedDb = async () => {
    if (window.confirm('Are you sure you want to clear the database and load seed mockup shopper data?')) {
      try {
        await fetch(`${API_BASE}/api/admin/clear-db`, { method: 'POST' });
        await loadData();
        alert('Database re-seeded successfully!');
      } catch (err) {
        alert('Error seeding database: ' + err.message);
      }
    }
  };

  // Campaign builder actions
  const handleCreateCampaign = async () => {
    if (!campaignName.trim() || !campaignMessage.trim()) {
      return alert('Please fill in campaign name and template.');
    }
    try {
      const body = { 
        name: campaignName, 
        audience: campaignAudience, 
        message: campaignMessage, 
        channel: campaignChannel 
      };
      const res = await fetch(`${API_BASE}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const created = await res.json();
      
      setCampaigns(prev => [...prev, created]);
      alert(`Campaign "${created.name}" created successfully! Now launch it to begin delivery.`);
      loadData();
    } catch (err) {
      alert('Failed creating campaign: ' + err.message);
    }
  };

  const handleLaunchCampaign = async (campaignId) => {
    try {
      await fetch(`${API_BASE}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId })
      });
      alert('Campaign launch initiated! Delivery queue started.');
      handleTabChange('logs');
      loadData();
    } catch (err) {
      alert('Launch failed: ' + err.message);
    }
  };

  const handleSuggestMessage = async () => {
    setAiDrafting(true);
    try {
      const sample = customers.find(c => c.lifetime_value > 50) || customers[0] || null;
      const res = await fetch(`${API_BASE}/api/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: campaignGoal,
          sampleCustomer: sample,
          tone: campaignTone,
          channel: campaignChannel
        })
      });
      const data = await res.json();
      if (data.suggestion) {
        setCampaignMessage(data.suggestion);
      }
    } catch (err) {
      alert('AI draft failed: ' + err.message);
    } finally {
      setAiDrafting(false);
    }
  };

  // Segment manager actions
  const handleSaveSegment = async () => {
    if (!newSegmentName.trim()) return alert('Please input a segment name.');
    try {
      const res = await fetch(`${API_BASE}/api/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSegmentName, rule: segmentRules })
      });
      const saved = await res.json();
      setSegments(prev => [...prev, saved]);
      alert(`Segment "${saved.name}" saved!`);
      setNewSegmentName('');
    } catch (err) {
      alert('Save segment failed: ' + err.message);
    }
  };

  const handleDeleteSegment = async (id) => {
    if (confirm('Delete this segment?')) {
      try {
        await fetch(`${API_BASE}/api/segments/${id}`, { method: 'DELETE' });
        setSegments(prev => prev.filter(s => s.id !== id));
      } catch (e) {
        alert('Delete failed');
      }
    }
  };

  const handleCompileSegmentWithAI = async () => {
    if (!aiSegmentPrompt.trim()) return;
    setCompilingSegment(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/compile-segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiSegmentPrompt })
      });
      const data = await res.json();
      if (data.rule) {
        setSegmentRules(data.rule);
      }
    } catch (err) {
      alert('AI compile segment failed: ' + err.message);
    } finally {
      setCompilingSegment(false);
    }
  };

  // Retry message queue callback
  const handleRetryMessage = async (id) => {
    try {
      await fetch(`${API_BASE}/api/messages/${id}/retry`, { method: 'POST' });
    } catch (e) {
      alert('Retry failed');
    }
  };

  // CSV Parsing and Ingestion helpers
  const parseCsvText = (text) => {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cols[i] });
      return obj;
    });
  };

  const handleCustomerCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsedRows = parseCsvText(text).map(r => ({
        id: r.id || undefined,
        name: r.name,
        email: r.email,
        phone: r.phone,
        lifetime_value: Number(r.lifetime_value || r.ltv || 0)
      }));
      
      const res = await fetch(`${API_BASE}/api/import/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: parsedRows })
      });
      const result = await res.json();
      alert(`Successfully imported ${result.imported} customer records!`);
      loadData();
    } catch (err) {
      alert('Failed parsing CSV: ' + err.message);
    }
  };

  const handleOrdersCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsedRows = parseCsvText(text).map(r => ({
        id: r.id || undefined,
        customer_id: r.customer_id || r.customerid,
        amount: Number(r.amount || 0),
        created_at: r.created_at || r.date || new Date().toISOString()
      }));
      
      const res = await fetch(`${API_BASE}/api/import/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: parsedRows })
      });
      const result = await res.json();
      alert(`Successfully imported ${result.imported} order transactions!`);
      loadData();
    } catch (err) {
      alert('Failed parsing CSV: ' + err.message);
    }
  };

  // Dashboard calculations
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const avgOrderValue = orders.length > 0 ? (totalRevenue / orders.length) : 0;
  
  // Calculate delivery conversion funnel statistics
  const funnelStats = {
    sent: messages.length,
    delivered: messages.filter(m => ['delivered', 'opened', 'clicked', 'attributed'].includes(m.status)).length,
    opened: messages.filter(m => ['opened', 'clicked', 'attributed'].includes(m.status)).length,
    clicked: messages.filter(m => ['clicked', 'attributed'].includes(m.status)).length,
    attributed: messages.filter(m => m.status === 'attributed').length
  };

  // Channel Icon Resolver
  const getChannelIcon = (ch, size = 14) => {
    switch(String(ch).toLowerCase()) {
      case 'whatsapp': return <PhoneCall size={size} className="text-emerald-500" />;
      case 'sms': return <Smartphone size={size} className="text-blue-500" />;
      case 'email': return <Mail size={size} className="text-purple-500" />;
      case 'rcs': return <MessageSquare size={size} className="text-amber-500" />;
      default: return <Megaphone size={size} />;
    }
  };

  // Structured query editor logic
  const handleRuleFieldChange = (val) => {
    setSegmentRules(prev => ({ ...prev, field: val }));
  };
  const handleRuleOperatorChange = (val) => {
    setSegmentRules(prev => ({ ...prev, operator: val }));
  };
  const handleRuleValueChange = (val) => {
    const numericFields = ['lifetime_value', 'order_count', 'total_spent', 'last_order_days'];
    const isNum = numericFields.includes(segmentRules.field) && !isNaN(val) && val !== '';
    setSegmentRules(prev => ({ ...prev, value: isNum ? Number(val) : val }));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      <Header 
        onToggleCopilot={() => setCopilotOpen(!copilotOpen)} 
        copilotOpen={copilotOpen} 
        keysStatus={keysStatus}
      />
      
      <div className="max-w-7xl mx-auto px-6 py-8 app-container flex-1 w-full grid grid-cols-12 gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 space-y-2">
          <nav className="space-y-1">
            <button 
              onClick={() => handleTabChange('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'dashboard' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <TrendingUp size={16} />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => handleTabChange('shoppers')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'shoppers' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users size={16} />
              <span>Shopper Directory</span>
            </button>
            <button 
              onClick={() => handleTabChange('campaigns')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'campaigns' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Megaphone size={16} />
              <span>Campaign Studio</span>
            </button>
            <button 
              onClick={() => handleTabChange('segments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'segments' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Sliders size={16} />
              <span>Segments Builder</span>
            </button>
            <button 
              onClick={() => handleTabChange('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'logs' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Activity size={16} />
              <span>Queue Monitor</span>
            </button>
            <button 
              onClick={() => handleTabChange('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'settings' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </nav>

          <div className="pt-4 border-t border-slate-200/60 text-[10px] text-slate-400 font-medium px-4">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>CRM API Active</span>
            </div>
            <div className="mt-1">Connected: localhost:3001</div>
          </div>
        </aside>

        {/* Main Workspace Area Router Container */}
        <main className="col-span-12 md:col-span-9 lg:col-span-10 min-h-[500px]">
          <div key={activeTab}>
            <Routes>
              {/* Default Redirect to Dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Route 1: Dashboard & Analytics */}
              <Route path="/dashboard" element={
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 card-hover">
                      <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><Users size={20}/></div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Shoppers</span>
                        <h3 className="text-xl font-bold text-slate-800">{customers.length}</h3>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 card-hover">
                      <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><ShoppingBag size={20}/></div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
                        <h3 className="text-xl font-bold text-slate-800">{orders.length}</h3>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 card-hover">
                      <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><TrendingUp size={20}/></div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attributed Revenue</span>
                        <h3 className="text-xl font-bold text-slate-800">${totalRevenue.toLocaleString()}</h3>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 card-hover">
                      <div className="p-3 bg-purple-50 rounded-xl text-purple-600"><Percent size={20}/></div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Order Value</span>
                        <h3 className="text-xl font-bold text-slate-800">${avgOrderValue.toFixed(2)}</h3>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <FunnelChart stats={funnelStats} />
                    <SalesLineChart orders={orders} />
                    <div className="lg:col-span-2">
                      <ChannelDistributionChart messages={messages} />
                    </div>
                  </div>
                </div>
              } />

              {/* Route 2: Shoppers Directory */}
              <Route path="/shoppers" element={
                <div className="space-y-6 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">Shoppers Directory</h2>
                      <p className="text-xs text-slate-400">View customer database, order value logs, and ingest new CSV files.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95">
                        <FileUp size={14} className="text-slate-400" />
                        <span>Upload Customers CSV</span>
                        <input type="file" accept=".csv" onChange={handleCustomerCsvUpload} className="hidden" />
                      </label>
                      <label className="bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95">
                        <FileUp size={14} className="text-slate-400" />
                        <span>Upload Orders CSV</span>
                        <input type="file" accept=".csv" onChange={handleOrdersCsvUpload} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold">
                              <th className="p-4 uppercase">Shopper</th>
                              <th className="p-4 uppercase">Contact Info</th>
                              <th className="p-4 uppercase">Lifetime Value</th>
                              <th className="p-4 uppercase text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-600">
                            {customers.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="p-8 text-center text-slate-400">
                                  No shoppers loaded. Upload a CSV or seed the DB in Settings to start.
                                </td>
                              </tr>
                            ) : (
                              customers.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-4 font-semibold text-slate-800">{c.name}</td>
                                  <td className="p-4">
                                    <div className="font-mono text-[11px]">{c.email}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{c.phone}</div>
                                  </td>
                                  <td className="p-4 font-bold text-slate-700">${c.lifetime_value}</td>
                                  <td className="p-4 text-center">
                                    <button 
                                      onClick={() => setSelectedCustomer(c)}
                                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center justify-center gap-0.5 mx-auto"
                                    >
                                      Details <ChevronRight size={12}/>
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 min-h-[300px]">
                      <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-3">Shopper Transactions</h3>
                      
                      {selectedCustomer ? (
                        <div className="space-y-4">
                          <div>
                            <div className="font-bold text-slate-800">{selectedCustomer.name}</div>
                            <div className="text-xs text-slate-400 mt-1 font-mono">{selectedCustomer.email}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{selectedCustomer.phone}</div>
                          </div>
                          
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/50 flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-500">LTV Score:</span>
                            <span className="font-bold text-indigo-600 text-sm">${selectedCustomer.lifetime_value}</span>
                          </div>

                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Order History</span>
                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                              {orders.filter(o => o.customer_id === selectedCustomer.id).length === 0 ? (
                                <div className="text-xs text-slate-400 py-3 text-center">[ No orders attributed ]</div>
                              ) : (
                                orders.filter(o => o.customer_id === selectedCustomer.id).map(o => (
                                  <div key={o.id} className="p-2.5 bg-white rounded-lg border border-slate-100 text-xs flex justify-between items-center shadow-xs">
                                    <div>
                                      <div className="font-bold text-slate-700">${o.amount}</div>
                                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{o.id}</div>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-semibold">{o.created_at || 'Unknown'}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-xs text-slate-400 text-center">
                          Select a shopper in the directory list to display details.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              } />

              {/* Route 3: Campaigns Studio */}
              <Route path="/campaigns" element={
                <div className="space-y-8 animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                      <div>
                        <h2 className="text-base font-bold text-slate-800">Campaign Creation Studio</h2>
                        <p className="text-xs text-slate-400">Launch omni-channel campaigns using AI-generated text or custom templates.</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Campaign Name</label>
                          <input 
                            type="text" 
                            value={campaignName}
                            onChange={e => setCampaignName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800"
                            placeholder="e.g. VIP Spring Promo"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Audience Segment</label>
                          <select 
                            value={campaignAudience}
                            onChange={e => setCampaignAudience(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800"
                          >
                            <option value="lifetime_value>0">All Customers</option>
                            {segments.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Channel</label>
                            <select 
                              value={campaignChannel}
                              onChange={e => setCampaignChannel(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800"
                            >
                              <option value="sms">SMS</option>
                              <option value="whatsapp">WhatsApp</option>
                              <option value="email">Email</option>
                              <option value="rcs">RCS</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">AI Tone</label>
                            <select 
                              value={campaignTone}
                              onChange={e => setCampaignTone(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800"
                            >
                              <option value="friendly">Friendly & Casual</option>
                              <option value="professional">Professional</option>
                              <option value="urgent">Urgency & FOMO</option>
                              <option value="minimalist">Minimalist</option>
                            </select>
                          </div>
                        </div>

                        <div className="p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl space-y-2.5">
                          <div className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                            <Sparkles size={14} className="animate-pulse" />
                            AI Message Generator
                          </div>
                          <input 
                            type="text" 
                            value={campaignGoal}
                            onChange={e => setCampaignGoal(e.target.value)}
                            className="w-full bg-white border border-indigo-100 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                            placeholder="What should this message achieve? (e.g. promo discount)"
                          />
                          <button 
                            onClick={handleSuggestMessage}
                            disabled={aiDrafting}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm shadow-indigo-100 hover:scale-[1.01]"
                          >
                            {aiDrafting ? (
                              <>
                                <RefreshCw size={12} className="animate-spin" />
                                <span>Drafting Copy...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={12} />
                                <span>Draft Copy with AI</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Message Template
                          </label>
                          <textarea 
                            rows={4}
                            value={campaignMessage}
                            onChange={e => setCampaignMessage(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-800 font-mono"
                          />
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Supported variables: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{"{{name}}"}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{"{{lifetime_value}}"}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{"{{email}}"}</code>
                          </span>
                        </div>

                        <button 
                          onClick={handleCreateCampaign}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 hover:scale-[1.01] active:scale-[0.99] transition-all"
                        >
                          <Plus size={16} />
                          Create & Save Campaign Draft
                        </button>
                      </div>
                    </div>

                    <div className="lg:col-span-5 space-y-4">
                      <h3 className="text-sm font-semibold text-slate-800">Campaign Logs</h3>
                      
                      <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1 scrollbar-thin">
                        {campaigns.length === 0 ? (
                          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center text-xs text-slate-400">
                            No campaigns created yet.
                          </div>
                        ) : (
                          [...campaigns].reverse().map(camp => {
                            const campMsgs = messages.filter(m => m.campaignId === camp.id);
                            const campDelivered = campMsgs.filter(m => ['delivered', 'opened', 'clicked', 'attributed'].includes(m.status)).length;
                            const isLaunched = campMsgs.length > 0;
                            
                            return (
                              <div key={camp.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3.5">
                                <div className="flex justify-between items-start">
                                  <div className="space-y-1">
                                    <h4 className="font-bold text-slate-800 text-xs">{camp.name}</h4>
                                    <div className="text-[10px] text-slate-400 font-mono">{camp.id}</div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {getChannelIcon(camp.channel)}
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase">{camp.channel}</span>
                                  </div>
                                </div>
                                
                                <p className="text-xs text-slate-500 italic max-w-full bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                                  "{camp.message}"
                                </p>
                                
                                <div className="flex justify-between items-center text-xs">
                                  {isLaunched ? (
                                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                                      <CheckCircle size={12} />
                                      <span>Launched ({campMsgs.length} sent • {campDelivered} deliv)</span>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                      <Clock size={12} />
                                      <span>Draft</span>
                                    </div>
                                  )}

                                  {!isLaunched && (
                                    <button 
                                      onClick={() => handleLaunchCampaign(camp.id)}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center gap-1 transition-colors"
                                    >
                                      <Send size={10} /> Launch
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              } />

              {/* Route 4: Segments Builder */}
              <Route path="/segments" element={
                <div className="space-y-6 animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-7 space-y-6">
                      
                      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-lg space-y-4">
                        <div className="flex items-center gap-2">
                          <Sparkles size={18} className="animate-pulse text-indigo-200" />
                          <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-100">AI Segment Query Compiler</span>
                        </div>
                        <p className="text-xs text-indigo-100">Describe the shoppers you want to reach, and let the AI compile structured rules.</p>
                        
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={aiSegmentPrompt}
                            onChange={e => setAiSegmentPrompt(e.target.value)}
                            className="flex-1 bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-800 placeholder-indigo-200 border border-white/20 rounded-xl px-3.5 py-2 text-xs focus:outline-none transition-all"
                            placeholder="e.g. shoppers with LTV over 150 who made more than 2 orders"
                          />
                          <button 
                            onClick={handleCompileSegmentWithAI}
                            disabled={compilingSegment}
                            className="bg-white hover:bg-indigo-50 text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95 shrink-0 shadow-md disabled:opacity-50"
                          >
                            {compilingSegment ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            <span>Compile</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-3">Structured Rule Editor</h3>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Field</label>
                            <select 
                              value={segmentRules.field || 'lifetime_value'}
                              onChange={e => handleRuleFieldChange(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 font-medium"
                            >
                              <option value="lifetime_value">Lifetime Value ($)</option>
                              <option value="order_count">Order Count (transactions)</option>
                              <option value="total_spent">Total Spent ($)</option>
                              <option value="last_order_days">Days since last order</option>
                              <option value="name">Name</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Operator</label>
                            <select 
                              value={segmentRules.operator || 'gt'}
                              onChange={e => handleRuleOperatorChange(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 font-medium"
                            >
                              <option value="gt">Greater Than (&gt;)</option>
                              <option value="gte">Greater or Equal (&ge;)</option>
                              <option value="lt">Less Than (&lt;)</option>
                              <option value="lte">Less or Equal (&le;)</option>
                              <option value="eq">Equals (==)</option>
                              <option value="contains">Contains (text)</option>
                              <option value="in_last_days">Within last X days</option>
                              <option value="more_than_days">More than X days</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Value</label>
                            <input 
                              type="text" 
                              value={segmentRules.value ?? ''}
                              onChange={e => handleRuleValueChange(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800 font-semibold"
                            />
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs font-mono text-slate-500 overflow-x-auto">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1 font-sans">Active Query Representation:</span>
                          {JSON.stringify(segmentRules)}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                          <input 
                            type="text" 
                            value={newSegmentName}
                            onChange={e => setNewSegmentName(e.target.value)}
                            placeholder="Segment Name (e.g. Dormant VIPs)"
                            className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs focus:outline-none text-slate-800"
                          />
                          <button 
                            onClick={handleSaveSegment}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                          >
                            <Plus size={14} />
                            <span>Save Segment</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-3">Saved Demographics</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {segments.length === 0 ? (
                            <div className="col-span-2 text-xs text-slate-400 text-center py-4">No saved segments yet. Create one above!</div>
                          ) : (
                            segments.map(s => (
                              <div key={s.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex justify-between items-start gap-2 text-xs">
                                <div>
                                  <div className="font-bold text-slate-800">{s.name}</div>
                                  <div className="text-[10px] text-slate-400 mt-1 font-mono max-w-[180px] truncate">{JSON.stringify(s.rule)}</div>
                                </div>
                                <button 
                                  onClick={() => handleDeleteSegment(s.id)}
                                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold mt-0.5"
                                >
                                  Delete
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>

                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 min-h-[400px] flex flex-col">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">Real-Time Segment Matches</h3>
                        <p className="text-[11px] text-slate-400">See which shoppers match the filter representation instantly.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Audience Matched</span>
                          <span className="text-xl font-extrabold text-indigo-600 mt-1 block">{previewMatches.matchCount}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Customer Base</span>
                          <span className="text-xl font-extrabold text-slate-800 mt-1 block">{previewMatches.totalCount}</span>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-100 rounded-xl p-3 divide-y divide-slate-100 pr-1 scrollbar-thin">
                        {previewMatches.matchCount === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center">
                            No shoppers match the current filter rules.
                          </div>
                        ) : (
                          previewMatches.customers.map(c => (
                            <div key={c.id} className="py-2 first:pt-0 last:pb-0 text-xs flex justify-between items-center">
                              <div>
                                <span className="font-semibold text-slate-800">{c.name}</span>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.email}</div>
                              </div>
                              <span className="font-bold text-slate-600">${c.lifetime_value}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              } />

              {/* Route 5: Queue Monitor & Delivery Logs */}
              <Route path="/logs" element={
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Simulated Delivery Monitor</h2>
                    <p className="text-xs text-slate-400">Track campaign dispatches and trace asynchronous events returned by the channel service callback loop.</p>
                  </div>
                  <QueueMonitor 
                    messages={messages} 
                    onRetry={handleRetryMessage} 
                    onClearDb={handleClearSeedDb}
                    API_BASE={API_BASE}
                  />
                </div>
              } />

              {/* Route 6: Settings */}
              <Route path="/settings" element={
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6 max-w-xl animate-fade-in">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">System Settings & Admin API Config</h2>
                    <p className="text-xs text-slate-400">Configure LLM integrations and setup sandbox databases.</p>
                  </div>

                  <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">Loaded AI SDK Integrations</div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-500">Google Gemini API:</span>
                        {keysStatus?.geminiKeySet ? (
                          <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1 text-[10px]">
                            <CheckCircle size={10} /> Active ({keysStatus.geminiKeyMasked})
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-[10px]">
                            Not Set
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-500">OpenAI API Key:</span>
                        {keysStatus?.openaiKeySet ? (
                          <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1 text-[10px]">
                            <CheckCircle size={10} /> Active ({keysStatus.openaiKeyMasked})
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-[10px]">
                            Not Set
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 leading-normal border-t border-slate-200/60 pt-3">
                      <span className="font-bold">Instructions:</span> To configure keys, add <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-semibold text-slate-600">GEMINI_API_KEY=AIzaSy...</code> or <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-semibold text-slate-600">OPENAI_API_KEY=sk-...</code> to the <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-semibold text-slate-600">crm-backend/.env</code> file and restart the dev server.
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-800">Database Administration</div>
                    <p className="text-xs text-slate-400">Reset your database collections to seed initial mock VIP shoppers and frequency segment filters.</p>
                    <button 
                      onClick={handleClearSeedDb}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all border border-rose-100 shadow-sm"
                    >
                      <Trash2 size={14}/> Clear Database & Load Mock Seed
                    </button>
                  </div>
                </div>
              } />

              {/* Catch-all redirect to dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Floating Copilot Sidebar */}
      <CopilotSidebar 
        isOpen={copilotOpen} 
        onClose={() => setCopilotOpen(false)}
        API_BASE={API_BASE}
        onRefreshData={loadData}
        onSelectSegmentRule={(rule, name) => {
          setSegmentRules(rule);
          setNewSegmentName(name);
        }}
        onSelectTab={(tab) => handleTabChange(tab)}
      />

    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
