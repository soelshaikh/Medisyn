import apiClient from "@/lib/apiClient";

export const filesApi = {
  getSignedUrl: (key: string) =>
    apiClient
      .get<{ data: { url: string; expiresIn?: number } }>("/files/signed-url", { params: { key } })
      .then((r) => r.data.data.url),
};

/** Returns true if the value is a storage key (not a full http URL). */
export function isStorageKey(value: string): boolean {
  return !value.startsWith("http://") && !value.startsWith("https://");
}
