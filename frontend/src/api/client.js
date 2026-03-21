function normalizeApiBase(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function resolveApiBase() {
  const configured = (import.meta.env.VITE_API_URL || "").trim();
  if (configured) {
    return normalizeApiBase(configured);
  }

  // Default to deployed Railway API when no env override is set.
  return "https://website-production-17fc.up.railway.app/api";
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
          ? "Backend Verbindung fehlgeschlagen. Bitte pruefen Sie VITE_API_URL oder die Railway-Domain."
          : "Backend Verbindung fehlgeschlagen. Bitte pruefen Sie die Deployment-URL und CORS/ENV-Konfiguration."
      );
    }
    throw err;
  }
}
