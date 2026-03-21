function normalizeApiBase(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function resolveApiBase() {
  const configured = (import.meta.env.VITE_API_URL || "").trim();
  if (configured) {
    try {
      const configuredUrl = new URL(configured);
      const runningOnLocalhost = isLocalHostname(window.location.hostname);
      const configuredPointsToLocalhost = isLocalHostname(configuredUrl.hostname);

      // Ignore localhost API URLs when app is running on a deployed domain.
      if (!runningOnLocalhost && configuredPointsToLocalhost) {
        return "https://website-production-17fc.up.railway.app/api";
      }
    } catch {
      // Keep backward compatibility if configured is a non-URL path-like value.
    }

    return normalizeApiBase(configured);
  }

  // Default to deployed Railway API when no env override is set.
  return "https://website-production-17fc.up.railway.app/api";
}

const API_BASE = resolveApiBase();
const REQUEST_TIMEOUT_MS = 15000;

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) {
    return { "Content-Type": "application/json" };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export async function apiRequest(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const endpoint = `${API_BASE}${normalizedPath}`;
  const hasExternalSignal = Boolean(options.signal);
  const timeoutController = hasExternalSignal ? null : new AbortController();
  const timeoutId = hasExternalSignal
    ? null
    : setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      ...options,
      ...(timeoutController ? { signal: timeoutController.signal } : {}),
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      // Clear stale token and re-bootstrap guest session automatically.
      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new Event("auth:unauthorized"));
      }

      let message = "Unbekannter Fehler";
      try {
        const data = await response.json();
        message = data.message || message;
      } catch {
        message = `${response.status} ${response.statusText}`;
      }
      throw new Error(message);
    }

    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/pdf")) {
      return response.blob();
    }

    if (response.status === 204) {
      return null;
    }

    const responseText = await response.text();
    if (!responseText.trim()) {
      return null;
    }

    try {
      return JSON.parse(responseText);
    } catch {
      return { message: responseText };
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Die Anfrage hat zu lange gedauert. Bitte erneut versuchen.");
    }

    if (err instanceof TypeError && err.message === "Failed to fetch") {
      console.error("Backend nicht erreichbar:", endpoint);
      const isDev = Boolean(import.meta.env.DEV);

      throw new Error(
        isDev
          ? "Backend Verbindung fehlgeschlagen. Bitte prüfen Sie VITE_API_URL oder die Railway-Domain."
          : "Backend Verbindung fehlgeschlagen. Bitte prüfen Sie die Deployment-URL und CORS/ENV-Konfiguration."
      );
    }
    throw err;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
