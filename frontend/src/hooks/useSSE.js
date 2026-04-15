import { useEffect, useRef } from "react";

// Đồng bộ với api/index.js: dev dùng proxy → URL tương đối
const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function useSSE(onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const url = `${API_BASE}/api/events`;
    let es = null;
    let reconnectTimer = null;

    const connect = () => {
      es = new EventSource(url);
      es.onmessage = (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch {
          // keep-alive hoặc không phải JSON
        }
      };
      es.onerror = () => {
        es.close();
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) es.close();
    };
  }, []);
}
