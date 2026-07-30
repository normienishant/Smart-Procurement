import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tender } from '@/lib/database.types';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6'];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [avgValueByStatus, setAvgValueByStatus] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      // Fetch all tenders
      const { data } = await supabase.from('tenders').select('*').order('created_at', { ascending: true });
      const rows = data || [];
      setTenders(rows);

      // Status distribution
      const statusMap: Record<string, number> = {};
      rows.forEach((t) => {
        const s = t.status || 'unknown';
        statusMap[s] = (statusMap[s] || 0) + 1;
      });
      const statusArr = Object.entries(statusMap).map(([name, value]) => ({ name, value }));
      setStatusData(statusArr);

      // Monthly upload trend
      const monthMap = new Map<string, number>();
      rows.forEach((t) => {
        const date = new Date(t.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      });
      const monthArr = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, count]) => ({ month, count }));
      setMonthlyData(monthArr.slice(-12));

      // Average estimated value by status
      const avgMap: Record<string, { total: number; count: number }> = {};
      rows.forEach((t) => {
        const s = t.status || 'unknown';
        const val = Number(t.estimated_value) || 0;
        if (!avgMap[s]) avgMap[s] = { total: 0, count: 0 };
        avgMap[s].total += val;
        avgMap[s].count += 1;
      });
      const avgArr = Object.entries(avgMap).map(([status, data]) => ({
        status,
        avg: data.count > 0 ? Math.round(data.total / data.count) : 0,
      }));
      setAvgValueByStatus(avgArr);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f97316]" /></div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-[#f97316]" />
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f97316]">Analytics</p>
          </div>
          <h1 className="text-2xl font-bold text-[#f5f5f5]">Tender Analytics</h1>
          <p className="text-sm text-[#a3a3a3] mt-1">Real-time insights from your tenders</p>
        </div>
        <div className="text-xs text-[#525252]">{tenders.length} total tenders</div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatBox label="Total Tenders" value={tenders.length} />
        <StatBox label="Avg Value" value={`₹${(tenders.reduce((s, t) => s + (Number(t.estimated_value) || 0), 0) / (tenders.length || 1) / 100000).toFixed(1)}L`} />
        <StatBox label="Most Status" value={Object.entries(tenders.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {} as Record<string, number>)).sort((a,b) => b[1]-a[1])[0]?.[0] || '—'} />
        <StatBox label="Last Upload" value={tenders.length > 0 ? new Date(tenders[0].created_at).toLocaleDateString() : '—'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4">Monthly Upload Trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                <XAxis dataKey="month" stroke="#525252" tick={{ fontSize: 10 }} />
                <YAxis stroke="#525252" tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a1a1a', borderColor: '#242424', color: '#f5f5f5' }} />
                <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie */}
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4">Status Distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a1a', borderColor: '#242424', color: '#f5f5f5' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avg Value by Status */}
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4">Average Estimated Value by Status</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={avgValueByStatus}>
                <XAxis dataKey="status" stroke="#525252" tick={{ fontSize: 10 }} />
                <YAxis stroke="#525252" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1a1a1a', borderColor: '#242424', color: '#f5f5f5' }} />
                <Bar dataKey="avg" fill="#f97316" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-4">
      <p className="text-xs text-[#a3a3a3] uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-[#f5f5f5] mt-1">{value}</p>
    </div>
  );
}