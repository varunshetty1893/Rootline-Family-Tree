const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.detail || "Something went wrong. Please try again.");
  }

  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  logout: (token) => request("/auth/logout", { method: "POST", token }),
  me: (token) => request("/auth/me", { token }),
  forgotPassword: (email) =>
    request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, new_password) =>
    request("/auth/reset-password", { method: "POST", body: { token, new_password } }),
  googleLoginUrl: () => `${API_URL}/auth/google/login`,

  listPeople: (token) => request("/people", { token }),
  createPerson: (payload, token) =>
    request("/people", { method: "POST", body: payload, token }),
  updatePerson: (id, payload, token) =>
    request(`/people/${id}`, { method: "PATCH", body: payload, token }),
  deletePerson: (id, token) =>
    request(`/people/${id}`, { method: "DELETE", token }),
};
