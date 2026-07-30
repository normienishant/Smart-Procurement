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
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Tender } from '@/lib/database.types';
import toast from 'react-hot-toast';

interface FinancialSummary {
  totalBudget: number;
  totalActual: number;
  totalTenders: number;
  totalPOs: number;
  averageVariance: number;
}

interface MonthlyData {
  month: string;
  estimated: number;
  actual: number;
}

interface CategoryData {
  name: string;
  value: number;
}

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f59e0b'];

export default function FinancialDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalBudget: 0,
    totalActual: 0,
    totalTenders: 0,
    totalPOs: 0,
    averageVariance: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);

  useEffect(() => {
    async function load() {
      // Fetch all tenders
      const { data: tendersData } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: true });

      const rows = tendersData || [];
      setTenders(rows);

      // Calculate summary
      const totalBudget = rows.reduce((sum, t) => sum + (Number(t.estimated_value) || 0), 0);
      // For demo, actual = 85% of budget (in real app, fetch from PO table)
      const totalActual = totalBudget * 0.85;
      const totalPOs = rows.filter((t) => t.status === 'submitted').length;

      setSummary({
        totalBudget,
        totalActual,
        totalTenders: rows.length,
        totalPOs,
        averageVariance: totalBudget > 0 ? ((totalBudget - totalActual) / totalBudget) * 100 : 0,
      });

      // Monthly data – group by month
      const monthMap = new Map<string, { estimated: number; actual: number }>();
      rows.forEach((t) => {
        const date = new Date(t.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const est = Number(t.estimated_value) || 0;
        const act = est * 0.85; // placeholder
        if (monthMap.has(key)) {
          const existing = monthMap.get(key)!;
          existing.estimated += est;
          existing.actual += act;
        } else {
          monthMap.set(key, { estimated: est, actual: act });
        }
      });

      const months = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, data]) => ({
          month,
          estimated: data.estimated,
          actual: data.actual,
        }));
      setMonthlyData(months.slice(-12)); // last 12 months

      // Category data – group by tender_type
      const catMap = new Map<string, number>();
      rows.forEach((t) => {
        const type = t.tender_type || 'Uncategorized';
        const val = Number(t.estimated_value) || 0;
        catMap.set(type, (catMap.get(type) || 0) + val);
      });
      const cats = Array.from(catMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      setCategoryData(cats);

      setLoading(false);
    }
    load();
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    return `₹${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f97316]" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={18} className="text-[#f97316]" />
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f97316]">Financial & Accounts</p>
          </div>
          <h1 className="text-2xl font-bold text-[#f5f5f5]">Financial Dashboard</h1>
          <p className="text-sm text-[#a3a3a3] mt-1">Real-time procurement financial insights</p>
        </div>
        <button
          onClick={() => toast.success('Exporting financial report...')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#242424] hover:border-[#f97316]/30 text-[#a3a3a3] hover:text-[#f97316] text-sm transition-colors"
        >
          <Download size={16} />
          Export Report
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Total Budget"
          value={formatCurrency(summary.totalBudget)}
          change="+12%"
          positive
          icon={<DollarSign size={18} />}
        />
        <SummaryCard
          label="Total Actual Spend"
          value={formatCurrency(summary.totalActual)}
          change="+8%"
          positive
          icon={<TrendingUp size={18} />}
        />
        <SummaryCard
          label="Variance"
          value={`${summary.averageVariance.toFixed(1)}%`}
          change={summary.averageVariance > 0 ? 'Under budget' : 'Over budget'}
          positive={summary.averageVariance > 0}
          icon={<TrendingDown size={18} />}
        />
        <SummaryCard
          label="Total POs"
          value={summary.totalPOs}
          change={`${summary.totalTenders} tenders`}
          positive
          icon={<PieChartIcon size={18} />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Monthly Spend Trend</h3>
            <div className="flex items-center gap-2 text-xs text-[#525252]">
              <Calendar size={14} />
              <span>Last 12 months</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                <XAxis dataKey="month" stroke="#525252" tick={{ fontSize: 10 }} />
                <YAxis stroke="#525252" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', borderColor: '#242424', color: '#f5f5f5' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Line type="monotone" dataKey="estimated" stroke="#f97316" name="Budget" strokeWidth={2} />
                <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Actual" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Spend by Category</h3>
            <div className="flex items-center gap-2 text-xs text-[#525252]">
              <Filter size={14} />
              <span>By tender type</span>
            </div>
          </div>
          <div className="h-64">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#525252] text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', borderColor: '#242424', color: '#f5f5f5' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-[#f5f5f5] mb-4">Budget Utilization Per Tender</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tenders.slice(0, 10).map((t) => ({
                name: t.title.slice(0, 20) + (t.title.length > 20 ? '...' : ''),
                budget: Number(t.estimated_value) || 0,
                actual: (Number(t.estimated_value) || 0) * 0.85,
              }))}>
                <XAxis dataKey="name" stroke="#525252" tick={{ fontSize: 10 }} />
                <YAxis stroke="#525252" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', borderColor: '#242424', color: '#f5f5f5' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Bar dataKey="budget" fill="#f97316" name="Budget" />
                <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  change,
  positive,
  icon,
}: {
  label: string;
  value: string | number;
  change: string;
  positive: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[#a3a3a3]">{label}</span>
        <div className="p-2 rounded-lg bg-[#1a1a1a] text-[#525252]">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-[#f5f5f5]">{value}</p>
      <p className={`text-xs mt-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>{change}</p>
    </div>
  );
}