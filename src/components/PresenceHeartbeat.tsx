"use client";

import { useEffect } from "react";

export default function PresenceHeartbeat() {
  useEffect(() => {
    let lastActivity = Date.now();
    const handleActivity = () => {
      lastActivity = Date.now();
    };

    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("click", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });

    // Initial ping
    fetch("/api/attendance/heartbeat", { method: "POST" }).catch(() => {});

    // Periodic ping every 2 minutes
    const timer = setInterval(() => {
      const isVisible = typeof document !== "undefined" && document.visibilityState === "visible";
      const isRecentlyActive = Date.now() - lastActivity < 5 * 60 * 1000;

      if (isVisible && isRecentlyActive) {
        fetch("/api/attendance/heartbeat", { method: "POST" }).catch(() => {});
      }
    }, 2 * 60 * 1000);

    return () => {
      clearInterval(timer);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, []);

  return null;
}
