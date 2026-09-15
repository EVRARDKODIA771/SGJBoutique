self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(payload.title || "JDE Parfum", {
      body: payload.body || "Nouvelle activité",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: {
        route: payload.route || "/dashboard",
        notificationId: payload.notificationId || null,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification.data?.route || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => "focus" in client);
        if (existing) {
          existing.navigate(route);
          return existing.focus();
        }
        return self.clients.openWindow(route);
      })
  );
});
