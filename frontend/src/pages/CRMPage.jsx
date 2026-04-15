import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import { Modal, Button, Badge, Spinner, EmptyState, ConfirmModal } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import {
  Users, Phone, Search, Plus, Edit3, Trash2, History,
  Star, FileText, X, ChevronDown, TrendingUp
} from "lucide-react";

function formatDate(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

export default function CRMPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [visits, setVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "", note: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const searchTimeout = useRef(null);

  const isManager = user?.role === "admin" || user?.role === "manager";

  const loadCustomers = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const data = await api.getCustomers(q);
      setCustomers(data);
    } catch {}
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadCustomers(search), 400);
    return () => clearTimeout(searchTimeout.current);
  }, [search, loadCustomers]);

  const loadVisits = async (customerId) => {
    setVisitsLoading(true);
    try {
      const data = await api.getCustomerVisits(customerId);
      setVisits(data);
    } catch {}
    finally { setVisitsLoading(false); }
  };

  const openDetail = (c) => {
    setSelectedCustomer(c);
    setShowDetail(true);
    loadVisits(c.id);
  };

  const openEdit = (c) => {
    setEditCustomer(c);
    setFormData({ name: c.name, phone: c.phone, note: c.note || "" });
    setFormError("");
    setShowForm(true);
  };

  const openAdd = () => {
    setEditCustomer(null);
    setFormData({ name: "", phone: "", note: "" });
    setFormError("");
    setShowForm(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    try {
      if (editCustomer) {
        await api.updateCustomer(editCustomer.id, formData);
      } else {
        await api.createCustomer(formData);
      }
      setShowForm(false);
      loadCustomers(search);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleteConfirm(null);
    try {
      await api.deleteCustomer(id);
      loadCustomers(search);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quản lý Khách hàng (CRM)</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} khách hàng</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" /> Thêm khách hàng
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc số điện thoại..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/50" />
      </div>

      {/* Customer List */}
      {loading ? <Spinner message="Đang tải danh sách khách hàng..." /> : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-800">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Khách hàng</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Điện thoại</th>
                <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lượt đến</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tổng chi tiêu</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ghi chú</th>
                {isManager && <th className="px-5 py-3.5" />}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12">
                    <EmptyState icon={Users} title="Chưa có khách hàng nào" description="Thêm khách hàng đầu tiên để bắt đầu" />
                  </td>
                </tr>
              ) : customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                        <div className="text-xs text-gray-400">{formatDate(c.created_at)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-gray-300">{c.phone}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge color={c.total_visits >= 5 ? "purple" : c.total_visits >= 2 ? "blue" : "gray"}>
                      <Star className="w-3 h-3 inline mr-1" />{c.total_visits} lần
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(c.total_spent)}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 max-w-xs truncate">{c.note || "—"}</td>
                  {isManager && (
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(c)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Form Modal */}
      <Modal
        open={showForm} onClose={() => setShowForm(false)}
        title={editCustomer ? "Sửa khách hàng" : "Thêm khách hàng mới"}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên khách hàng *</label>
            <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="Nhập tên" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Số điện thoại *</label>
            <input value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
              placeholder="0909..." className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ghi chú</label>
            <textarea value={formData.note} onChange={e => setFormData(f => ({ ...f, note: e.target.value }))}
              placeholder="VD: dị ứng hải sản, khách quen..."
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" rows={2} />
          </div>
          {formError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">{formError}</div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button type="submit" loading={formLoading}>{editCustomer ? "Lưu thay đổi" : "Thêm khách hàng"}</Button>
          </div>
        </form>
      </Modal>

      {/* Customer Detail Modal */}
      <Modal
        open={showDetail} onClose={() => { setShowDetail(false); setSelectedCustomer(null); }}
        title={selectedCustomer?.name || "Chi tiết khách hàng"}
        size="lg"
      >
        {selectedCustomer && (
          <div className="space-y-5">
            {/* Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-primary">{selectedCustomer.total_visits}</div>
                <div className="text-xs text-gray-500 mt-1">Lượt đến</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(selectedCustomer.total_spent)}</div>
                <div className="text-xs text-gray-500 mt-1">Tổng chi tiêu</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{selectedCustomer.total_visits > 0 ? formatCurrency(selectedCustomer.total_spent / selectedCustomer.total_visits) : "—"}</div>
                <div className="text-xs text-gray-500 mt-1">TB/Lần</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">Điện thoại:</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedCustomer.phone}</span>
              </div>
              {selectedCustomer.note && (
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span className="text-gray-600 dark:text-gray-400">Ghi chú:</span>
                  <span className="text-gray-900 dark:text-white">{selectedCustomer.note}</span>
                </div>
              )}
            </div>

            {/* Visit History */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <History className="w-4 h-4" /> Lịch sử tiêu dùng
              </h4>
              {visitsLoading ? <Spinner /> : visits.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Chưa có lịch sử</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {visits.map(v => (
                    <div key={v.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{v.table_name || "—"}</span>
                          <Badge color="gray">{v.guest_count} khách</Badge>
                        </div>
                        <div className="text-xs text-gray-400">{formatDate(v.visit_date)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">{formatCurrency(v.total_amount)}</div>
                        {v.note && <div className="text-xs text-gray-400">{v.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm?.id)}
        title="Xóa khách hàng"
        message={`Bạn có chắc muốn xóa khách hàng "${deleteConfirm?.name}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
      />
    </div>
  );
}
