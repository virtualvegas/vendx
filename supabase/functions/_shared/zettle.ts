export type ZettlePurchase = Record<string, unknown> & {
  purchaseUUID1?: string;
  purchaseNumber?: number | string;
  globalPurchaseNumber?: number | string;
  timestamp?: string;
  amount?: number;
  vatAmount?: number;
  currency?: string;
  source?: string;
  userUuid?: string;
  userDisplayName?: string;
  udid?: string;
  products?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
};

export async function getZettleAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_ZETTLE_CLIENT_ID");
  const apiKey = Deno.env.get("PAYPAL_ZETTLE_API_KEY");
  if (!clientId || !apiKey) {
    throw new Error("Native PayPal Zettle credentials are not configured");
  }

  const response = await fetch("https://oauth.zettle.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      client_id: clientId,
      assertion: apiKey,
    }),
  });
  if (!response.ok) {
    throw new Error(`Zettle sign-in failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  const body = await response.json();
  if (typeof body?.access_token !== "string") throw new Error("Zettle did not return an access token");
  return body.access_token;
}

export async function fetchZettlePurchases(options: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  lastPurchaseHash?: string;
} = {}): Promise<{ purchases: ZettlePurchase[]; lastPurchaseHash?: string }> {
  const token = await getZettleAccessToken();
  const url = new URL("https://purchase.izettle.com/purchases/v2");
  url.searchParams.set("limit", String(Math.min(Math.max(options.limit ?? 100, 1), 1000)));
  url.searchParams.set("descending", "false");
  if (options.startDate) url.searchParams.set("startDate", options.startDate);
  if (options.endDate) url.searchParams.set("endDate", options.endDate);
  if (options.lastPurchaseHash) url.searchParams.set("lastPurchaseHash", options.lastPurchaseHash);

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`Zettle Purchase API failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  const body = await response.json();
  return {
    purchases: Array.isArray(body?.purchases) ? body.purchases : [],
    lastPurchaseHash: typeof body?.lastPurchaseHash === "string" ? body.lastPurchaseHash : undefined,
  };
}

export async function fetchZettlePurchase(id: string): Promise<ZettlePurchase> {
  const token = await getZettleAccessToken();
  const response = await fetch(`https://purchase.izettle.com/purchases/v2/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Zettle purchase lookup failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  return await response.json();
}

export function minorUnits(value: unknown): number {
  return Number(value || 0) / 100;
}

export function purchaseId(purchase: ZettlePurchase): string | null {
  const value = purchase.purchaseUUID1 ?? purchase.globalPurchaseNumber ?? purchase.purchaseNumber;
  return value == null ? null : String(value);
}

export function purchaseRegisterId(purchase: ZettlePurchase): string | null {
  if (typeof purchase.udid === "string" && purchase.udid.trim()) return purchase.udid.trim();
  if (typeof purchase.userUuid === "string" && purchase.userUuid.trim()) return purchase.userUuid.trim();
  return null;
}

export function purchaseRegisterName(purchase: ZettlePurchase): string | null {
  return typeof purchase.userDisplayName === "string" && purchase.userDisplayName.trim()
    ? purchase.userDisplayName.trim()
    : null;
}