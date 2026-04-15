import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { useState } from "react";
import { Sun, Moon, Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() =>
    localStorage.getItem("darkMode") === "true"
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("darkMode", next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar — desktop only */}
      <div className="hidden lg:block shrink-0">
        <Sidebar darkMode={darkMode} onToggleDark={toggleDark} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full w-64">
            <Sidebar darkMode={darkMode} onToggleDark={toggleDark} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className={`h-14 flex items-center gap-3 px-4 border-b shrink-0 ${
            darkMode ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200"
          }`}
        >
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className={`p-2 -ml-2 rounded-lg lg:hidden ${darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <button
            onClick={toggleDark}
            className={`p-2 rounded-lg ${darkMode ? "hover:bg-gray-800 text-yellow-400" : "hover:bg-gray-100 text-gray-600"}`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>

        {/* Bottom Nav — mobile only */}
        {user && <BottomNav />}
      </div>
    </div>
  );
}
