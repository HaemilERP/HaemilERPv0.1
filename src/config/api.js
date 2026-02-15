// API base URL (all requests go to this backend)
export const API_BASE_URL = "http://34.64.146.213:8000/api";

export const API_PATHS = {
  login: "/accounts/login/",
  refresh: "/accounts/token/refresh/",
  me: "/accounts/me/",
  accountsList: "/accounts/accounts/",
  signup: "/accounts/signup/",
  userPassword: (id) => `/accounts/users/${id}/password/`,
  userDelete: (id) => `/accounts/users/${id}/delete/`,
};
