import { LS_KEYS } from "@/lib/constants";

export function getApiKey(): string {
  try {
    const raw = localStorage.getItem(LS_KEYS.STANDALONE_API_KEY);
    return raw ? JSON.parse(raw) : "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string) {
  localStorage.setItem(LS_KEYS.STANDALONE_API_KEY, JSON.stringify(key));
}

export function clearApiKey() {
  localStorage.removeItem(LS_KEYS.STANDALONE_API_KEY);
}

export function hasApiKey(): boolean {
  return getApiKey().trim().length > 0;
}

export function getEndpoint(): string {
  try {
    const raw = localStorage.getItem(LS_KEYS.STANDALONE_ENDPOINT);
    return raw ? JSON.parse(raw) : "https://openrouter.ai/api/v1/chat/completions";
  } catch {
    return "https://openrouter.ai/api/v1/chat/completions";
  }
}

export function setEndpoint(url: string) {
  localStorage.setItem(LS_KEYS.STANDALONE_ENDPOINT, JSON.stringify(url));
}
