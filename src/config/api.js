export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "/api";

export const API_PATHS = {
  login: "/accounts/login/",
  refresh: "/accounts/token/refresh/",
  me: "/accounts/me/",
  signup: "/accounts/signup/",
  userPassword: (id) => `/accounts/users/${id}/password/`,
  userDelete: (id) => `/accounts/users/${id}/delete/`,
};
