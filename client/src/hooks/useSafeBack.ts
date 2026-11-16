import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { getHomeRouteForRole } from "../utils/roles";

export async function resolveFallbackRoute(fallbackRoute?: string): Promise<string> {
	if (fallbackRoute) return fallbackRoute;
	try {
		const userDataStr = await AsyncStorage.getItem("userData");
		if (userDataStr) {
			const user = JSON.parse(userDataStr);
			return getHomeRouteForRole(user?.role);
		}
	} catch {
		// ignore
	}
	return "/(tabs)/home";
}

export function safeBack(router: ReturnType<typeof useRouter>, fallbackRoute?: string) {
	if (router.canGoBack()) {
		router.back();
		return;
	}

	if (fallbackRoute) {
		router.replace(fallbackRoute as any);
		return;
	}

	resolveFallbackRoute().then((route) => {
		router.replace(route as any);
	});
}

export function useSafeBack(fallbackRoute?: string) {
	const router = useRouter();

	return useCallback(() => {
		safeBack(router, fallbackRoute);
	}, [router, fallbackRoute]);
}
