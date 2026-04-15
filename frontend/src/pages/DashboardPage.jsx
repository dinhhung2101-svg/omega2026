import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { Badge, Spinner } from "../components/ui";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { BarChart3, Users, Calendar, TrendingUp, Clock, DollarSign } from "lucide-react";

function formatCurrency(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return `${amount}đ`;
}

const COLORS = ["#aa3bff", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"];

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [dailyStats, setDailyStats] = useState([]);
  const [staffPerf, setStaffPerf] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ds, tc] = await Promise.all([
        api.getOverview(),
        api.getDailyStats(14),
        api.getTopCustomers(10),
      ]);
      setOverview(ov);
      setDailyStats(ds);
      setTopCustomers(tc);

      // Staff perf
      const sp = await api.getStaffPerformance(dateRange.start || null, dateRange.end || null);
      setStaffPerf(sp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = [
    { label: "Bàn trống", value: overview?.tables?.empty || 0, icon: BarChart3, color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800" },
    { label: "Đặt trước", value: overview?.tables?.reserved || 0, icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "Có khách", value: overview?.tables?.occupied || 0, icon: Users, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "Doanh thu hôm nay", value: formatCurrency(overview?.revenue_today || 0), icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner message="Đang tải báo cáo..." /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Báo cáo tổng quan hoạt động nhà hàng</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className={`${s.bg} rounded-2xl p-5`}>
              <div className="flex items-center gap-3">
                <Icon className={`w-6 h-6 ${s.color}`} />
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tables + Bookings Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-5">
          <div className="text-xs text-gray-500 mb-2">Booking hôm nay</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{overview?.bookings_today?.total || 0}</div>
          <div className="flex gap-3 mt-2">
            <span className="text-xs text-amber-600">{overview?.bookings_today?.pending || 0} chưa đến</span>
            <span className="text-xs text-green-600">{overview?.bookings_today?.checked_in || 0} đã đến</span>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-5">
          <div className="text-xs text-gray-500 mb-2">Khách hàng hôm nay</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{overview?.visits_today || 0}</div>
          <div className="text-xs text-gray-400 mt-2">lượt phục vụ</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-5">
          <div className="text-xs text-gray-500 mb-2">Tổng bàn</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{overview?.tables?.total || 0}</div>
          <div className="text-xs text-gray-400 mt-2">bàn đang có trong hệ thống</div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-5">
          <div className="text-xs text-gray-500 mb-2">Tổng số bàn</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {overview?.tables?.empty || 0}/{overview?.tables?.total || 0}
          </div>
          <div className="text-xs text-gray-400 mt-2">bàn trống / tổng bàn</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Doanh thu theo ngày (14 ngày gần nhất)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [formatCurrency(v), "Doanh thu"]} labelFormatter={l => `Ngày: ${l}`} />
              <Bar dataKey="total_revenue" fill="#aa3bff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bookings Trend */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Lượt đặt bàn theo ngày
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total_bookings" stroke="#aa3bff" strokeWidth={2} dot={{ r: 3 }} name="Đặt bàn" />
              <Line type="monotone" dataKey="total_walkins" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Vãng lai" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Staff Performance */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Thành tích nhân viên booking
          </h3>
          <div className="flex gap-2">
            <input type="date" value={dateRange.start} onChange={e => setDateRange(d => ({ ...d, start: e.target.value }))}
              className="px-3 py-1.5 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            <span className="self-center text-gray-400">—</span>
            <input type="date" value={dateRange.end} onChange={e => setDateRange(d => ({ ...d, end: e.target.value }))}
              className="px-3 py-1.5 border rounded-lg text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
        </div>

        {staffPerf.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu booking</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-800">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Nhân viên</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">Tổng booking</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">Tổng khách</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {staffPerf.map((s, i) => (
                  <tr key={s.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{s.user_name}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge color={i === 0 ? "purple" : i === 1 ? "blue" : "gray"}>{s.total_bookings}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{s.total_guests} khách</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Customers */}
      {topCustomers.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Top khách hàng VIP
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {topCustomers.slice(0, 5).map((c, i) => (
              <div key={c.id} className={`p-4 rounded-xl border ${i === 0 ? "border-primary/50 bg-primary/5" : "border-gray-200 dark:border-gray-800"}`}>
                <div className="text-2xl font-bold text-gray-300 dark:text-gray-600 mb-1">#{i + 1}</div>
                <div className="font-medium text-gray-900 dark:text-white truncate">{c.name}</div>
                <div className="text-xs text-gray-500">{c.phone}</div>
                <div className="flex gap-2 mt-2">
                  <Badge color="purple">{c.total_visits} lần</Badge>
                  <Badge color="green">{formatCurrency(c.total_spent)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
