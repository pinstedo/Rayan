import { useEffect } from "react";
import { Platform } from "react-native";

const upsertLink = (rel: string, href: string, attributes: Record<string, string> = {}) => {
  const selector = `link[rel="${rel}"]`;
  let link = document.head.querySelector<HTMLLinkElement>(selector);

  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }

  link.href = href;
  Object.entries(attributes).forEach(([key, value]) => link?.setAttribute(key, value));
};

const upsertMeta = (name: string, content: string) => {
  const selector = `meta[name="${name}"]`;
  let meta = document.head.querySelector<HTMLMetaElement>(selector);

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }

  meta.content = content;
};

export const PWASetup = () => {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    upsertLink("manifest", "/manifest.webmanifest");
    upsertLink("apple-touch-icon", "/pwa-icon-192.png", { sizes: "192x192" });
    upsertMeta("theme-color", "#0a84ff");
    upsertMeta("mobile-web-app-capable", "yes");
    upsertMeta("apple-mobile-web-app-capable", "yes");
    upsertMeta("apple-mobile-web-app-title", "Rayan");
    upsertMeta("apple-mobile-web-app-status-bar-style", "default");

    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.warn("PWA service worker registration failed", error);
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
};
