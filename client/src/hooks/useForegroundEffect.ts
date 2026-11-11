import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

/**
 * Custom hook to run a callback whenever the app transitions from background / inactive to active (foreground).
 */
export const useForegroundEffect = (callback: () => void | Promise<void>) => {
    const savedCallback = useRef(callback);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        let lastState = AppState.currentState;

        const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
            if (lastState.match(/inactive|background/) && nextState === "active") {
                try {
                    savedCallback.current();
                } catch (err) {
                    console.error("Error in foreground effect callback:", err);
                }
            }
            lastState = nextState;
        });

        return () => {
            subscription.remove();
        };
    }, []);
};
