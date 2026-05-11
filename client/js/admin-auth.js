async function enforceAdminAccess() {
  try {
    const response = await fetch("/api/auth/me", { credentials: 'include' });

    if (!response.ok) {
      window.location.replace("/pages/login.html");
      return;
    }

    const data = await response.json().catch(() => ({}));

    if (data?.user?.role === "admin") {
      return;
    }

    window.location.replace(data.redirectTo || "/index.html");
  } catch {
    window.location.replace("/pages/login.html");
  }
}

enforceAdminAccess();