/** True if JWT exp is in the past or payload cannot be read. */
export function isIdTokenExpired(token: string): boolean {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return true;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const exp = typeof payload.exp === "number" ? payload.exp : 0;

    return exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
