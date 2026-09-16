import type { TgUpdate } from "./poll.js";

/** Private chats infer the owner from chat ID; groups require an explicit owner ID. */
export function isAuthorizedUpdate(update: TgUpdate, configuredChatId?: string, configuredOwnerId?: string): boolean {
  if (!configuredChatId || !/^-?[1-9]\d*$/.test(configuredChatId)) return false;
  const message = update.callback_query?.message ?? update.message;
  const user = update.callback_query?.from ?? update.message?.from;
  if (!message || !user || String(message.chat.id) !== configuredChatId) return false;
  const owner = configuredOwnerId || (configuredChatId.startsWith("-") ? undefined : configuredChatId);
  return Boolean(owner && /^[1-9]\d*$/.test(owner) && String(user.id) === owner);
}
