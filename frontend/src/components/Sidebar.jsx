import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarCheck, Users, BarChart3, Settings,
  LogOut, LayoutGrid, ChevronRight
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { path: "/booking", label: "Đặt Bàn", icon: CalendarCheck, roles: ["admin", "manager", "staff"] },
  { path: "/crm", label: "CRM", icon: Users, roles: ["admin", "manager", "staff"] },
  { path: "/dashboard", label: "Dashboard", icon: BarChart3, roles: ["admin", "manager"] },
  { path: "/settings", label: "Cài Đặt", icon: Settings, roles: ["admin", "manager"] },
];

export default function Sidebar({ darkMode, onToggleDark }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNav = NAV_ITEMS.filter(item =>
    item.roles.includes(user?.role || "staff")
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleLabels = { admin: "Admin", manager: "Quản lý", staff: "Nhân viên" };
  const roleColors = { admin: "bg-red-100 text-red-700", manager: "bg-amber-100 text-amber-700", staff: "bg-blue-100 text-blue-700" };

  return (
    <div className={`w-64 h-screen flex flex-col ${darkMode ? "bg-gray-900 text-white" : "bg-gray-800 text-white"}`}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base leading-tight">Restaurant</div>
            <div className="text-xs text-gray-400">Booking System</div>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/80 flex items-center justify-center text-sm font-bold">
            {user?.full_name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.full_name}</div>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${roleColors[user?.role] || "bg-gray-600 text-gray-300"}`}>
              {roleLabels[user?.role] || "Nhân viên"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {filteredNav.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : darkMode
                  ? "text-gray-300 hover:bg-gray-700 hover:text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-gray-700 space-y-1">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            darkMode ? "text-gray-400 hover:bg-gray-700 hover:text-red-400" : "text-gray-400 hover:bg-gray-700 hover:text-red-400"
          }`}
        >
          <LogOut className="w-4.5 h-4.5 flex-shrink-0" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
