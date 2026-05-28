const resolveApiBaseUrl = () => {
  const configuredUrl = (import.meta.env.VITE_API_URL || "").trim();

  if (/app\.github\.dev/i.test(configuredUrl)) {
    return "/api";
  }

  return configuredUrl || "http://localhost:5000/api";
};

const API_URL = resolveApiBaseUrl();

const normalizeNetworkError = (error) => {
  if (error instanceof TypeError) {
    return new Error("Unable to reach the server. Make sure the backend is running and the API URL is correct.");
  }

  return error;
};

export const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  } catch (error) {
    throw normalizeNetworkError(error);
  }
};

export const uploadFormRequest = async (path, formData, options = {}) => {
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method || "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Upload failed");
    }

    return data;
  } catch (error) {
    throw normalizeNetworkError(error);
  }
};
