import { useEffect, useState } from 'react';
import { Users, UserCheck, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  last_active: string;
}

interface ActivityLog {
  id: string;
  user_name: string;
  action: string;
  details: string;
  created_at: string;
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Fetch users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      setUsers(usersData || []);

      // Fetch UNIQUE recent activity logs (last 10 unique user entries)
      const { data: logsData } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { descending: true });

      if (logsData) {
        // 🔥 Remove duplicates – keep only the latest log per user
        const uniqueLogs: ActivityLog[] = [];
        const seenUserIds = new Set<string>();
        for (const log of logsData) {
          if (!seenUserIds.has(log.user_id)) {
            seenUserIds.add(log.user_id);
            uniqueLogs.push(log);
          }
          if (uniqueLogs.length >= 10) break;
        }
        setActivities(uniqueLogs);
      }

      setLoading(false);
    }
    load();
  }, []);

  const activeUsers = users.filter(u => {
    if (!u.last_active) return false;
    const diff = Date.now() - new Date(u.last_active).getTime();
    return diff < 5 * 60 * 1000;
  });

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f97316]" /></div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Users size={24} className="text-[#f97316]" />
        <h1 className="text-2xl font-bold text-[#f5f5f5]">Admin Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#a3a3a3]">Total Users</span>
            <UserCheck size={20} className="text-[#f97316]" />
          </div>
          <p className="text-3xl font-bold text-[#f5f5f5] mt-2">{users.length}</p>
        </div>
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#a3a3a3]">Active Now</span>
            <Users size={20} className="text-green-400" />
          </div>
          <p className="text-3xl font-bold text-[#f5f5f5] mt-2">{activeUsers.length}</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-[#f5f5f5] uppercase tracking-widest mb-4">All Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#525252] border-b border-[#1c1c1c]">
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Name</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isActive = activeUsers.some(u => u.id === user.id);
                const timeDiff = isActive ? 0 : Date.now() - new Date(user.last_active).getTime();
                const minsAgo = Math.floor(timeDiff / (60 * 1000));

                return (
                  <tr key={user.id} className="border-b border-[#1c1c1c] last:border-0">
                    <td className="py-3 text-[#d4d4d4]">{user.email}</td>
                    <td className="py-3 text-[#d4d4d4]">{user.name || '—'}</td>
                    <td className="py-3 text-[#a3a3a3] capitalize">{user.role}</td>
                    <td className="py-3 text-right">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Currently Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          {minsAgo === 0 ? 'Just now' : `${minsAgo} mins ago`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity – Clean, Unique Logs */}
      <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#f5f5f5] uppercase tracking-widest mb-4">Recent Activity</h2>
        {activities.length === 0 ? (
          <p className="text-sm text-[#525252]">No activity yet.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activities.map((log) => (
              <div key={log.id} className="flex items-start gap-3 border-b border-[#1c1c1c] pb-2 last:border-0">
                <Clock size={14} className="text-[#525252] mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-[#d4d4d4]">
                    <span className="font-medium text-[#f5f5f5]">{log.user_name || 'System'}</span> is currently viewing
                  </p>
                  <p className="text-[10px] text-[#3a3a3a] mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                </div>
                <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}