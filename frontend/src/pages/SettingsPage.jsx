import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Modal, Button, Badge, Spinner, EmptyState, ConfirmModal } from "../components/ui";
import {
  Users, LayoutGrid, Plus, Edit3, Trash2, ShieldCheck, UserCog, UserX, Lock, Calendar, AlertTriangle
} from "lucide-react";

function formatDate(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── User Management ───
function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toggleConfirm, setToggleConfirm] = useState(null);
  const [form, setForm] = useState({ username: "", password: "", full_name: "", role: "staff" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openAdd = () => { setEditUser(null); setForm({ username: "", password: "", full_name: "", role: "staff" }); setFormError(""); setShowForm(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ username: u.username, password: "", full_name: u.full_name, role: u.role }); setFormError(""); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true); setFormError("");
    try {
      if (editUser) {
        const data = { full_name: form.full_name, role: form.role };
        if (form.password) data.password = form.password;
        await api.updateUser(editUser.id, data);
      } else {
        await api.createUser(form);
      }
      setShowForm(false); loadUsers();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (id) => {
    setDeleteConfirm(null);
    try { await api.deleteUser(id); loadUsers(); }
    catch (err) { alert(err.message); }
  };

  const handleToggle = async (u) => {
    setToggleConfirm(null);
    try {
      await api.toggleUserActive(u.id);
      loadUsers();
    } catch (err) { alert(err.message); }
  };

  const roleIcons = { admin: ShieldCheck, manager: UserCog, staff: Users };
  const roleColors = { admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", manager: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", staff: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
  const roleLabels = { admin: "Admin", manager: "Quản lý", staff: "Nhân viên" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tài khoản nhân viên</h3>
        <Button size="sm" onClick={openAdd}><Plus className="w-3.5 h-3.5" /> Thêm tài khoản</Button>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid gap-3">
          {users.map(u => {
            const RoleIcon = roleIcons[u.role] || Users;
            return (
              <div key={u.id} className={`flex items-center gap-4 p-4 rounded-xl border ${u.is_active ? "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900" : "border-red-200 bg-red-50 dark:bg-red-900/10"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${roleColors[u.role]}`}>
                  <RoleIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{u.full_name}</span>
                    {!u.is_active && <Badge color="red">Đã khóa</Badge>}
                  </div>
                  <div className="text-xs text-gray-500">@{u.username} • {formatDate(u.created_at)}</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[u.role]}`}>{roleLabels[u.role]}</span>
                {u.id !== currentUser?.id && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-600">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(u)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editUser ? "Sửa tài khoản" : "Thêm tài khoản mới"} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên đầy đủ</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="VD: Nguyễn Văn A" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên đăng nhập {editUser && "(để trống nếu không đổi)"}</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="username" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              required={!editUser} disabled={!!editUser} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mật khẩu {editUser && "(để trống nếu không đổi)"}</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              required={!editUser} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vai trò</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white">
              <option value="staff">Nhân viên</option>
              <option value="manager">Quản lý</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {formError && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">{formError}</div>}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button type="submit" loading={formLoading}>{editUser ? "Lưu" : "Tạo tài khoản"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm?.id)}
        title="Xóa tài khoản" message={`Xóa tài khoản "${deleteConfirm?.full_name}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
      />
    </div>
  );
}

// ─── Area Management ───
function AreaManagement() {
  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [showTableForm, setShowTableForm] = useState(false);
  const [editArea, setEditArea] = useState(null);
  const [editTable, setEditTable] = useState(null);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [areaForm, setAreaForm] = useState({ name: "", display_order: 0 });
  const [tableForm, setTableForm] = useState({ name: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTablesWithAreas();
      setAreas(data);
      setTables(data.flatMap(a => a.tables.map(t => ({ ...t, area_name: a.name }))));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAddArea = () => { setEditArea(null); setAreaForm({ name: "", display_order: areas.length + 1 }); setFormError(""); setShowAreaForm(true); };
  const openEditArea = (a) => { setEditArea(a); setAreaForm({ name: a.name, display_order: a.display_order }); setFormError(""); setShowAreaForm(true); };

  const handleAreaSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true); setFormError("");
    try {
      if (editArea) await api.updateArea(editArea.id, areaForm);
      else await api.createArea(areaForm);
      setShowAreaForm(false); loadData();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleDeleteArea = async (id) => {
    setDeleteConfirm(null);
    try { await api.deleteArea(id); loadData(); }
    catch (err) { alert(err.message); }
  };

  const openAddTable = (areaId) => {
    setSelectedAreaId(areaId);
    setEditTable(null);
    setTableForm({ name: "" });
    setFormError("");
    setShowTableForm(true);
  };

  const openEditTable = (t) => {
    setSelectedAreaId(t.area_id);
    setEditTable(t);
    setTableForm({ name: t.name });
    setFormError("");
    setShowTableForm(true);
  };

  const handleTableSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true); setFormError("");
    try {
      if (editTable) await api.updateTable(editTable.id, { ...tableForm, area_id: selectedAreaId });
      else await api.createTable({ ...tableForm, area_id: selectedAreaId });
      setShowTableForm(false); loadData();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleDeleteTable = async (id) => {
    setDeleteConfirm(null);
    try { await api.deleteTable(id); loadData(); }
    catch (err) { alert(err.message); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Khu vực & Bàn</h3>
          <p className="text-sm text-gray-500 mt-0.5">{areas.length} khu vực, {tables.length} bàn</p>
        </div>
        <Button size="sm" onClick={openAddArea}><Plus className="w-3.5 h-3.5" /> Thêm khu vực</Button>
      </div>

      {areas.map(area => (
        <div key={area.id} className="border dark:border-gray-800 rounded-2xl overflow-hidden">
          {/* Area Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-800">
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-4.5 h-4.5 text-primary" />
              <span className="font-medium text-gray-900 dark:text-white">{area.name}</span>
              <Badge color="gray">{area.tables.length} bàn</Badge>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openAddTable(area.id)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-primary">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => openEditArea(area)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-600">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={() => setDeleteConfirm({ type: "area", data: area })} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tables */}
          <div className="p-4 grid grid-cols-6 gap-3">
            {area.tables.map(t => (
              <div key={t.id} className="flex items-center gap-2 p-3 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</div>
                </div>
                <button onClick={() => openEditTable(t)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-600">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteConfirm({ type: "table", data: t })} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {area.tables.length === 0 && (
              <div className="col-span-6 text-center text-sm text-gray-400 py-6">Chưa có bàn nào</div>
            )}
          </div>
        </div>
      ))}

      {/* Area Form */}
      <Modal open={showAreaForm} onClose={() => setShowAreaForm(false)} title={editArea ? "Sửa khu vực" : "Thêm khu vực mới"} size="sm">
        <form onSubmit={handleAreaSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên khu vực</label>
            <input value={areaForm.name} onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Tầng 1, VIP, Ngoài trời" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Thứ tự hiển thị</label>
            <input type="number" value={areaForm.display_order} min={0}
              onChange={e => setAreaForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>
          {formError && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{formError}</div>}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowAreaForm(false)}>Hủy</Button>
            <Button type="submit" loading={formLoading}>{editArea ? "Lưu" : "Thêm"}</Button>
          </div>
        </form>
      </Modal>

      {/* Table Form */}
      <Modal open={showTableForm} onClose={() => setShowTableForm(false)} title={editTable ? "Sửa bàn" : "Thêm bàn mới"} size="sm">
        <form onSubmit={handleTableSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên bàn</label>
            <input value={tableForm.name} onChange={e => setTableForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Bàn 1" className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" required />
          </div>
          {formError && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{formError}</div>}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowTableForm(false)}>Hủy</Button>
            <Button type="submit" loading={formLoading}>{editTable ? "Lưu" : "Thêm"}</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm?.type === "area") handleDeleteArea(deleteConfirm.data.id);
          else handleDeleteTable(deleteConfirm?.data?.id);
        }}
        title={`Xóa ${deleteConfirm?.type === "area" ? "khu vực" : "bàn"}`}
        message={deleteConfirm?.type === "area"
          ? `Xóa khu vực "${deleteConfirm?.data?.name}" và tất cả bàn bên trong? Hành động không thể hoàn tác.`
          : `Xóa bàn "${deleteConfirm?.data?.name}"? Hành động không thể hoàn tác.`
        }
        confirmText="Xóa"
      />
    </div>
  );
}

// ─── Table Block Management ───
function TableBlockManagement() {
  const [blocks, setBlocks] = useState([]);
  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [form, setForm] = useState({
    blockType: "table", // "table" | "area"
    table_id: "",
    area_id: "",
    date: "",
    end_date: "",
    time_limit: "",
    reason: "",
    is_holiday: false,
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [filterDate, setFilterDate] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [blockData, areaData] = await Promise.all([
        api.getActiveBlocks(filterDate || undefined),
        api.getTablesWithAreas(),
      ]);
      setBlocks(blockData);
      setAreas(areaData);
      setTables(areaData.flatMap(a => a.tables.map(t => ({ ...t, area_name: a.name }))));
    } catch {}
    finally { setLoading(false); }
  }, [filterDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true); setFormError("");
    try {
      const payload = {
        table_id: form.blockType === "table" ? parseInt(form.table_id) : null,
        area_id: form.blockType === "area" ? parseInt(form.area_id) : null,
        date: form.date,
        time_limit: form.time_limit || null,
        reason: form.reason || null,
        is_holiday: form.is_holiday,
      };

      if (form.end_date && form.end_date !== form.date) {
        // Bulk create
        await api.createBlocksBulk({
          ...payload,
          start_date: form.date,
          end_date: form.end_date,
        });
      } else {
        await api.createBlock(payload);
      }
      setShowForm(false);
      loadData();
    } catch (err) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (id) => {
    setDeleteConfirm(null);
    try { await api.deleteBlock(id); loadData(); }
    catch (err) { alert(err.message); }
  };

  const blockStatusColor = (b) => {
    if (b.time_limit === null) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Khóa bàn
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {blocks.length} khóa đang active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white text-sm" />
          {filterDate && (
            <button onClick={() => setFilterDate("")}
              className="px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800">
              Xóa lọc
            </button>
          )}
          <Button size="sm" onClick={() => {
            setForm({
              blockType: "table",
              table_id: "", area_id: "",
              date: (() => {
                const d = new Date();
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                return `${y}-${m}-${day}`;
              })(),
              end_date: "",
              time_limit: "", reason: "", is_holiday: false,
            });
            setFormError("");
            setShowForm(true);
          }}>
            <Plus className="w-3.5 h-3.5" /> Thêm khóa
          </Button>
        </div>
      </div>

      {/* Lưu ý */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <p><strong>Cách hoạt động:</strong></p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li><strong>Khóa cả ngày</strong> (không nhập giờ): Bàn không thể đặt trong ngày đó</li>
            <li><strong>Giới hạn giờ đến</strong> (VD: 20:00): Khách phải đến trước giờ đó</li>
            <li>Khóa theo <strong>Khu vực</strong>: Tất cả bàn trong khu vực bị ảnh hưởng</li>
            <li>Khóa <strong>Nhiều ngày</strong>: Nhập thêm "Đến ngày" để tạo khóa hàng loạt</li>
          </ul>
        </div>
      </div>

      {loading ? <Spinner /> : blocks.length === 0 ? (
        <EmptyState title="Chưa có khóa bàn nào" description="Nhấn 'Thêm khóa' để bắt đầu" />
      ) : (
        <div className="space-y-2">
          {blocks.map(b => (
            <div key={b.id} className={`flex items-center gap-4 p-4 rounded-xl border ${blockStatusColor(b)}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Lock className="w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm">
                    {b.table_name ? `Bàn: ${b.table_name}` : `Khu vực: ${b.area_name}`}
                  </div>
                  <div className="flex items-center gap-2 text-xs mt-0.5 opacity-80">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(b.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                    {b.time_limit && (
                      <span className="font-medium">· Giới hạn đến trước {b.time_limit}</span>
                    )}
                    {!b.time_limit && <span>· Khóa cả ngày</span>}
                    {b.is_holiday && <span className="font-semibold">· Ngày lễ</span>}
                  </div>
                  {b.reason && (
                    <div className="text-xs mt-0.5 opacity-70 italic">{b.reason}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs opacity-60">by {b.blocked_by_name}</span>
                <button onClick={() => setDeleteConfirm(b)}
                  className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800 text-red-600 dark:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Block Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Thêm khóa bàn" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Block type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phạm vi khóa</label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${form.blockType === "table" ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700"}`}>
                <input type="radio" name="blockType" value="table" checked={form.blockType === "table"}
                  onChange={() => setForm(f => ({ ...f, blockType: "table", table_id: "", area_id: "" }))}
                  className="text-primary" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Khóa bàn cụ thể</span>
              </label>
              <label className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-colors ${form.blockType === "area" ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700"}`}>
                <input type="radio" name="blockType" value="area" checked={form.blockType === "area"}
                  onChange={() => setForm(f => ({ ...f, blockType: "area", table_id: "", area_id: "" }))}
                  className="text-primary" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Khóa cả khu vực</span>
              </label>
            </div>
          </div>

          {/* Chọn bàn / khu vực */}
          {form.blockType === "table" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chọn bàn</label>
              <select value={form.table_id} onChange={e => setForm(f => ({ ...f, table_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" required>
                <option value="">-- Chọn bàn --</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.area_name})</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chọn khu vực</label>
              <select value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" required>
                <option value="">-- Chọn khu vực --</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.tables.length} bàn)</option>
                ))}
              </select>
            </div>
          )}

          {/* Ngày */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Từ ngày <span className="text-red-500">*</span></label>
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value, end_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Đến ngày <span className="text-xs text-gray-400">(bỏ trống = 1 ngày)</span></label>
              <input type="date" value={form.end_date}
                min={form.date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
            </div>
          </div>

          {/* Giờ giới hạn */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Giới hạn giờ đến
              <span className="text-xs text-gray-400 ml-1">(bỏ trống = khóa cả ngày)</span>
            </label>
            <input type="time" value={form.time_limit}
              onChange={e => setForm(f => ({ ...f, time_limit: e.target.value }))}
              className="w-40 px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>

          {/* Lý do */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lý do</label>
            <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="VD: Nhà hàng nghỉ lễ, Bàn hỏng, Đặt riêng..."
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
          </div>

          {/* Ngày lễ */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
            <input type="checkbox" checked={form.is_holiday}
              onChange={e => setForm(f => ({ ...f, is_holiday: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary" />
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">Đánh dấu ngày lễ</span>
              <p className="text-xs text-gray-500">Hiển thị badge "Ngày lễ" trên lịch</p>
            </div>
          </label>

          {formError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
              {formError}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button type="submit" loading={formLoading}>
              <Lock className="w-4 h-4" /> Khóa bàn
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}
        onConfirm={() => handleDelete(deleteConfirm?.id)}
        title="Mở khóa bàn"
        message={`Mở khóa "${deleteConfirm?.table_name || deleteConfirm?.area_name}" vào ngày ${deleteConfirm ? new Date(deleteConfirm.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""}?`}
        confirmText="Mở khóa"
      />
    </div>
  );
}

// ─── Main Settings Page ───
export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const [tab, setTab] = useState("users");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cài Đặt</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quản lý tài khoản, khu vực, bàn và khóa booking</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        <button onClick={() => setTab("users")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "users" ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
          <Users className="w-4 h-4 inline mr-1.5" />Tài khoản
        </button>
        <button onClick={() => setTab("areas")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "areas" ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
          <LayoutGrid className="w-4 h-4 inline mr-1.5" />Khu vực & Bàn
        </button>
        {isAdmin && (
          <button onClick={() => setTab("blocks")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "blocks" ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            <Lock className="w-4 h-4 inline mr-1.5" />Khóa bàn
          </button>
        )}
      </div>

      {tab === "users" && <UserManagement />}
      {tab === "areas" && <AreaManagement />}
      {tab === "blocks" && isAdmin && <TableBlockManagement />}
    </div>
  );
}
