import { api } from "./apiClient";
import { API_PATHS } from "../config/api";
import { unwrapList } from "../utils/helpers";

export async function signupUser(payload) {
  const res = await api.post(API_PATHS.signup, payload);
  return res.data;
}

export async function listEmployees() {
  const res = await api.get(API_PATHS.accountsList);
  return unwrapList(res.data);
}

export async function updateUserPassword(id, newPassword) {
  const payload = { password: newPassword };

  try {
    const res = await api.patch(API_PATHS.userPassword(id), payload);
    return res.data;
  } catch (e) {
    // PATCH가 막혀있거나 바디 키가 다를 수 있으므로 PUT + 대체 키로 재시도
    const altPayloads = [
      payload,
      { new_password: newPassword },
      { password1: newPassword, password2: newPassword },
    ];

    for (const body of altPayloads) {
      try {
        const res2 = await api.put(API_PATHS.userPassword(id), body);
        return res2.data;
      } catch {
        // continue
      }
    }

    throw e;
  }
}

export async function deleteUser(id) {
  const res = await api.delete(API_PATHS.userDelete(id));
  return res.data;
}
