import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useSSE } from "../hooks/useSSE";
import { Modal, Button, Badge, Spinner, EmptyState } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import {
  Users, Clock, Phone, FileText, Search, Plus,
  ArrowRightLeft, GitMerge, GitBranch, CheckCircle2,
  XCircle, CreditCard, UserCheck, Lock
} from "lucide-react";

const STATUS_CONFIG = {
  empty:    { label: "Trống", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", dot: "bg-gray-400", hover: "hover:bg-green-50 hover:border-green-400 cursor-pointer" },
  reserved: { label: "Đặt trước", color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-500", hover: "hover:bg-amber-50 cursor-pointer" },
  occupied: { label: "Có khách", color: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400", dot: "bg-green-500", hover: "cursor-pointer" },
  merged:   { label: "Ghép bàn", color: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", dot: "bg-purple-500", hover: "cursor-pointer" },
  blocked:  { label: "Bị khóa", color: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500", hover: "cursor-not-allowed" },
};

function formatTime(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/** Booking đang hiệu lực trên bàn trong ngày đang xem (ưu tiên đã check-in). */
function activeBookingForTable(tableId, dayBookings) {
  const list = dayBookings.filter(
    b => b.table_id === tableId && (b.status === "reserved" || b.status === "checked_in")
  );
  return list.find(b => b.status === "checked_in") || list.find(b => b.status === "reserved") || null;
}

// ─── Booking Form Modal ───
function BookingFormModal({ open, onClose, table, tables, areas, onSuccess, defaultDate }) {
  const [customer, setCustomer] = useState({ name: "", phone: "", guests: 1, time: "", note: "", customerId: null });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMerged, setIsMerged] = useState(false);
  const [selectedMergedTables, setSelectedMergedTables] = useState([]);

  const searchCustomer = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    try {
      const results = await api.lookupCustomer(q);
      setSuggestions(results);
    } catch { setSuggestions([]); }
  }, []);

  useEffect(() => {
    if (!open) {
      setCustomer({ name: "", phone: "", guests: 1, time: "", note: "", customerId: null });
      setSuggestions([]);
      setError("");
      setIsMerged(false);
      setSelectedMergedTables([]);
      return;
    }
    if (defaultDate) {
      setCustomer(c => ({ ...c, time: defaultDate + "T18:00" }));
    } else {
    const now = new Date(); now.setMinutes(now.getMinutes() + 30);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    setCustomer(c => ({ ...c, time: `${y}-${m}-${day}T${h}:${min}` }));
    }
  }, [open, defaultDate]);

  const selectCustomer = (c) => {
    setCustomer({ name: c.name, phone: c.phone, customerId: c.id, guests: c.total_visits ? Math.min(c.total_visits, 10) : 1, time: customer.time, note: "" });
    setSuggestions([]);
  };

  const toggleMergedTable = (t) => {
    setSelectedMergedTables(prev =>
      prev.find(x => x.id === t.id)
        ? prev.filter(x => x.id !== t.id)
        : [...prev, t]
    );
  };

  // Các bàn trống cùng khu vực, không trùng bàn chính
  const availableMergedTables = (tables || []).filter(t =>
    t.area_id === table?.area_id &&
    t.status === "empty" &&
    t.id !== table?.id &&
    !t.is_blocked
  );

  // Kiểm tra giới hạn giờ
  const timeLimitWarning = (() => {
    if (!table?.block_time_limit) return null;
    const selectedTime = customer.time ? new Date(customer.time) : null;
    if (!selectedTime) return null;
    const [h, m] = table.block_time_limit.split(":").map(Number);
    const limitDate = new Date(selectedTime);
    limitDate.setHours(h, m, 0, 0);
    if (selectedTime > limitDate) {
      return `⚠️ Ngày này không nhận booking sau ${table.block_time_limit}. Vui lòng chọn giờ sớm hơn.`;
    }
    return null;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customer.name || !customer.phone || !customer.guests || !customer.time) { setError("Vui lòng điền đầy đủ thông tin"); return; }
    if (isMerged && selectedMergedTables.length === 0) { setError("Vui lòng chọn ít nhất 1 bàn để ghép"); return; }
    setLoading(true); setError("");
    try {
      await api.createBooking({
        table_id: table.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        guest_count: customer.guests,
        booking_time: customer.time,
        note: customer.note,
        customer_id: customer.customerId,
        merged_table_ids: isMerged ? selectedMergedTables.map(t => t.id) : [],
      });
      onSuccess(); onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (!open || !table) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Đặt bàn: ${table.name}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Luôn hiển thị phía trên — tránh bỏ sót khi không cuộn */}
        <div className="rounded-xl border-2 border-purple-300 dark:border-purple-700 bg-purple-50/80 dark:bg-purple-950/40 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <input
              id="booking-merge-toggle"
              type="checkbox"
              checked={isMerged}
              onChange={(e) => {
                const on = e.target.checked;
                setIsMerged(on);
                if (!on) setSelectedMergedTables([]);
              }}
              className="mt-1 h-4 w-4 rounded border-purple-400 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="booking-merge-toggle" className="flex-1 cursor-pointer">
              <span className="flex items-center gap-2 font-semibold text-purple-800 dark:text-purple-200">
                <GitMerge className="w-4 h-4 shrink-0" />
                Gộp thêm bàn trống (cùng khu vực)
              </span>
              <span className="block text-xs text-purple-700/90 dark:text-purple-300/90 mt-1">
                Bàn chính: <strong>{table.name}</strong>. Chọn bàn trống cùng khu vực để gộp thêm — khi khách đến sẽ tự động gộp.
              </span>
            </label>
          </div>

          {isMerged && (
            <div className="space-y-3 pt-1 border-t border-purple-200 dark:border-purple-800">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Chọn bàn trống cùng khu vực:
                {availableMergedTables.length === 0 && (
                  <span className="block mt-1 text-amber-700 dark:text-amber-400 font-medium">
                    Hiện không còn bàn trống nào cùng khu vực để ghép.
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-0.5">
                {availableMergedTables.map((t) => {
                  const sel = selectedMergedTables.find((x) => x.id === t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleMergedTable(t)}
                      className={`flex h-11 w-full shrink-0 items-center justify-between gap-2 rounded-lg border-2 px-3 text-left text-sm font-medium transition-all ${
                        sel
                          ? "border-purple-500 bg-white text-gray-900 ring-2 ring-purple-300/50 dark:bg-gray-800 dark:text-white"
                          : "border-gray-200 text-gray-900 hover:border-purple-400 dark:border-gray-600 dark:text-white"
                      }`}
                    >
                      <span className="min-w-0 truncate">{t.name}</span>
                      {sel && <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-600" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên khách</label>
          <input value={customer.name} onChange={e => { setCustomer(c => ({ ...c, name: e.target.value })); searchCustomer(e.target.value); }}
            placeholder="Nhập tên khách" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-primary/50" required />
          {suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map(s => (
                <button key={s.id} type="button" onClick={() => selectCustomer(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.phone} {s.note ? `• ${s.note}` : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Số điện thoại</label>
            <input value={customer.phone} onChange={e => {
              const phone = e.target.value;
              setCustomer(c => ({ ...c, phone }));
              searchCustomer(phone);
            }}
              placeholder="0909..." className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-primary/50" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Số khách</label>
            <input type="number" value={customer.guests} min={1} max={50}
              onChange={e => setCustomer(c => ({ ...c, guests: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-primary/50" required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Giờ đến</label>
          <input type="datetime-local" value={customer.time}
            onChange={e => setCustomer(c => ({ ...c, time: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-primary/50" required />
        </div>

        {timeLimitWarning && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
            <span>⚠️</span>
            <span>{timeLimitWarning}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ghi chú</label>
          <textarea value={customer.note} onChange={e => setCustomer(c => ({ ...c, note: e.target.value }))}
            placeholder="VD: khách ngồi ngoài trời, sinh nhật..."
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-primary/50" rows={2} />
        </div>

        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" loading={loading}>
            <Plus className="w-4 h-4" /> {isMerged ? "Đặt bàn ghép" : "Đặt bàn"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Walk-in Modal ───
function WalkInModal({ open, onClose, table, onSuccess }) {
  const [form, setForm] = useState({ name: "", phone: "", guests: 1, note: "", customerId: null });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchCustomer = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    try {
      const results = await api.lookupCustomer(q);
      setSuggestions(results);
    } catch { setSuggestions([]); }
  }, []);

  const selectCustomer = (c) => {
    setForm(f => ({ ...f, name: c.name, phone: c.phone, customerId: c.id }));
    setSuggestions([]);
  };

  useEffect(() => { if (!open) { setForm({ name: "", phone: "", guests: 1, note: "", customerId: null }); setSuggestions([]); } }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await api.walkIn({ table_id: table.id, customer_name: form.name, customer_phone: form.phone, guest_count: form.guests, note: form.note, customer_id: form.customerId });
      onSuccess(); onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (!open || !table) return null;
  return (
    <Modal open={open} onClose={onClose} title={`Mở bàn (Khách vãng lai): ${table.name}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên khách</label>
          <input
            value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); searchCustomer(e.target.value); }}
            placeholder="Nhập tên khách"
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            required
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map(s => (
                <button key={s.id} type="button" onClick={() => selectCustomer(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.phone}{s.note ? ` • ${s.note}` : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SĐT</label>
            <input
              value={form.phone}
              onChange={e => { const phone = e.target.value; setForm(f => ({ ...f, phone })); searchCustomer(phone); }}
              placeholder="0909..."
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Số khách</label>
            <input type="number" value={form.guests} min={1} max={50}
              onChange={e => setForm(f => ({ ...f, guests: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ghi chú</label>
          <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" rows={2} />
        </div>
        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" loading={loading}><Plus className="w-4 h-4" /> Mở bàn</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Table Detail Modal ───
function TableDetailModal({ open, onClose, table, areas, onAction, onBookTable, onWalkIn, onMerge, onUnmerge, onTransfer }) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [closeAmount, setCloseAmount] = useState(0);
  const [closeNote, setCloseNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isManager = user?.role === "admin" || user?.role === "manager";

  useEffect(() => {
    if (!open || !table) return;
    setLoading(true);
    api.getActiveBookings().then(list => {
      setBookings(list.filter(b => b.table_id === table.id));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [open, table]);

  const currentBooking = bookings.find(b => b.status === "reserved" || b.status === "checked_in");

  const handleCheckIn = async () => {
    if (!currentBooking) return;
    setActionLoading(true);
    try { await api.checkIn(currentBooking.id); onAction(); onClose(); }
    catch { setActionLoading(false); }
  };

  const handleClose = async () => {
    if (!currentBooking) return;
    setActionLoading(true);
    try { await api.closeBooking(currentBooking.id, closeAmount, closeNote); onAction(); onClose(); }
    catch { setActionLoading(false); }
  };

  const handleCancel = async () => {
    if (!currentBooking) return;
    setActionLoading(true);
    try { await api.cancelBooking(currentBooking.id, cancelReason); onAction(); onClose(); }
    catch { setActionLoading(false); }
  };

  if (!open || !table) return null;
  const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.empty;

  return (
    <Modal open={open} onClose={onClose} title={`Bàn: ${table.name}`} size="lg">
      {/* Status Banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl mb-5 ${cfg.color}`}>
        <span className={`w-3 h-3 rounded-full ${cfg.dot} animate-pulse`} />
        <span className="font-medium">{cfg.label}</span>
        <span className="ml-auto text-sm opacity-70">{table.name}</span>
      </div>

      {/* Booking Info */}
      {currentBooking && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-5 space-y-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">Khách:</span>
            <span className="font-medium text-gray-900 dark:text-white">{currentBooking.customer_name}</span>
            <span className="ml-auto text-xs text-gray-500">{currentBooking.guest_count} khách</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">Điện thoại:</span>
            <span className="font-medium text-gray-900 dark:text-white">{currentBooking.customer_phone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">Giờ đến:</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatTime(currentBooking.booking_time)}</span>
          </div>
          {currentBooking.note && (
            <div className="flex items-start gap-2 text-sm">
              <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
              <span className="font-medium text-gray-900 dark:text-white">{currentBooking.note}</span>
            </div>
          )}
          {currentBooking.booked_by_name && (
            <div className="text-xs text-gray-400">Đặt bởi: {currentBooking.booked_by_name}</div>
          )}
        </div>
      )}

      {/* Merged Tables Info */}
      {table.status === "merged" && tables && (() => {
        const mergedTablesList = tables.filter(t => t.merged_into_id === table.id);
        const mainBooking = bookings.find(b => b.status === "checked_in");
        return mergedTablesList.length > 0 ? (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 mb-5">
            <div className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
              <GitMerge className="w-4 h-4" />
              Bàn đã gộp ({mergedTablesList.length})
            </div>
            <div className="space-y-2">
              {mergedTablesList.map(t => (
                <div key={t.id} className="flex h-11 items-center justify-between rounded-lg border border-purple-100 bg-white px-3 text-sm font-medium dark:border-purple-900/40 dark:bg-gray-800">
                  <span className="truncate text-gray-900 dark:text-white">{t.name}</span>
                  <span className="shrink-0 text-purple-600 dark:text-purple-400">
                    {bookings.find(b => b.table_id === t.id && b.status === "checked_in")?.guest_count || 0} khách
                  </span>
                </div>
              ))}
            </div>
            {mainBooking && (
              <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800 text-sm text-purple-700 dark:text-purple-300 flex items-center justify-between">
                <span>Tổng cộng bàn chính + gộp:</span>
                <span className="font-bold">
                  {mainBooking.guest_count + mergedTablesList.reduce((sum, t) => sum + (bookings.find(b => b.table_id === t.id && b.status === "checked_in")?.guest_count || 0), 0)} khách
                </span>
              </div>
            )}
          </div>
        ) : null;
      })()}

      {/* Close Table Form */}
      {table.status !== "empty" && currentBooking && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Đóng bàn - Thanh toán
          </h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Doanh thu (VNĐ)</label>
              <input type="number" value={closeAmount} onChange={e => setCloseAmount(parseFloat(e.target.value) || 0)}
                placeholder="0" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
              <input value={closeNote} onChange={e => setCloseNote(e.target.value)}
                placeholder="Ghi chú..." className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {table.status === "empty" && (
          <>
            <p className="w-full text-sm text-gray-500 dark:text-gray-400 mb-1">
              Bàn đang trống — chọn đặt trước hoặc mở bàn cho khách vãng lai:
            </p>
            <Button onClick={onBookTable} className="flex-1 min-w-[140px]">
              <Plus className="w-4 h-4" /> Đặt bàn
            </Button>
            <Button onClick={onWalkIn} variant="secondary" className="flex-1 min-w-[140px]">
              <Plus className="w-4 h-4" /> Mở bàn
            </Button>
          </>
        )}

        {table.status === "reserved" && currentBooking && (
          <>
            <Button onClick={handleCheckIn} loading={actionLoading} variant="success" className="flex-1">
              <UserCheck className="w-4 h-4" /> Khách đã đến
            </Button>
            <Button onClick={() => setConfirmCancel(true)} variant="danger">
              <XCircle className="w-4 h-4" /> Hủy bàn
            </Button>
          </>
        )}

        {table.status === "occupied" && currentBooking && (
          <>
            <Button onClick={handleClose} loading={actionLoading} variant="primary" className="flex-1">
              <CheckCircle2 className="w-4 h-4" /> Đóng bàn
            </Button>
            {isManager && (
              <>
                <Button onClick={onTransfer} variant="secondary" className="flex-1">
                  <ArrowRightLeft className="w-4 h-4" /> Chuyển bàn
                </Button>
                <Button onClick={onMerge} variant="secondary" className="flex-1">
                  <GitMerge className="w-4 h-4" /> Gộp bàn
                </Button>
              </>
            )}
          </>
        )}

        {table.status === "merged" && currentBooking && isManager && (
          <>
            <Button onClick={handleClose} loading={actionLoading} variant="primary" className="flex-1">
              <CheckCircle2 className="w-4 h-4" /> Đóng bàn
            </Button>
            <Button onClick={onUnmerge} variant="secondary" className="flex-1">
              <GitBranch className="w-4 h-4" /> Tách bàn
            </Button>
          </>
        )}
      </div>

      {/* Confirm Cancel */}
      {confirmCancel && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Xác nhận hủy bàn</h4>
          <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
            placeholder="Lý do hủy bàn (tùy chọn)"
            className="w-full px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg mb-3 dark:bg-gray-800 dark:text-white text-sm" />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(false)}>Quay lại</Button>
            <Button variant="danger" size="sm" onClick={handleCancel} loading={actionLoading}>Xác nhận hủy</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Merge / Transfer Modal ───
function MergeTransferModal({ open, onClose, type, table, tables, onSuccess }) {
  const [selected, setSelected] = useState(null);
  const [guestCount, setGuestCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const isMerge = type === "merge";

  useEffect(() => { if (!open) setSelected(null); }, [open]);

  const availableTables = tables.filter(t => {
    if (t.id === table?.id) return false;
    if (type === "unmerge") return t.status === "empty";
    return t.status === "empty" && t.area_id === table?.area_id;
  });

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      if (isMerge) await api.mergeTables(selected.id, table.id);
      else if (type === "transfer") await api.transferTable(table.id, selected.id);
      else await api.unmergeTable(table.id, selected.id, guestCount);
      onSuccess(); onClose();
    } catch (err) { alert(err.message); }
    finally { setLoading(false); }
  };

  if (!open || !table) return null;
  const title = isMerge ? `Gộp bàn trống vào '${table.name}'` : type === "transfer" ? `Chuyển bàn '${table.name}' sang...` : `Tách bàn '${table.name}' ra...`;

  const listHint =
    isMerge
      ? <>Chọn bàn trống cùng khu vực để gộp thêm cho bàn <strong>{table.name}</strong>:</>
      : type === "transfer"
        ? <>Chọn bàn trống để chuyển khách từ <strong>{table.name}</strong> sang:</>
        : <>Chọn bàn trống để tách khách ra:</>;

  const emptyHint =
    isMerge
      ? "Hiện không còn bàn trống nào cùng khu vực để gộp."
      : "Không có bàn trống phù hợp.";

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {type === "unmerge" && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Số khách ngồi bàn mới <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={guestCount}
            min={1}
            max={50}
            onChange={e => setGuestCount(parseInt(e.target.value, 10) || 1)}
            className="w-32 rounded-lg border px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      )}

      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{listHint}</p>

      {availableTables.length === 0 ? (
        <EmptyState title="Không có bàn phù hợp" description={emptyHint} />
      ) : (
        <div className="mb-5 flex max-h-80 flex-col gap-2 overflow-y-auto pr-0.5">
          {availableTables.map(t => {
            const sel = selected?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(sel ? null : t)}
                className={`flex h-11 w-full shrink-0 items-center justify-between gap-2 rounded-lg border-2 px-3 text-left text-sm font-medium transition-all ${
                  sel
                    ? "border-purple-500 bg-white text-gray-900 ring-2 ring-purple-300/50 dark:bg-gray-800 dark:text-white"
                    : "border-gray-200 text-gray-900 hover:border-purple-400 dark:border-gray-600 dark:text-white"
                }`}
              >
                <span className="min-w-0 truncate">{t.name}</span>
                {sel && <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-600" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-3 justify-end mt-5">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button onClick={handleConfirm} disabled={!selected} loading={loading}>
          {isMerge ? <GitMerge className="w-4 h-4" /> : type === "transfer" ? <ArrowRightLeft className="w-4 h-4" /> : <GitBranch className="w-4 h-4" />}
          Xác nhận
        </Button>
      </div>
    </Modal>
  );
}

// ─── Main Booking Page ───
export default function BookingPage() {
  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
function formatLocalDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const [selectedDate, setSelectedDate] = useState(() => formatLocalDateString(new Date()));
  const [dayBookings, setDayBookings] = useState([]);

  // Modals
  const [selectedTable, setSelectedTable] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showTableDetail, setShowTableDetail] = useState(false);
  const [showMergeTransfer, setShowMergeTransfer] = useState({ open: false, type: "", table: null });

  const isToday = selectedDate === formatLocalDateString(new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTablesWithAreas(selectedDate);
      setAreas(data);
      setTables(data.flatMap(a => a.tables.map(t => ({ ...t, area_name: a.name }))));
    } catch {}
    finally { setLoading(false); }
  }, [selectedDate]);

  const loadDayBookings = useCallback(async () => {
    try {
      const data = await api.getBookingsByDate(selectedDate);
      setDayBookings(data);
    } catch { setDayBookings([]); }
  }, [selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadDayBookings(); }, [loadDayBookings]);

  // SSE: real-time table update
  useSSE(useCallback((msg) => {
    if (msg.type === "table_update" && msg.tables) {
      setTables(prev => prev.map(t => {
        const updated = msg.tables.find(u => u.id === t.id);
        return updated ? { ...t, status: updated.status, merged_into_id: updated.merged_into_id } : t;
      }));
      setAreas(prev => prev.map(area => ({
        ...area,
        tables: area.tables.map(t => {
          const updated = msg.tables.find(u => u.id === t.id);
          return updated ? { ...t, status: updated.status, merged_into_id: updated.merged_into_id } : t;
        }),
      })));
    }
  }, []));

  const handleTableClick = (table) => {
    // Bàn bị khóa cả ngày → chỉ hiện thông báo, không mở modal đặt bàn
    if (table.is_blocked) {
      const reason = table.block_reason || "Không có lý do";
      alert(`🔒 Bàn '${table.name}' đã bị khóa vào ngày này.\nLý do: ${reason}`);
      return;
    }
    setSelectedTable(table);
    setShowTableDetail(true);
  };

  const filteredAreas = areas.map(area => ({
    ...area,
    tables: area.tables.filter(t =>
      (!searchQ || t.name.toLowerCase().includes(searchQ.toLowerCase())) &&
      (filterStatus === "all" || t.status === filterStatus || (filterStatus === "occupied" && t.status === "merged"))
    )
  })).filter(a => a.tables.length > 0);

  const statusCounts = {
    empty: tables.filter(t => t.status === "empty").length,
    reserved: tables.filter(t => t.status === "reserved").length,
    occupied: tables.filter(t => t.status === "occupied" || t.status === "merged").length,
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner message="Đang tải sơ đồ bàn..." /></div>;

  return (
    <div className="space-y-5">
      {/* Header with Date Picker */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Đặt Bàn</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {statusCounts.empty} bàn trống • {statusCounts.reserved} đặt trước • {statusCounts.occupied} có khách
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date navigation */}
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().slice(0, 10)); }}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <input type="date" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white text-sm font-medium text-center min-w-[140px]" />
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().slice(0, 10)); }}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </button>
          {!isToday && (
            <button onClick={() => setSelectedDate(formatLocalDateString(new Date()))}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              Hôm nay
            </button>
          )}
        </div>
      </div>

      {/* Quick status filter */}
      <div className="flex items-center gap-4">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {[{ k: "all", l: "Tất cả" }, { k: "empty", l: "Trống" }, { k: "reserved", l: "Đặt trước" }, { k: "occupied", l: "Có khách" }].map(f => (
              <button key={f.k} onClick={() => setFilterStatus(f.k)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterStatus === f.k ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
                {f.l}
              </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
          placeholder="Tìm kiếm bàn..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/50" />
      </div>

      {/* Table Grid by Area */}
      <div className="space-y-6">
        {filteredAreas.map(area => (
          <div key={area.id}>
            <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              {area.name}
              <Badge color="gray">{area.tables.length} bàn</Badge>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {area.tables.map(table => {
                const effectiveStatus = table.is_blocked ? "blocked" : table.status;
                const cfg = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.empty;
                const dayBooking = activeBookingForTable(table.id, dayBookings);
                const mergedIntoTable = table.merged_into_id ? tables.find(t => t.id === table.merged_into_id) : null;
                const mergedTablesList = table.status === "merged" ? tables.filter(t => t.merged_into_id === table.id) : [];
                const isAbsorbed = !!table.merged_into_id;
                const showBookingBlock = dayBooking && !isAbsorbed;
                return (
                  <div key={table.id}
                    onClick={() => handleTableClick(table)}
                    className={`relative flex min-h-[7.5rem] flex-col rounded-xl border-2 p-2.5 transition-all group ${cfg.hover} ${cfg.color.replace("bg-", "border-").replace("-50", "-200").replace("dark:", "dark:border-").replace("dark:bg-", "dark:border-").replace(/-\[30\]/, "-600")} border-gray-200 dark:border-gray-700 ${isAbsorbed ? "opacity-50" : ""}`}
                    title={`${table.name} - ${cfg.label}${mergedIntoTable ? ` (gộp vào ${mergedIntoTable.name})` : ""}`}
                  >
                    {/* Badge: khóa cả ngày */}
                    {table.is_blocked && (
                      <div className="absolute -top-2 left-1/2 z-[1] -translate-x-1/2 flex items-center gap-1 whitespace-nowrap rounded-full border border-white bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold dark:border-gray-900 dark:bg-red-900/60 text-red-700 dark:text-red-300 shadow-sm">
                        🔒 Khóa
                        {table.is_holiday && <span className="text-red-500 dark:text-red-400">· Ngày lễ</span>}
                      </div>
                    )}
                    {/* Badge: ngày thường nhưng có giới hạn giờ */}
                    {!table.is_blocked && table.block_time_limit && (
                      <div className="absolute -top-2 left-1/2 z-[1] -translate-x-1/2 whitespace-nowrap rounded-full border border-white bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium dark:border-gray-900 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shadow-sm">
                        ⏰ Đến trước {table.block_time_limit}
                      </div>
                    )}
                    {isAbsorbed && mergedIntoTable && (
                      <div className="absolute -top-2 right-0 flex max-w-[90%] items-center gap-0.5 rounded border border-white bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:border-gray-900 dark:bg-purple-900/40 dark:text-purple-300">
                        <GitMerge className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{mergedIntoTable.name}</span>
                      </div>
                    )}
                    {table.status === "merged" && mergedTablesList.length > 0 && (
                      <div className="absolute -top-2 right-0 flex items-center gap-0.5 rounded border border-white bg-purple-200 px-1.5 py-0.5 text-[10px] font-medium text-purple-800 dark:border-gray-900 dark:bg-purple-900/60 dark:text-purple-200">
                        <GitMerge className="w-2.5 h-2.5" />
                        {mergedTablesList.length} bàn
                      </div>
                    )}
                    <div className={`absolute -top-2 left-1/2 z-[1] -translate-x-1/2 whitespace-nowrap rounded-full border border-white px-2 py-0.5 text-[11px] font-medium dark:border-gray-900 ${cfg.color}`}>
                      {cfg.label}
                    </div>
                    <div className="mt-2 flex flex-1 flex-col">
                      <div className="mb-1.5 flex items-start gap-1.5">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                        <span className="text-xs font-semibold leading-tight text-gray-900 dark:text-white">{table.name}</span>
                        {table.is_blocked && (
                          <Lock className="ml-auto h-3 w-3 shrink-0 text-red-500" />
                        )}
                      </div>
                      {showBookingBlock && (
                        <div className="mt-auto space-y-0.5 border-t border-gray-200/80 pt-1.5 text-[11px] leading-snug dark:border-gray-600/80">
                          <div className="truncate font-medium text-gray-900 dark:text-white">{dayBooking.customer_name}</div>
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Phone className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            <span className="min-w-0 truncate">{dayBooking.customer_phone}</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Users className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            <span>{dayBooking.guest_count} khách</span>
                          </div>
                          {dayBooking.status === "reserved" && (
                            <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                              <Clock className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                              <span>Dự kiến {formatTime(dayBooking.booking_time)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredAreas.length === 0 && (
          <EmptyState
            title="Không tìm thấy bàn"
            description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-200 dark:border-gray-800">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${v.dot}`} />
            <span>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Modals */}
      <BookingFormModal
        open={showBookingForm} onClose={() => setShowBookingForm(false)}
        table={selectedTable}
        tables={tables}
        areas={areas}
        onSuccess={() => { loadData(); loadDayBookings(); }}
        defaultDate={selectedDate}
      />
      <WalkInModal
        open={showWalkIn} onClose={() => setShowWalkIn(false)}
        table={selectedTable} onSuccess={() => { loadData(); loadDayBookings(); }}
      />
      <TableDetailModal
        open={showTableDetail}
        onClose={() => setShowTableDetail(false)}
        table={selectedTable}
        tables={tables}
        areas={areas}
        onAction={() => { loadData(); loadDayBookings(); }}
        onBookTable={() => {
          setShowTableDetail(false);
          setShowBookingForm(true);
        }}
        onWalkIn={() => {
          setShowTableDetail(false);
          setShowWalkIn(true);
        }}
        onMerge={() => {
          setShowTableDetail(false);
          setShowMergeTransfer({ open: true, type: "merge", table: selectedTable });
        }}
        onUnmerge={() => {
          setShowTableDetail(false);
          setShowMergeTransfer({ open: true, type: "unmerge", table: selectedTable });
        }}
        onTransfer={() => {
          setShowTableDetail(false);
          setShowMergeTransfer({ open: true, type: "transfer", table: selectedTable });
        }}
      />
      <MergeTransferModal
        open={showMergeTransfer.open} onClose={() => setShowMergeTransfer({ open: false })}
        type={showMergeTransfer.type} table={showMergeTransfer.table}
        tables={tables} onSuccess={() => { loadData(); loadDayBookings(); }}
      />
    </div>
  );
}
