const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const apiRequest = async (path, options = {}) => {
  const token = localStorage.getItem("token");
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
};

export const uploadFormRequest = async (path, formData, options = {}) => {
  const token = localStorage.getItem("token");
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
};
