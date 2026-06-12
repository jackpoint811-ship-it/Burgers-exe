import type { OrderV2Environment } from "./contracts";

export type ChekeoRuntimeEnvironment = "local" | "preview" | "production";

export const PUBLIC_PRODUCTION_ORDER_URL = "https://burgers-exe.pages.dev/";
export const PUBLIC_PREVIEW_ORDER_URL =
  "https://burgers-exe-public-v2-preview.pages.dev/";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const normalizeHostname = (hostname: string) =>
  hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");

export const isLocalRuntimeHostname = (hostname: string) => {
  const normalized = normalizeHostname(hostname);
  return LOCAL_HOSTNAMES.has(normalized) || normalized.endsWith(".localhost");
};

export const isPreviewRuntimeHostname = (hostname: string) => {
  const normalized = normalizeHostname(hostname);
  return (
    normalized.includes("internal-v2-preview") ||
    normalized.includes("public-v2-preview") ||
    normalized.includes("preview")
  );
};

export const getChekeoRuntimeEnvironment = (
  hostname =
    typeof window === "undefined" ? "" : window.location.hostname,
): ChekeoRuntimeEnvironment => {
  if (isLocalRuntimeHostname(hostname)) return "local";
  if (isPreviewRuntimeHostname(hostname)) return "preview";
  return "production";
};

export const getOrderEnvironmentForChekeoRuntime = (
  environment: ChekeoRuntimeEnvironment,
): OrderV2Environment => (environment === "production" ? "production" : "preview");

export const getPublicOrderUrlForEnvironment = (
  environment: ChekeoRuntimeEnvironment,
) =>
  environment === "production"
    ? PUBLIC_PRODUCTION_ORDER_URL
    : PUBLIC_PREVIEW_ORDER_URL;

export const getPublicOrderLabelForEnvironment = (
  environment: ChekeoRuntimeEnvironment,
) =>
  environment === "production"
    ? "Ver Burgers.exe Producción"
    : "Ver Burgers.exe Preview";

export const getPublicOrderEnvironment = (
  hostname = typeof window === "undefined" ? "" : window.location.hostname,
  search = typeof window === "undefined" ? "" : window.location.search,
): OrderV2Environment => {
  const params = new URLSearchParams(search);
  const raw =
    params.get("environment") ??
    params.get("env") ??
    params.get("preview") ??
    "";
  const normalized = raw.trim().toLowerCase();

  if (normalized === "preview" || raw === "1") return "preview";
  if (normalized === "production" || normalized === "prod") return "production";
  return isPreviewRuntimeHostname(hostname) ? "preview" : "production";
};
