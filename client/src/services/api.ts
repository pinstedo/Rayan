import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants";

interface FetchOptions extends RequestInit {
    headers?: Record<string, string>;
}

// Helper to get token
const getAccessToken = async () => {
    return await AsyncStorage.getItem("token");
};

// Helper to get refresh token
const getRefreshToken = async () => {
    return await AsyncStorage.getItem("refreshToken");
};

// Helper to set tokens
const setTokens = async (accessToken: string, refreshToken: string) => {
    await AsyncStorage.setItem("token", accessToken);
    await AsyncStorage.setItem("refreshToken", refreshToken);
};

// Helper to logout
const logout = async () => {
    await AsyncStorage.multiRemove(["token", "refreshToken", "userData"]);
    // Since we can't easily access the router here without context,
    // we might need to handle navigation in the component or use a global event/state.
    // For now, requests will just fail and components should handle 401 redirect if needed,
    // or we can rely on the fact that the next app launch will check auth.
};

export const api = {
    fetch: async (url: string, options: FetchOptions = {}) => {
        let token = await getAccessToken();

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        let response = await fetch(url, { ...options, headers });

        if (response.status === 403 || response.status === 401) {
            // Token might be expired, try to refresh
            const refreshToken = await getRefreshToken();

            if (refreshToken) {
                try {
                    const refreshResponse = await fetch(`${API_URL}/auth/refresh-token`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ refreshToken }),
                    });

                    if (refreshResponse.ok) {
                        const data = await refreshResponse.json();
                        await setTokens(data.accessToken, data.refreshToken);
                        token = data.accessToken;

                        // Retry original request with new token
                        headers["Authorization"] = `Bearer ${token}`;
                        response = await fetch(url, { ...options, headers });
                    } else {
                        // Refresh failed, logout
                        await logout();
                    }
                } catch (error) {
                    console.error("Token refresh failed", error);
                    await logout();
                }
            } else {
                await logout();
            }
        }

        return response;
    },

    // Convenience methods
    get: (endpoint: string) => api.fetch(`${API_URL}${endpoint}`),
    post: (endpoint: string, body: any) => api.fetch(`${API_URL}${endpoint}`, { method: "POST", body: JSON.stringify(body) }),
    put: (endpoint: string, body: any) => api.fetch(`${API_URL}${endpoint}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (endpoint: string) => api.fetch(`${API_URL}${endpoint}`, { method: "DELETE" }),
};
