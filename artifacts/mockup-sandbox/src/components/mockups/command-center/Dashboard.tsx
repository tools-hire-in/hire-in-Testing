import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  CheckSquare,
  Ticket,
  ClipboardCheck,
  FileText,
  DollarSign,
  GraduationCap,
  TrendingUp,
  User,
  Search,
  Bell,
  MessageSquare,
  Settings,
  ArrowRight,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Users,
  Flag,
  Activity,
  Briefcase,
  Megaphone,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Clock3
} from 'lucide-react';

const COLORS = {
  bg: '#0B1220',
  cardBg: '#131C2E',
  cardBorder: 'rgba(232, 237, 246, 0.08)',
  navy: '#1F3A6E',
  orange: '#F47C20',
  orangeHot: '#F96D3E',
  textPrimary: '#E8EDF6',
  textSecondary: '#8A97AD',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  slate: '#64748B',
  white: '#FFFFFF'
};

// --- Subcomponents ---

function Avatar({ initials, src, size = 32, className = '' }: { initials?: string; src?: string; size?: number; className?: string }) {
  return (
    <div 
      className={`rounded-full flex items-center justify-center font-medium overflow-hidden shrink-0 ${className}`}
      style={{ 
        width: size, 
        height: size, 
        backgroundColor: COLORS.navy,
        color: COLORS.white,
        fontSize: size * 0.4
      }}
    >
      {src ? <img src={src} alt="Avatar" className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

function Ring({ size = 48, strokeWidth = 4, progress = 0, color = COLORS.orange, trackColor = 'rgba(138, 151, 173, 0.2)' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function StatCard({ title, children, footer, className = '' }: { title: string; children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return (
    <div 
      className={`rounded-2xl p-5 flex flex-col justify-between ${className}`}
      style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-[10px] font-bold tracking-wider mb-4" style={{ color: COLORS.textSecondary }}>{title}</h3>
        <div className="flex-1">
          {children}
        </div>
      </div>
      {footer && (
        <div className="mt-4 pt-3 flex items-center text-xs font-medium cursor-pointer" style={{ borderTop: `1px solid ${COLORS.cardBorder}`, color: COLORS.orange }}>
          {footer} <ArrowRight size={12} className="ml-1" />
        </div>
      )}
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false, badge }: { icon: any; label: string; active?: boolean; badge?: number }) {
  return (
    <div 
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors group mb-1`}
      style={{ 
        backgroundColor: active ? COLORS.navy : 'transparent',
        color: active ? COLORS.white : COLORS.textSecondary,
      }}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} style={{ color: active ? COLORS.orange : COLORS.textSecondary }} className="group-hover:text-[#F47C20] transition-colors" />
        <span className="text-sm font-medium group-hover:text-white transition-colors">{label}</span>
      </div>
      {badge && (
        <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center justify-center" style={{ backgroundColor: COLORS.orange, color: COLORS.white }}>
          {badge}
        </div>
      )}
    </div>
  );
}

function QuickActionButton({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button 
      className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all hover:brightness-110"
      style={{ backgroundColor: 'rgba(31, 58, 110, 0.4)', border: `1px solid ${COLORS.cardBorder}` }}
    >
      <Icon size={18} style={{ color: COLORS.orange }} />
      <span className="text-xs font-medium" style={{ color: COLORS.textPrimary }}>{label}</span>
    </button>
  );
}

export function Dashboard() {
  return (
    <div className="min-h-screen w-full font-sans flex overflow-hidden selection:bg-[#F47C20] selection:text-white" style={{ backgroundColor: COLORS.bg, color: COLORS.textPrimary }}>
      
      {/* LEFT SIDEBAR */}
      <div className="w-[240px] shrink-0 flex flex-col h-screen border-r sticky top-0" style={{ backgroundColor: COLORS.cardBg, borderColor: COLORS.cardBorder }}>
        <div className="p-6 pb-2">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg" style={{ background: `linear-gradient(135deg, ${COLORS.orange}, ${COLORS.orangeHot})`, color: COLORS.white }}>
              H
            </div>
            <span className="text-xl font-bold tracking-tight">Hire'in</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 scrollbar-hide">
          <NavItem icon={LayoutDashboard} label="Dashboard" active />
          <NavItem icon={Calendar} label="Attendance" />
          <NavItem icon={Clock} label="Shift Status" />
          <NavItem icon={CheckSquare} label="Tasks" />
          <NavItem icon={Ticket} label="Tickets & Requests" />
          <NavItem icon={ClipboardCheck} label="Approvals" badge={5} />
          <NavItem icon={FileText} label="Documents" />
          <NavItem icon={DollarSign} label="Payroll" />
          <NavItem icon={GraduationCap} label="Learning" />
          <NavItem icon={TrendingUp} label="Performance" />
          <NavItem icon={User} label="Profile" />

          <div className="mt-8 mb-4 px-3">
            <h4 className="text-[10px] font-bold tracking-wider mb-3" style={{ color: COLORS.textSecondary }}>QUICK ACTIONS</h4>
            <div className="grid grid-cols-2 gap-2">
              <QuickActionButton icon={Calendar} label="Req PTO" />
              <QuickActionButton icon={Clock3} label="Log Time" />
              <QuickActionButton icon={Ticket} label="Ticket" />
              <QuickActionButton icon={HelpCircle} label="Ask HR" />
            </div>
          </div>
        </div>

        <div className="p-4 border-t" style={{ borderColor: COLORS.cardBorder }}>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.green }}></div>
            <span className="text-xs font-medium" style={{ color: COLORS.green }}>All Systems Operational</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TOP BAR */}
        <header className="h-16 shrink-0 flex items-center justify-between px-8 border-b" style={{ backgroundColor: COLORS.bg, borderColor: COLORS.cardBorder }}>
          <h1 className="text-lg font-semibold">Employee Command Center</h1>
          
          <div className="flex items-center justify-center flex-1 max-w-md px-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: COLORS.textSecondary }} />
              <input 
                type="text" 
                placeholder="Search for anything..." 
                className="w-full pl-9 pr-12 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ 
                  backgroundColor: COLORS.cardBg, 
                  color: COLORS.textPrimary,
                  border: `1px solid ${COLORS.cardBorder}`
                }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: 'rgba(138, 151, 173, 0.2)', color: COLORS.textSecondary }}>
                ⌘K
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-4">
              <div className="relative cursor-pointer">
                <Bell size={18} style={{ color: COLORS.textSecondary }} className="hover:text-white transition-colors" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: COLORS.red, color: COLORS.white }}>7</span>
              </div>
              <div className="relative cursor-pointer">
                <MessageSquare size={18} style={{ color: COLORS.textSecondary }} className="hover:text-white transition-colors" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: COLORS.orange, color: COLORS.white }}>3</span>
              </div>
              <Settings size={18} style={{ color: COLORS.textSecondary }} className="cursor-pointer hover:text-white transition-colors" />
            </div>
            
            <div className="w-px h-6" style={{ backgroundColor: COLORS.cardBorder }}></div>
            
            <div className="flex items-center gap-3 cursor-pointer">
              <Avatar initials="AM" size={32} />
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight">Arjun Mehta</span>
                <span className="text-[10px] font-medium leading-tight" style={{ color: COLORS.textSecondary }}>Product Manager</span>
              </div>
              <ChevronDown size={14} style={{ color: COLORS.textSecondary }} />
            </div>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide pb-20">
          
          {/* GREETING ROW */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1">Good morning, Arjun 👋</h2>
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>Here's your operational overview for today.</p>
          </div>

          {/* TOP STAT ROW */}
          <div className="grid grid-cols-6 gap-4 mb-4">
            
            <StatCard title="TODAY'S ATTENDANCE" footer="View Attendance">
              <div className="flex justify-between items-center h-full">
                <div>
                  <div className="text-xl font-bold mb-0.5">09:02 AM</div>
                  <div className="text-xs mb-3" style={{ color: COLORS.textSecondary }}>May 15, 2025</div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.green }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.green }}></div>
                    Checked in
                  </div>
                </div>
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-[3px]" style={{ borderColor: COLORS.navy }}></div>
                  <User size={20} style={{ color: COLORS.textSecondary }} />
                </div>
              </div>
            </StatCard>

            <StatCard title="SHIFT STATUS" footer="View Schedule">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-sm font-bold">09:00 AM – 06:00 PM</div>
                  <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: COLORS.orange, color: COLORS.white }}>
                    LIVE
                  </div>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span style={{ color: COLORS.textPrimary }}>4h 17m elapsed</span>
                    <span style={{ color: COLORS.textSecondary }}>2h 43m remaining</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(138, 151, 173, 0.2)' }}>
                    <div className="h-full rounded-full" style={{ width: '60%', backgroundColor: COLORS.orange }}></div>
                  </div>
                </div>
              </div>
            </StatCard>

            <StatCard title="PTO BALANCE" footer="Request Time Off">
              <div className="flex items-center gap-4 h-full">
                <div className="relative shrink-0">
                  <Ring size={48} progress={75} color={COLORS.orange} />
                </div>
                <div className="flex flex-col">
                  <div className="text-lg font-bold mb-1 leading-tight">15.5 <span className="text-[10px] font-medium" style={{ color: COLORS.textSecondary }}>days available</span></div>
                  <div className="text-[9px] space-y-0.5" style={{ color: COLORS.textSecondary }}>
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.orange }}></div>15.5 Available</div>
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.navy }}></div>3.0 Scheduled</div>
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.amber }}></div>1.5 Pending</div>
                  </div>
                </div>
              </div>
            </StatCard>

            <StatCard title="PENDING APPROVALS" footer="Review All">
              <div className="flex items-center gap-4 h-full">
                <div className="relative shrink-0">
                  <Ring size={48} progress={30} color={COLORS.orange} />
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">5</div>
                </div>
                <div className="flex flex-col w-full">
                  <div className="text-xs font-bold mb-1.5 leading-tight text-white">awaiting your action</div>
                  <div className="text-[9px] space-y-1 w-full" style={{ color: COLORS.textSecondary }}>
                    <div className="flex items-center justify-between w-full"><span>Expense Report</span> <span className="px-1 rounded" style={{ background: COLORS.navy, color: COLORS.white }}>2</span></div>
                    <div className="flex items-center justify-between w-full"><span>Timesheet</span> <span className="px-1 rounded" style={{ background: COLORS.navy, color: COLORS.white }}>2</span></div>
                    <div className="flex items-center justify-between w-full"><span>PTO Requests</span> <span className="px-1 rounded" style={{ background: COLORS.navy, color: COLORS.white }}>1</span></div>
                  </div>
                </div>
              </div>
            </StatCard>

            <StatCard title="OPEN TICKETS" footer="View Desk">
              <div className="flex flex-col justify-between h-full">
                <div className="text-2xl font-bold leading-tight mb-2">3 <span className="text-[10px] font-medium" style={{ color: COLORS.textSecondary }}>need attention</span></div>
                <div className="text-[10px] space-y-1.5 w-full mt-auto" style={{ color: COLORS.textSecondary }}>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.red }}></div>IT Support</div> 
                    <span className="font-bold text-white">1</span>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.amber }}></div>Tool Requests</div> 
                    <span className="font-bold text-white">1</span>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.slate }}></div>Facilities</div> 
                    <span className="font-bold text-white">1</span>
                  </div>
                </div>
              </div>
            </StatCard>

            <StatCard title="TRAINING COMPLIANCE" footer="Go to Learning">
              <div className="flex flex-col items-center justify-center h-full pt-1">
                <div className="relative">
                  <Ring size={64} progress={92} color={COLORS.orange} strokeWidth={6} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-bold leading-none">92%</span>
                  </div>
                </div>
                <div className="text-[10px] font-medium mt-2 text-center" style={{ color: COLORS.textSecondary }}>Complete</div>
              </div>
            </StatCard>

          </div>

          {/* MIDDLE ROW */}
          <div className="grid grid-cols-12 gap-4 mb-4">
            
            {/* PRODUCTIVITY & GOALS */}
            <div className="col-span-5 rounded-2xl p-5 flex flex-col" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold tracking-wider" style={{ color: COLORS.textSecondary }}>PRODUCTIVITY & GOALS</h3>
                <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: 'rgba(138, 151, 173, 0.1)', color: COLORS.textPrimary }}>
                  This Quarter <ChevronDown size={10} />
                </div>
              </div>

              <div className="flex gap-6 mb-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="relative mb-2">
                    <Ring size={80} progress={68} color={COLORS.orange} strokeWidth={8} />
                    <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">68%</div>
                  </div>
                  <div className="text-[10px] text-center" style={{ color: COLORS.textSecondary }}>Goals Achieved</div>
                </div>
                
                <div className="flex-1 flex flex-col">
                  <div className="text-xs font-bold mb-2">Q2 OKRs Progress</div>
                  <div className="flex-1 relative w-full h-16 flex items-end">
                    {/* Inline SVG Chart */}
                    <svg viewBox="0 0 200 60" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLORS.orange} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={COLORS.orange} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0,50 L40,45 L80,30 L120,35 L160,15 L200,5 L200,60 L0,60 Z" fill="url(#areaGradient)" />
                      <polyline points="0,50 40,45 80,30 120,35 160,15 200,5" fill="none" stroke={COLORS.orange} strokeWidth="2" strokeLinejoin="round" />
                      <circle cx="200" cy="5" r="3" fill={COLORS.bg} stroke={COLORS.orange} strokeWidth="2" />
                    </svg>
                    <div className="absolute bottom-0 w-full flex justify-between text-[8px] mt-1" style={{ color: COLORS.textSecondary, transform: 'translateY(100%)' }}>
                      <span>Apr</span>
                      <span>May</span>
                      <span>Jun</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-3">
                <div className="text-[10px] font-bold tracking-wider mb-2" style={{ color: COLORS.textSecondary }}>GOALS</div>
                {[
                  { label: "Enhance User Onboarding Flow", val: 72 },
                  { label: "Increase NPS to 50+", val: 60 },
                  { label: "Launch Mobile Dashboard", val: 80 },
                  { label: "Automate Report Generation", val: 50 },
                ].map((g, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{g.label}</span>
                      <span style={{ color: COLORS.textSecondary }}>{g.val}%</span>
                    </div>
                    <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(138, 151, 173, 0.2)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${g.val}%`, backgroundColor: i === 2 ? COLORS.green : COLORS.navy }}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-3 flex items-center text-xs font-medium cursor-pointer" style={{ borderTop: `1px solid ${COLORS.cardBorder}`, color: COLORS.orange }}>
                View All Goals <ArrowRight size={12} className="ml-1" />
              </div>
            </div>

            {/* TEAM AVAILABILITY */}
            <div className="col-span-4 rounded-2xl p-5 flex flex-col" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-bold tracking-wider" style={{ color: COLORS.textSecondary }}>TEAM AVAILABILITY</h3>
                <div className="text-xs font-medium cursor-pointer flex items-center" style={{ color: COLORS.orange }}>
                  View Team <ArrowRight size={12} className="ml-1" />
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center">
                {/* Radial avatars mockup */}
                <div className="relative w-48 h-48 flex items-center justify-center my-4">
                  <div className="absolute inset-0 rounded-full border border-dashed" style={{ borderColor: COLORS.cardBorder }}></div>
                  <div className="absolute inset-4 rounded-full border border-dashed" style={{ borderColor: COLORS.cardBorder }}></div>
                  
                  {/* Center bubble */}
                  <div className="relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center shadow-lg" style={{ backgroundColor: COLORS.navy, border: `2px solid ${COLORS.cardBorder}` }}>
                    <span className="text-xl font-bold text-white leading-none mb-1">12</span>
                    <span className="text-[9px] text-center px-2 leading-tight" style={{ color: COLORS.textSecondary }}>Total Members</span>
                  </div>

                  {/* Avatars scattered in rings */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"><Avatar initials="SJ" size={28} className="ring-2 ring-[#0B1220] border-b-2 border-green-500" /></div>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"><Avatar initials="RV" size={28} className="ring-2 ring-[#0B1220] border-b-2 border-green-500" /></div>
                  <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2"><Avatar initials="AM" size={28} className="ring-2 ring-[#0B1220] border-b-2 border-amber-500" /></div>
                  <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2"><Avatar initials="PK" size={28} className="ring-2 ring-[#0B1220] border-b-2 border-slate-500" /></div>
                  
                  <div className="absolute top-6 left-6"><Avatar initials="TR" size={24} className="ring-2 ring-[#0B1220] border-b-2 border-green-500" /></div>
                  <div className="absolute top-6 right-6"><Avatar initials="LM" size={24} className="ring-2 ring-[#0B1220] border-b-2 border-green-500" /></div>
                  <div className="absolute bottom-6 left-6"><Avatar initials="NK" size={24} className="ring-2 ring-[#0B1220] border-b-2 border-amber-500" /></div>
                  <div className="absolute bottom-6 right-6"><Avatar initials="SR" size={24} className="ring-2 ring-[#0B1220] border-b-2 border-green-500" /></div>
                  <div className="absolute top-1/4 right-0"><Avatar initials="AB" size={20} className="ring-2 ring-[#0B1220] border-b-2 border-slate-500" /></div>
                  <div className="absolute bottom-1/4 left-0"><Avatar initials="CD" size={20} className="ring-2 ring-[#0B1220] border-b-2 border-red-500" /></div>
                  <div className="absolute bottom-0 right-1/4"><Avatar initials="EF" size={20} className="ring-2 ring-[#0B1220] border-b-2 border-green-500" /></div>
                </div>

                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] mt-auto w-full pt-4" style={{ color: COLORS.textPrimary }}>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> 7 Available</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div> 2 In a Meeting</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div> 1 Out of Office</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-500"></div> 2 Offline</div>
                </div>
              </div>
            </div>

            {/* TODAY'S SCHEDULE */}
            <div className="col-span-3 rounded-2xl p-5 flex flex-col" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[10px] font-bold tracking-wider" style={{ color: COLORS.textSecondary }}>TODAY'S SCHEDULE</h3>
                <div className="flex items-center gap-1 p-1 rounded-md" style={{ backgroundColor: 'rgba(138, 151, 173, 0.1)' }}>
                  <div className="p-1 rounded cursor-pointer" style={{ backgroundColor: COLORS.navy, color: COLORS.white }}><Calendar size={12} /></div>
                  <div className="p-1 rounded cursor-pointer text-[#8A97AD] hover:text-white"><Users size={12} /></div>
                  <div className="p-1 rounded cursor-pointer text-[#8A97AD] hover:text-white"><Flag size={12} /></div>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-4 relative">
                <div className="absolute left-1.5 top-2 bottom-2 w-px" style={{ backgroundColor: COLORS.cardBorder }}></div>
                
                {[
                  { time: "10:30 AM", title: "Product Sync", dur: "30m", loc: "Microsoft Teams", type: "meeting" },
                  { time: "12:00 PM", title: "Interview: Priya Sharma", dur: "45m", loc: "Zoom", type: "interview" },
                  { time: "02:00 PM", title: "Roadmap Review", dur: "1h", loc: "Conf Room A", type: "meeting" },
                  { time: "04:30 PM", title: "1:1 with Manager", dur: "30m", loc: "Microsoft Teams", type: "meeting" },
                ].map((ev, i) => (
                  <div key={i} className="flex gap-3 relative z-10">
                    <div className="w-3 h-3 rounded-full mt-1 shrink-0 ring-4 ring-[#131C2E]" style={{ backgroundColor: ev.type === 'interview' ? COLORS.orange : COLORS.navy }}></div>
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-bold text-white">{ev.time}</span>
                        <span className="text-[9px]" style={{ color: COLORS.textSecondary }}>{ev.dur}</span>
                      </div>
                      <span className="text-xs font-medium mb-0.5">{ev.title}</span>
                      <span className="text-[10px] flex items-center gap-1" style={{ color: COLORS.textSecondary }}>
                        <div className="w-1 h-1 rounded-full bg-slate-500"></div> {ev.loc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-3 flex items-center text-xs font-medium cursor-pointer" style={{ borderTop: `1px solid ${COLORS.cardBorder}`, color: COLORS.orange }}>
                View Full Calendar <ArrowRight size={12} className="ml-1" />
              </div>
            </div>

          </div>

          {/* BOTTOM ROW */}
          <div className="grid grid-cols-4 gap-4">
            
            {/* ANNOUNCEMENTS */}
            <div className="rounded-2xl p-5 flex flex-col" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[10px] font-bold tracking-wider" style={{ color: COLORS.textSecondary }}>ANNOUNCEMENTS</h3>
                <div className="text-xs font-medium cursor-pointer" style={{ color: COLORS.orange }}>View All</div>
              </div>
              
              <div className="flex flex-col gap-4">
                {[
                  { tag: "COMPANY", title: "Townhall: Q2 Business Update", desc: "Join us for the quarterly update from leadership.", date: "Today, 4 PM", color: COLORS.orange },
                  { tag: "POLICY", title: "Updated Remote Work Policy", desc: "Please review and acknowledge by Friday.", date: "May 12", color: COLORS.navy },
                  { tag: "EVENT", title: "Wellness Wednesday", desc: "Yoga session in the main cafeteria.", date: "May 10", color: COLORS.green },
                ].map((a, i) => (
                  <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl transition-colors hover:bg-[rgba(255,255,255,0.02)] border border-transparent hover:border-[rgba(255,255,255,0.05)] cursor-pointer">
                    <div className="flex justify-between items-start">
                      <span className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: `${a.color}20`, color: a.color }}>{a.tag}</span>
                      <span className="text-[9px]" style={{ color: COLORS.textSecondary }}>{a.date}</span>
                    </div>
                    <span className="text-xs font-bold text-white">{a.title}</span>
                    <span className="text-[10px] leading-snug line-clamp-1" style={{ color: COLORS.textSecondary }}>{a.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ACTIVITY FEED */}
            <div className="rounded-2xl p-5 flex flex-col" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[10px] font-bold tracking-wider" style={{ color: COLORS.textSecondary }}>ACTIVITY FEED</h3>
                <div className="text-xs font-medium cursor-pointer" style={{ color: COLORS.orange }}>View All</div>
              </div>

              <div className="flex flex-col gap-4">
                {[
                  { in: "NV", text: "Neha Verma submitted a PTO request", time: "2h ago" },
                  { in: "RS", text: "Rohan Singh completed 'Data Security Training'", time: "4h ago" },
                  { in: "AM", text: "You raised a ticket #TKT-4821", time: "5h ago", isSelf: true },
                  { in: "AR", text: "Anita Rao commented on Project Phoenix", time: "1d ago" },
                  { in: "FA", text: "Expense report #EXP-2211 approved by Finance", time: "1d ago" },
                ].map((feed, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <Avatar initials={feed.in} size={24} className={feed.isSelf ? 'bg-orange-500' : ''} />
                    <div className="flex flex-col">
                      <span className="text-xs leading-snug">
                        {feed.text.split(' ').map((word, j) => 
                          (j === 0 || j === 1 || word.includes('#') || word.includes("'")) && !feed.isSelf
                            ? <span key={j} className="text-white font-medium">{word} </span> 
                            : <span key={j} style={{ color: COLORS.textSecondary }}>{word} </span>
                        )}
                      </span>
                      <span className="text-[9px] mt-0.5" style={{ color: COLORS.textSecondary }}>{feed.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MY CALENDAR */}
            <div className="rounded-2xl p-5 flex flex-col" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold tracking-wider" style={{ color: COLORS.textSecondary }}>MY CALENDAR</h3>
                <div className="flex gap-1">
                  <ChevronLeft size={14} className="cursor-pointer hover:text-white" style={{ color: COLORS.textSecondary }} />
                  <ChevronRight size={14} className="cursor-pointer hover:text-white" style={{ color: COLORS.textSecondary }} />
                </div>
              </div>

              <div className="text-sm font-bold text-center mb-3">May 2025</div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] mb-2 font-bold" style={{ color: COLORS.textSecondary }}>
                <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {/* Empty days */}
                <div className="p-1"></div><div className="p-1"></div><div className="p-1"></div><div className="p-1"></div>
                {/* Days 1-31 */}
                {Array.from({ length: 31 }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === 15; // Adjusted to match mock data top card
                  const hasMeeting = [2, 5, 8, 12, 15, 18, 22, 26].includes(day);
                  const hasInterview = [10, 15, 20].includes(day);
                  
                  return (
                    <div 
                      key={i} 
                      className={`p-1.5 rounded-lg flex flex-col items-center justify-center relative cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors ${isToday ? 'font-bold' : ''}`}
                      style={isToday ? { backgroundColor: COLORS.orange, color: COLORS.white } : { color: COLORS.textPrimary }}
                    >
                      {day}
                      {(hasMeeting || hasInterview) && !isToday && (
                        <div className="absolute bottom-1 w-1 h-1 rounded-full" style={{ backgroundColor: hasInterview ? COLORS.orange : COLORS.navy }}></div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto pt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9px]" style={{ color: COLORS.textSecondary }}>
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.navy }}></div> Meetings</div>
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.orange }}></div> Interviews</div>
                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS.green }}></div> Events</div>
              </div>
            </div>

            {/* MY QUICK STATS */}
            <div className="rounded-2xl p-5 flex flex-col" style={{ backgroundColor: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[10px] font-bold tracking-wider" style={{ color: COLORS.textSecondary }}>MY QUICK STATS</h3>
                <div className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: 'rgba(138, 151, 173, 0.1)', color: COLORS.textPrimary }}>
                  This Month <ChevronDown size={10} />
                </div>
              </div>

              <div className="flex flex-col gap-4 flex-1 justify-center">
                {[
                  { icon: Clock, label: "Hours Worked", val: "92h 15m", points: "0,10 5,8 10,12 15,5 20,2 25,8 30,0" },
                  { icon: CheckSquare, label: "Tasks Completed", val: "38/50", points: "0,8 5,5 10,7 15,2 20,4 25,1 30,0" },
                  { icon: Ticket, label: "Tickets Resolved", val: "12", points: "0,10 10,10 15,5 20,8 25,2 30,2" },
                  { icon: TrendingUp, label: "Feedback Score", val: "4.6/5", points: "0,5 10,5 15,2 20,3 25,0 30,0" },
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl border" style={{ borderColor: COLORS.cardBorder, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(31, 58, 110, 0.4)', color: COLORS.orange }}>
                        <stat.icon size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px]" style={{ color: COLORS.textSecondary }}>{stat.label}</span>
                        <span className="text-xs font-bold">{stat.val}</span>
                      </div>
                    </div>
                    
                    <svg width="30" height="15" viewBox="0 0 30 15" className="ml-2 overflow-visible">
                      <polyline points={stat.points} fill="none" stroke={COLORS.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
