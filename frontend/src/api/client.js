const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

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
  try {
    const response = await fetch(`${API_BASE}${path}`, {
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
      console.error("Backend nicht erreichbar:", `${API_BASE}${path}`);
      throw new Error(
        "Backend Verbindung fehlgeschlagen. Bitte starten Sie npm run dev im /backend Ordner."
      );
    }
    throw err;
  }
}
