export const API_BASE_URL = "https://api.haemilhub.org/api";

export const API_PATHS = {
  login: "/accounts/login/",
  refresh: "/accounts/token/refresh/",
  me: "/accounts/me/",
  accountsList: "/accounts/accounts/",
  signup: "/accounts/signup/",
  userPassword: (id) => `/accounts/users/${id}/password/`,
  userDelete: (id) => `/accounts/users/${id}/delete/`,
};
