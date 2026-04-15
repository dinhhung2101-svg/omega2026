// Để trống = dùng URL tương đối → Vite proxy /api → backend (khuyến nghị khi dev).
// Chỉ set VITE_API_URL khi deploy hoặc backend chạy máy khác.
const API_BASE = import.meta.env.VITE_API_URL ?? "";

function getToken() {
  return localStorage.getItem("token");
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Không kết nối được máy chủ. Hãy chạy backend (python main.py, cổng 8000) và thử lại. Nếu dùng URL tùy chỉnh, kiểm tra biến VITE_API_URL."
    );
  }

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join(", ")
          : err.detail || "Request failed";
    throw new Error(msg);
  }

  return res.json();
}

/** FastAPI OAuth2PasswordRequestForm cần form-urlencoded, không phải JSON */
async function loginRequest(username, password) {
  const params = new URLSearchParams();
  params.set("username", username);
  params.set("password", password);
  let res;
  try {
    res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    throw new Error("Không kết nối được máy chủ đăng nhập. Hãy bật backend cổng 8000.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join(", ")
          : "Đăng nhập thất bại";
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username, password) => loginRequest(username, password),
  getMe: () => request("/api/auth/me"),
  getUsers: () => request("/api/auth/users"),
  createUser: (data) => request("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/api/auth/users/${id}`, { method: "DELETE" }),
  updateUser: (id, data) => request(`/api/auth/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  toggleUserActive: (id) => request(`/api/auth/users/${id}/toggle-active`, { method: "PUT" }),

  // Tables & Areas
  getTablesWithAreas: () => request("/api/tables-with-areas"),
  getTables: (areaId) => request(`/api/tables${areaId ? `?area_id=${areaId}` : ""}`),
  createArea: (data) => request("/api/areas", { method: "POST", body: JSON.stringify(data) }),
  updateArea: (id, data) => request(`/api/areas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteArea: (id) => request(`/api/areas/${id}`, { method: "DELETE" }),
  createTable: (data) => request("/api/tables", { method: "POST", body: JSON.stringify(data) }),
  updateTable: (id, data) => request(`/api/tables/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTable: (id) => request(`/api/tables/${id}`, { method: "DELETE" }),

  // Bookings
  getBookings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/bookings${qs ? `?${qs}` : ""}`);
  },
  getActiveBookings: () => request("/api/bookings/active"),
  getBookingsByDate: (date) => request(`/api/bookings/by-date?date=${date}`),
  searchBookings: (q) => request(`/api/bookings/search?q=${encodeURIComponent(q)}`),
  createBooking: (data) => request("/api/bookings", { method: "POST", body: JSON.stringify(data) }),
  updateBooking: (id, data) => request(`/api/bookings/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  checkIn: (id) => request(`/api/bookings/${id}/check-in`, { method: "POST" }),
  closeBooking: (id, totalAmount = 0, note = "") =>
    request(`/api/bookings/${id}/close`, { method: "POST", body: JSON.stringify({ total_amount: totalAmount, note }) }),
  cancelBooking: (id, reason) =>
    request(`/api/bookings/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  walkIn: (data) => request("/api/bookings/walk-in", { method: "POST", body: JSON.stringify(data) }),
  mergeTables: (fromId, toId) =>
    request("/api/bookings/merge", { method: "POST", body: JSON.stringify({ from_table_id: fromId, to_table_id: toId }) }),
  transferTable: (fromId, toId) =>
    request("/api/bookings/transfer", { method: "POST", body: JSON.stringify({ from_table_id: fromId, to_table_id: toId }) }),
  unmergeTable: (tableId, newTableId, guestCount) =>
    request("/api/bookings/unmerge", {
      method: "POST",
      body: JSON.stringify({ table_id: tableId, new_table_id: newTableId, guest_count: guestCount }),
    }),

  // CRM
  getCustomers: (search) => request(`/api/crm/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  getCustomer: (id) => request(`/api/crm/customers/${id}`),
  createCustomer: (data) => request("/api/crm/customers", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id, data) => request(`/api/crm/customers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/api/crm/customers/${id}`, { method: "DELETE" }),
  getCustomerVisits: (id) => request(`/api/crm/customers/${id}/visits`),
  lookupCustomer: (q) => request(`/api/crm/customers/lookup?q=${encodeURIComponent(q)}`),

  // Dashboard
  getDailyStats: (days = 7) => request(`/api/dashboard/daily-stats?days=${days}`),
  getStaffPerformance: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    const qs = params.toString();
    return request(`/api/dashboard/staff-performance${qs ? `?${qs}` : ""}`);
  },
  getOverview: () => request("/api/dashboard/overview"),
  getTopCustomers: () => request("/api/dashboard/top-customers"),
  getAuditLogs: () => request("/api/dashboard/audit-logs"),

  // Table Blocking
  getBlocks: (date) => request(`/api/blocks${date ? `?block_date=${date}` : ""}`),
  getActiveBlocks: (date) => request(`/api/blocks/active${date ? `?block_date=${date}` : ""}`),
  createBlock: (data) => request("/api/blocks", { method: "POST", body: JSON.stringify(data) }),
  createBlocksBulk: (data) => request("/api/blocks/bulk", { method: "POST", body: JSON.stringify(data) }),
  deleteBlock: (id) => request(`/api/blocks/${id}`, { method: "DELETE" }),
  deleteBlocksByDate: (date) => request(`/api/blocks/by-date/${date}`, { method: "DELETE" }),
};