import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants";

export interface FetchOptions extends RequestInit {
    headers?: Record<string, string>;
    timeoutMs?: number;
}

// Session expiration notification system
type AuthListener = () => void;
const authListeners = new Set<AuthListener>();

export const onSessionExpired = (listener: AuthListener) => {
    authListeners.add(listener);
    return () => {
        authListeners.delete(listener);
    };
};

const notifySessionExpired = () => {
    authListeners.forEach((listener) => {
        try {
            listener();
        } catch (e) {
            console.error("Error notifying auth listener:", e);
        }
    });
};

// Helper to get token
export const getAccessToken = async () => {
    return await AsyncStorage.getItem("token");
};

// Helper to get refresh token
export const getRefreshToken = async () => {
    return await AsyncStorage.getItem("refreshToken");
};

// Helper to set tokens
export const setTokens = async (accessToken: string, refreshToken: string) => {
    await AsyncStorage.setItem("token", accessToken);
    await AsyncStorage.setItem("refreshToken", refreshToken);
};

// Helper to logout cleanly
export const logout = async () => {
    await AsyncStorage.multiRemove(["token", "refreshToken", "userData"]);
    notifySessionExpired();
};

// Singleton in-flight refresh promise mutex to completely prevent race conditions
let activeRefreshPromise: Promise<string | null> | null = null;

export const refreshSession = async (): Promise<string | null> => {
    if (activeRefreshPromise) {
        return activeRefreshPromise;
    }

    activeRefreshPromise = (async () => {
        try {
            const refreshToken = await getRefreshToken();
            if (!refreshToken) {
                await logout();
                return null;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            let refreshResponse: Response;
            try {
                refreshResponse = await fetch(`${API_URL}/auth/refresh-token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken }),
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeoutId);
            }

            if (refreshResponse.ok) {
                const data = await refreshResponse.json();
                if (data.accessToken && data.refreshToken) {
                    await setTokens(data.accessToken, data.refreshToken);
                }
                if (data.user) {
                    await AsyncStorage.setItem("userData", JSON.stringify(data.user));
                }
                return data.accessToken || null;
            }

            if (refreshResponse.status === 401 || refreshResponse.status === 403) {
                // Refresh token was explicitly rejected / revoked by server
                console.warn("Session revoked or expired. Logging out.");
                await logout();
                return null;
            }

            // Server returned 5xx or temporary status; do NOT logout, return null
            return null;
        } catch (error) {
            // Network failure or timeout (e.g. mobile reconnecting after background).
            // Do NOT log the user out on network failure!
            console.warn("Token refresh network attempt failed:", error);
            return null;
        } finally {
            activeRefreshPromise = null;
        }
    })();

    return activeRefreshPromise;
};

// Safe fetch with AbortController timeout to prevent hanging on severed sockets
const executeWithTimeout = async (url: string, options: FetchOptions = {}): Promise<Response> => {
    const timeoutMs = options.timeoutMs ?? 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
        options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

export const api = {
    fetch: async (url: string, options: FetchOptions = {}): Promise<Response> => {
        let token = await getAccessToken();

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        let response: Response;
        try {
            response = await executeWithTimeout(url, { ...options, headers });
        } catch (fetchErr: any) {
            // If the network call failed due to a severed socket after waking from background sleep,
            // retry once with a fresh timeout.
            if (fetchErr.name === "AbortError" || fetchErr.message?.includes("Network request failed")) {
                try {
                    response = await executeWithTimeout(url, { ...options, headers, timeoutMs: 12000 });
                } catch {
                    throw fetchErr;
                }
            } else {
                throw fetchErr;
            }
        }

        // If unauthorized or forbidden, access token likely expired during background sleep
        if (response.status === 403 || response.status === 401) {
            const newToken = await refreshSession();

            if (newToken) {
                headers["Authorization"] = `Bearer ${newToken}`;
                response = await executeWithTimeout(url, { ...options, headers });
            }
        }

        return response;
    },

    // Convenience methods
    get: (endpoint: string, options?: FetchOptions) =>
        api.fetch(`${API_URL}${endpoint}`, { method: "GET", ...options }),
    post: (endpoint: string, body?: any, options?: FetchOptions) =>
        api.fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            body: body !== undefined ? JSON.stringify(body) : undefined,
            ...options,
        }),
    put: (endpoint: string, body?: any, options?: FetchOptions) =>
        api.fetch(`${API_URL}${endpoint}`, {
            method: "PUT",
            body: body !== undefined ? JSON.stringify(body) : undefined,
            ...options,
        }),
    delete: (endpoint: string, options?: FetchOptions) =>
        api.fetch(`${API_URL}${endpoint}`, { method: "DELETE", ...options }),
};
