import { createHash, timingSafeEqual } from "node:crypto";

/** A channel/actor label is not authentication. Only the isolated Telegram worker receives this service secret. */
export function telegramDecisionError(header: string | undefined, actor: unknown): { error: string; status: 403 | 503 } | null {
  const configured = process.env.TELEGRAM_APPROVAL_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  const owner = process.env.TELEGRAM_OWNER_USER_ID || (chat && /^[1-9]\d*$/.test(chat) ? chat : undefined);
  if (!configured || configured.length < 32 || !owner || !/^[1-9]\d*$/.test(owner)) return { error: "telegram_approval_not_configured", status: 503 };
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!header || !timingSafeEqual(hash(header), hash(configured)) || actor !== `telegram:${owner}`) return { error: "telegram_owner_approval_required", status: 403 };
  return null;
}
