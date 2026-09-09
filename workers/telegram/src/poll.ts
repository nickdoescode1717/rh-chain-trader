/**
 * Telegram Bot API long-poll (getUpdates) via raw fetch.
 * Dry-run skips network to Telegram.
 */

export type TgUpdate = {
  update_id: number;
  callback_query?: {
    id: string;
    from?: { id: number; username?: string };
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    from?: { id: number };
  };
};

export type TelegramBot = {
  token: string;
  dryRun: boolean;
  offset: number;
  apiCall: (method: string, body?: Record<string, unknown>) => Promise<unknown>;
  getUpdates: (timeoutSec?: number) => Promise<TgUpdate[]>;
  sendMessage: (
    chatId: string | number,
    text: string,
    replyMarkup?: unknown
  ) => Promise<unknown>;
  answerCallbackQuery: (id: string, text: string) => Promise<unknown>;
};

const TG_API = "https://api.telegram.org";

export function createTelegramBot(
  token: string | undefined,
  dryRun: boolean
): TelegramBot | null {
  if (!token || dryRun) {
    return null;
  }

  const bot: TelegramBot = {
    token,
    dryRun: false,
    offset: 0,

    async apiCall(method, body) {
      const url = `${TG_API}/bot${token}/${method}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as {
        ok: boolean;
        result?: unknown;
        description?: string;
      };
      if (!json.ok) {
        throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
      }
      return json.result;
    },

    async getUpdates(timeoutSec = 25) {
      const result = (await bot.apiCall("getUpdates", {
        offset: bot.offset,
        timeout: timeoutSec,
        allowed_updates: ["callback_query", "message"],
      })) as TgUpdate[];
      if (Array.isArray(result) && result.length > 0) {
        const last = result[result.length - 1];
        bot.offset = last.update_id + 1;
      }
      return Array.isArray(result) ? result : [];
    },

    async sendMessage(chatId, text, replyMarkup) {
      // Plain text — no parse_mode (Markdown breaks on 0x CAs / underscores).
      return bot.apiCall("sendMessage", {
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
      });
    },

    async answerCallbackQuery(id, text) {
      return bot.apiCall("answerCallbackQuery", {
        callback_query_id: id,
        text: text.slice(0, 200),
        show_alert: false,
      });
    },
  };

  return bot;
}

/** Dry-run logger that mimics bot surface without Telegram network */
export function createDryRunBot(): {
  dryRun: true;
  sendMessage: (
    chatId: string | number,
    text: string,
    replyMarkup?: unknown
  ) => Promise<void>;
  logUpdatesSkipped: () => void;
} {
  return {
    dryRun: true,
    async sendMessage(chatId, text, replyMarkup) {
      console.log(
        `[telegram-dry-run] sendMessage chat=${chatId}\n${text}\nkeyboard=${JSON.stringify(replyMarkup ?? null)}`
      );
    },
    logUpdatesSkipped() {
      console.log("[telegram-dry-run] getUpdates skipped (no token or DRY_RUN)");
    },
  };
}
