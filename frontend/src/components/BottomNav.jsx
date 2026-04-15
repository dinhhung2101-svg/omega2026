import { Link, useLocation } from "react-router-dom";
import {
  CalendarCheck, Users, BarChart3, Settings
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { path: "/booking",   label: "Đặt Bàn",  icon: CalendarCheck, roles: ["admin", "manager", "staff"] },
  { path: "/crm",       label: "CRM",       icon: Users,         roles: ["admin", "manager", "staff"] },
  { path: "/dashboard", label: "Dashboard", icon: BarChart3,     roles: ["admin", "manager"] },
  { path: "/settings",  label: "Cài Đặt",   icon: Settings,      roles: ["admin", "manager", "staff"] },
];

export default function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();

  const filteredNav = NAV_ITEMS.filter(item =>
    item.roles.includes(user?.role || "staff")
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {filteredNav.map(item => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            relative="path"
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-colors"
          >
            <div
              className={`flex flex-col items-center gap-0.5 ${
                isActive
                  ? "text-primary"
                  : "text-gray-400"
              }`}
            >
              {isActive && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
              )}
              <Icon
                className={`w-5 h-5 ${isActive ? "scale-110" : ""} transition-transform`}
              />
              <span className="text-[10px] font-medium leading-tight">
                {item.label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
