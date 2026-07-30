import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Sparkles,
  ClipboardList,
  ShoppingCart,
  Zap,
  Users,
  Building2,
  User,
  ChevronDown,
  FileText,
  DollarSign,
  BarChart3,
  PieChart,
  Settings,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Log activity ONLY on manual switch – with deduplication
  const logActivity = async (userId: string, userName: string, role: string) => {
    try {
      const { data: existing } = await supabase
        .from('activity_logs')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const lastLogTime = new Date(existing[0].created_at).getTime();
        const now = Date.now();
        if (now - lastLogTime < 10000) return;
      }

      await supabase.from('activity_logs').insert({
        user_id: userId,
        user_name: userName,
        action: 'Active',
        details: `${userName} (${role}) is viewing the platform`,
      });
    } catch (err) {
      console.error('Log activity error:', err);
    }
  };

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching users:', error);
          return;
        }

        if (data && data.length > 0) {
          setUsers(data);
          const admin = data.find(u => u.role === 'admin') || data[0];
          setSelectedUserId(admin.id);
          await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', admin.id);
        }
      } catch (err) {
        console.error('Load users error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const handleUserChange = async (userId: string) => {
    setSelectedUserId(userId);
    const user = users.find(u => u.id === userId);
    if (!user) return;

    await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', userId);
    await logActivity(userId, user.name, user.role);
    toast.success(`Viewing as ${user.name} (${user.role})`);
  };

  // 🔥 Navigation Items – more options
  const navItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/tenders', label: 'All Tenders', icon: <FileText size={18} /> },
    { to: '/upload', label: 'Upload Tender', icon: <Upload size={18} /> },
    { to: '/financials', label: 'Financials', icon: <DollarSign size={18} /> },
    { to: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { to: '/reports', label: 'Reports', icon: <PieChart size={18} /> },
  ];

  const adminItems: NavItem[] = [
    { to: '/admin', label: 'Admin', icon: <Users size={18} /> },
    { to: '/company-settings', label: 'Company', icon: <Building2 size={18} /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#090909]">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-[#1c1c1c] bg-[#0d0d0d]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#1c1c1c]">
          <div className="w-7 h-7 rounded-md bg-[#f97316] flex items-center justify-center">
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#f97316]">Smart</p>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a3a3a3]">Procurement</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-2 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-[#525252] mb-2">
            Main
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-[#f97316]/10 text-[#f97316] font-medium border border-[#f97316]/20'
                    : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#ffffff08]'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          <div className="pt-4 border-t border-[#1c1c1c] mt-4">
            <p className="px-2 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-[#525252] mb-2">
              Admin
            </p>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-[#f97316]/10 text-[#f97316] font-medium border border-[#f97316]/20'
                      : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#ffffff08]'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User Switcher */}
        <div className="px-3 py-4 border-t border-[#1c1c1c]">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-[#1a1a1a] border border-[#242424]">
            <User size={16} className="text-[#a3a3a3] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {loading ? (
                <p className="text-xs text-[#525252]">Loading...</p>
              ) : users.length === 0 ? (
                <p className="text-xs text-[#525252]">No users</p>
              ) : (
                <select
                  value={selectedUserId}
                  onChange={(e) => handleUserChange(e.target.value)}
                  className="w-full bg-transparent text-sm text-[#f5f5f5] focus:outline-none cursor-pointer appearance-none [&>option]:bg-[#1a1a1a] [&>option]:text-[#f5f5f5]"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id} className="bg-[#1a1a1a] text-[#f5f5f5]">
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <ChevronDown size={14} className="text-[#525252] flex-shrink-0" />
          </div>
          <p className="text-[9px] text-[#525252] mt-1 text-center">
            Switch role to test different views
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}