
import { Lead } from "../../../types";
import {
  TrendingUp,
  Phone,
  Clock,
  Target,
  Activity,
  MoreHorizontal,
  Filter,
  Search,
  Briefcase,
  Wallet,
  ArrowRightLeft,
  ArrowDownToLine
} from "lucide-react";

interface CallLog {
  id: string;
  lead_id: string;
  duration_seconds: number;
  transcript: string;
  status: string;
  created_at: string;
  lead_name: string | null;
  lead_company: string | null;
}

interface DashboardHomeProps {
  leads: Lead[];
  callLogs: CallLog[];
  onViewLead: (lead: Lead) => void;
  onDial: (lead: Lead) => void;
  onNavigate: (page: string) => void;
  addToast?: (type: "success" | "error" | "info" | "warning", message: string) => void;
}

export function DashboardHome({ leads, callLogs, onViewLead: _onViewLead, onDial: _onDial, onNavigate, addToast }: DashboardHomeProps) {
  // Stats
  const outbound = leads.filter(l => l.status === "Outbound Call").length;
  const closed = leads.filter(l => l.status === "Closed").length;
  const totalLeads = leads.length;

  const totalCalls = callLogs.length;
  const successCalls = callLogs.filter(c => c.status === "Success").length;
  const successRate = totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0;
  const totalTalkSecs = callLogs.reduce((s, c) => s + c.duration_seconds, 0);
  const avgDuration = totalCalls > 0 ? Math.round(totalTalkSecs / totalCalls) : 0;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hotLeads = [...leads]
    .filter(l => l.status !== "Closed")
    .sort((a, b) => b.score - a.score)
    .slice(0, 2); // Get top 2 for the "Cards" view

  const recentCalls = callLogs.slice(0, 6);

  // Bar chart reflecting actual pipeline distribution
  const statusCounts: Record<string, number> = {};
  leads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });
  const barData = [
    { label: "Discovery", active: statusCounts["Discovery"] || 0, closed: 0 },
    { label: "Outbound", active: statusCounts["Outbound Call"] || 0, closed: 0 },
    { label: "Audit", active: statusCounts["Audit Requested"] || 0, closed: 0 },
    { label: "Closed", active: 0, closed: statusCounts["Closed"] || 0 },
  ];
  const barMax = Math.max(1, ...barData.map(d => d.active + d.closed));

  return (
    <div className="flex flex-col w-full max-w-[1500px] mx-auto py-8 transition-all duration-300 px-4 md:px-8">
      
      {/* ── Welcome Header ── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#171717] flex items-center gap-2">
            Good morning, Sales Lead
          </h1>
          <p className="text-[#6B7280] mt-1 text-[14px]">Stay on top of your tasks, monitor progress, and track status.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── LEFT COLUMN (Approx 3.5/12) ── */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
          
          {/* Pipeline Volume (Matches Total Balance) */}
          <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-[#F0F0F0]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#6B7280] text-[15px] font-medium">Pipeline Volume</span>
              <div className="flex items-center gap-1.5 bg-[#F4F5F7] px-2.5 py-1 rounded-full text-[12px] font-semibold text-[#171717]">
                <Briefcase className="w-3.5 h-3.5 text-[#3B82F6]" />
                Volume
              </div>
            </div>
            <div className="text-[38px] font-extrabold text-[#171717] tracking-tight mb-2">
              {totalLeads} <span className="text-[18px] text-[#A1A1AA] font-medium tracking-normal">leads</span>
            </div>
            
            <div className="flex items-center gap-2 mb-8">
              <span className="bg-[#ECFDF5] text-[#10B981] px-2 py-0.5 rounded flex items-center text-[12px] font-bold">
                {leads.length} active
              </span>
              <span className="text-[#A1A1AA] text-[13px] font-medium">across pipeline</span>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => onNavigate("hunter")}
                className="flex-1 bg-[#1A1D20] text-white rounded-full py-3 text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#2D3136] transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" /> Import
              </button>
              <button 
                onClick={() => {
                  const csv = [["Name","Company","Phone","Status","Score"].join(","),
                    ...leads.map(l => [l.name,l.company,l.phone,l.status,l.score].join(","))
                  ].join("\n");
                  const blob = new Blob([csv], {type: "text/csv"});
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "opencloser_leads.csv"; a.click();
                  URL.revokeObjectURL(url);
                  addToast?.("success", "Leads exported as CSV");
                }}
                className="flex-1 bg-white border border-[#E0E0E0] text-[#171717] rounded-full py-3 text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#F4F5F7] transition-colors">
                <ArrowDownToLine className="w-4 h-4" /> Export
              </button>
            </div>
          </div>

          {/* Funnel Health (Matches Monthly Spending Limit) */}
          <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-[#F0F0F0]">
            <div className="text-[#171717] text-[15px] font-bold mb-4">Dialer Capacity</div>
            
            <div className="w-full h-2.5 bg-[#F4F5F7] rounded-full overflow-hidden mb-3 flex">
              <div className="h-full bg-[#FF5C39]" style={{ width: '25%' }}></div>
              <div className="h-full bg-repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,92,57,0.1) 4px, rgba(255,92,57,0.1) 8px)" style={{ width: '75%' }}></div>
            </div>
            
            <div className="flex items-center justify-between text-[13px] font-semibold text-[#171717]">
              <span>{outbound} active</span>
              <span className="text-[#A1A1AA]">100 limit</span>
            </div>
          </div>

          {/* Priority Targets (Matches My Cards) */}
          <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-[#F0F0F0]">
            <div className="flex items-center justify-between mb-5">
              <div className="text-[#171717] text-[15px] font-bold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#A1A1AA]" />
                Priority Targets
              </div>
              <button 
                onClick={() => onNavigate("hunter")}
                className="text-[#6B7280] text-[13px] font-semibold hover:text-[#171717] flex items-center gap-1 bg-[#F4F5F7] px-3 py-1.5 rounded-full"
              >
                + Add new
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar -mx-2 px-2 snap-x">
              {/* Dark Card */}
              <div className="min-w-[220px] h-[140px] bg-[#1A1D20] text-white rounded-[20px] p-4 flex flex-col justify-between relative overflow-hidden shrink-0 snap-start shadow-[0_8px_24px_rgba(26,29,32,0.25)] hover:scale-[1.02] transition-transform cursor-pointer">
                {/* Decorative squares */}
                <div className="absolute top-4 right-4 w-12 h-12 bg-white/[0.03] rounded-lg"></div>
                <div className="absolute top-8 right-12 w-16 h-16 bg-white/[0.02] rounded-lg"></div>
                
                <div className="flex items-center justify-between">
                  <span className="bg-white/10 text-white px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white opacity-60"></span>
                    Hot Lead
                  </span>
                  {/* Master card logo mock */}
                  <div className="flex relative items-center justify-center opacity-80 mix-blend-screen overflow-hidden w-8 h-5">
                     <div className="w-5 h-5 bg-[#FF5C39] rounded-full absolute left-0"></div>
                     <div className="w-5 h-5 bg-[#F59E0B] rounded-full absolute right-0 mix-blend-multiply"></div>
                  </div>
                </div>

                <div className="flex items-end justify-between mt-auto">
                  <div>
                    <div className="text-[10px] text-white/50 mb-0.5">Target Company</div>
                    <div className="font-mono text-[14px] font-bold tracking-wider">{hotLeads[0]?.company || "N/A"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-white/50 mb-0.5">Score</div>
                    <div className="font-mono text-[14px] font-bold">{hotLeads[0]?.score || "0"}</div>
                  </div>
                </div>
              </div>

              {/* Coral Card */}
              <div className="min-w-[180px] h-[140px] bg-gradient-to-br from-[#FF6B4A] to-[#FF451A] text-white rounded-[20px] p-4 flex flex-col justify-between relative overflow-hidden shrink-0 snap-start shadow-[0_8px_24px_rgba(255,92,57,0.25)] hover:scale-[1.02] transition-transform cursor-pointer">
                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                
                <div className="flex items-center justify-between">
                  <span className="bg-white/20 text-white px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
                     <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80 shadow-[0_0_8px_rgba(255,255,255,0.8)]"></span>
                    Warm
                  </span>
                </div>

                <div className="flex items-end justify-between mt-auto">
                  <div>
                    <div className="text-[10px] text-white/60 mb-0.5">Target Company</div>
                    <div className="font-mono text-[14px] font-bold tracking-wider">{hotLeads[1]?.company || "N/A"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── MIDDLE & RIGHT COLUMNS (Approx 8.5/12) ── */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
          
          {/* Top Row: 2x2 Stats Grid + Bar Chart */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            
            {/* 2x2 Stats Grid taking 3 cols */}
            <div className="xl:col-span-3 grid grid-cols-2 gap-4 md:gap-6">
              
              {/* Card 1: Success Rate (Orange Solid) */}
              <div className="bg-gradient-to-br from-[#FF6B4A] to-[#FF451A] rounded-[24px] p-5 shadow-[0_8px_24px_rgba(255,92,57,0.25)] flex flex-col justify-between aspect-[1.4/1] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <div className="flex justify-between items-start relative">
                  <span className="text-white/90 text-[14px] font-semibold">Success Rate</span>
                  <div className="p-2 bg-white/10 rounded-xl group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="relative">
                  <div className="text-[36px] font-extrabold text-white mb-2 leading-none">{successRate}%</div>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-white/20 text-white text-[11px] font-bold px-1.5 py-0.5 rounded">
                      {totalCalls} calls
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Outbound Calls (White) */}
              <div className="bg-white rounded-[24px] p-5 border border-[#F0F0F0] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between aspect-[1.4/1] hover:border-[#E0E0E0] transition-colors group">
                <div className="flex justify-between items-start">
                  <span className="text-[#6B7280] text-[14px] font-semibold">Outbound Calls</span>
                  <div className="p-2 bg-[#F4F5F7] rounded-xl group-hover:bg-[#E9ECEF] transition-colors">
                    <Phone className="w-4 h-4 text-[#171717]" />
                  </div>
                </div>
                <div>
                  <div className="text-[36px] font-extrabold text-[#171717] mb-2 leading-none">{totalCalls}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-[#F4F5F7] text-[#171717] text-[11px] font-bold px-1.5 py-0.5 rounded">
                      {totalCalls} calls
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Avg Duration (White) */}
              <div className="bg-white rounded-[24px] p-5 border border-[#F0F0F0] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between aspect-[1.4/1] hover:border-[#E0E0E0] transition-colors group">
                <div className="flex justify-between items-start">
                  <span className="text-[#6B7280] text-[14px] font-semibold">Call Duration</span>
                  <div className="p-2 bg-[#F4F5F7] rounded-xl group-hover:bg-[#E9ECEF] transition-colors">
                    <Clock className="w-4 h-4 text-[#171717]" />
                  </div>
                </div>
                <div>
                  <div className="text-[36px] font-extrabold text-[#171717] mb-2 leading-none">{formatDuration(avgDuration)}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-[#F4F5F7] text-[#171717] text-[11px] font-bold px-1.5 py-0.5 rounded">
                      {totalCalls} sessions
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Closed Won (White) */}
              <div className="bg-white rounded-[24px] p-5 border border-[#F0F0F0] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between aspect-[1.4/1] hover:border-[#E0E0E0] transition-colors group">
                <div className="flex justify-between items-start">
                  <span className="text-[#6B7280] text-[14px] font-semibold">Deals Closed</span>
                  <div className="p-2 bg-[#F4F5F7] rounded-xl group-hover:bg-[#E9ECEF] transition-colors">
                    <Target className="w-4 h-4 text-[#171717]" />
                  </div>
                </div>
                <div>
                  <div className="text-[36px] font-extrabold text-[#171717] mb-2 leading-none">{closed}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-[#F4F5F7] text-[#171717] text-[11px] font-bold px-1.5 py-0.5 rounded">
                      {closed} won
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Bar Chart taking 2 cols */}
            <div className="xl:col-span-2 bg-white rounded-[24px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-[#F0F0F0] flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[#171717] text-[16px] font-bold">Pipeline Status</h3>
                <button className="text-[#A1A1AA] opacity-50" disabled><MoreHorizontal className="w-5 h-5" /></button>
              </div>
               <p className="text-[#A1A1AA] text-[13px] font-medium mb-6">Distribution across pipeline stages</p>

               <div className="flex items-center justify-end gap-4 mb-6">
                 <div className="flex items-center gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-[#FF5C39]"></div>
                   <span className="text-[12px] font-bold text-[#6B7280]">Active</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></div>
                   <span className="text-[12px] font-bold text-[#6B7280]">Won</span>
                 </div>
               </div>

              {/* Chart Grid Area */}
              <div className="relative flex-1 flex items-end justify-between px-2 min-h-[140px]">
                {/* Horizontal grid lines */}
                <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col justify-between pointer-events-none">
                  {[barMax, Math.ceil(barMax*0.75), Math.ceil(barMax*0.5), Math.ceil(barMax*0.25), 0].map(val => (
                    <div key={val} className="w-full border-b border-dashed border-[#E9ECEF] flex items-end">
                      <span className="absolute -left-4 text-[10px] font-bold text-[#A1A1AA] transform -translate-y-1.5">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Bars */}
                {barData.map((data, i) => (
                  <div key={i} className="relative z-10 w-[45px] flex flex-col justify-end items-center gap-1 group cursor-pointer h-full">
                    {/* Tooltip */}
                    <div className="absolute -top-8 bg-[#1A1D20] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {data.active + data.closed} leads
                    </div>
                    <div className="w-full flex flex-col justify-end items-center gap-1" style={{ height: "100%" }}>
                      {data.closed > 0 && <div className="w-full rounded-t-lg transition-all duration-300 bg-[#10B981]" style={{ height: `${(data.closed / barMax) * 100}%` }}></div>}
                      {data.active > 0 && <div className="w-full rounded-t-lg transition-all duration-300 bg-[#FF5C39]" style={{ height: `${(data.active / barMax) * 100}%` }}></div>}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* X Axis labels */}
              <div className="flex justify-between px-2 mt-4 text-[#A1A1AA] text-[11px] font-bold">
                {barData.map(d => <div key={d.label}>{d.label}</div>)}
              </div>
            </div>
          </div>

          {/* ── Recent Activities Table ── */}
          <div className="bg-white rounded-[24px] p-2 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-[#F0F0F0] overflow-hidden flex-1 flex flex-col mt-2">
             
             {/* Table Header Controls */}
             <div className="px-5 py-4 flex items-center justify-between border-b border-[#F0F0F0]">
                <h3 className="text-[#171717] text-[16px] font-bold">Recent Activities</h3>
                <div className="flex items-center gap-3">
              <div className="relative">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
                 <input 
                    type="text" 
                    placeholder="Search"
                    className="bg-[#F4F5F7] border border-transparent rounded-full pl-9 pr-4 py-2 text-[13px] font-medium outline-none focus:border-[#E0E0E0] focus:bg-white transition-colors w-[180px] opacity-50" 
                    disabled
                 />
              </div>
              <button className="flex items-center gap-2 bg-[#F4F5F7] px-4 py-2 rounded-full text-[13px] font-bold text-[#A1A1AA] opacity-50" disabled>
                 Filter <Filter className="w-3.5 h-3.5" />
              </button>
                </div>
             </div>

             {/* Table Content */}
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="text-[#A1A1AA] text-[12px] font-semibold border-b border-[#F0F0F0] bg-white">
                          <th className="px-4 py-3 w-12 text-center"><input type="checkbox" className="rounded border-[#E0E0E0] text-[#FF5C39] focus:ring-[#FF5C39]" /></th>
                          <th className="px-4 py-3 font-medium">Lead</th>
                          <th className="px-4 py-3 font-medium">Company</th>
                          <th className="px-4 py-3 font-medium">Duration</th>
                          <th className="px-4 py-3 font-medium">Outcome</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 w-12 text-center"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-[#F0F0F0]/50">
                      {recentCalls.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-10 text-center text-[#A1A1AA] font-medium text-[14px]">No activities yet</td></tr>
                      ) : (
                        recentCalls.map((call, i) => (
                           <tr key={call.id} className="hover:bg-[#F9FAFB] transition-colors group">
                              <td className="px-4 py-4 text-center">
                                 <input type="checkbox" defaultChecked={i===3} className={`rounded border-[#E0E0E0] ${i===3 ? 'text-[#1A1D20]' : 'text-[#FF5C39]'} focus:ring-0 cursor-pointer`} />
                              </td>
                              <td className="px-4 py-4 text-[#A1A1AA] font-mono text-[13px]">
                                 {call.lead_name || "Unknown Lead"}
                              </td>
                              <td className="px-4 py-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded shrink-0 bg-[#E0F2FE] flex items-center justify-center">
                                       <Activity className="w-3.5 h-3.5 text-[#0284C7]" />
                                    </div>
                                    <span className="font-bold text-[#171717] text-[13px]">{call.lead_company || "N/A"}</span>
                                 </div>
                              </td>
                              <td className="px-4 py-4 text-[#171717] font-bold text-[13px] font-mono">
                                 {formatDuration(call.duration_seconds)}
                              </td>
                              <td className="px-4 py-4">
                                 <div className="flex items-center gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${call.status === "Success" ? "bg-[#10B981]" : call.status === "Voicemail" ? "bg-[#F59E0B]" : "bg-[#EF4444]"}`}></div>
                                    <span className="text-[12px] font-bold text-[#171717]">
                                       {call.status}
                                    </span>
                                 </div>
                              </td>
                              <td className="px-4 py-4 text-[#A1A1AA] font-semibold text-[13px]">
                                 {new Date(call.created_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(call.created_at).toLocaleTimeString("en-US", { hour: '2-digit', minute:'2-digit' })}
                              </td>
                              <td className="px-4 py-4 text-center text-[#A1A1AA] opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button className="opacity-50" disabled><MoreHorizontal className="w-4 h-4" /></button>
                              </td>
                           </tr>
                        ))
                      )}
                   </tbody>
                </table>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
