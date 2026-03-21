function normalizeApiBase(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function resolveApiBase() {
  const configured = (import.meta.env.VITE_API_URL || "").trim();
  if (configured) {
    return normalizeApiBase(configured);
  }

  if (import.meta.env.DEV) {
    return "http://localhost:4000/api";
  }

  // In production without explicit VITE_API_URL, use same-origin API.
  return normalizeApiBase(`${window.location.origin}/api`);
}

const API_BASE = resolveApiBase();

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

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
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

    return response.json();
  } catch (err) {
    if (err instanceof TypeError && err.message === "Failed to fetch") {
      console.error("Backend nicht erreichbar:", endpoint);
      const isDev = Boolean(import.meta.env.DEV);

      throw new Error(
        isDev
          ? "Backend Verbindung fehlgeschlagen. Bitte starten Sie npm run dev im /backend Ordner."
          : "Backend Verbindung fehlgeschlagen. Bitte pruefen Sie die Deployment-URL und CORS/ENV-Konfiguration."
      );
    }
    throw err;
  }
}
