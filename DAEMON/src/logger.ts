import { config } from "./config.js";

const levels = { debug: 0, info: 1, warn: 2, error: 3 } as const;
const active = levels[config.logLevel];

function fmt(level: string, msg: string, meta?: unknown) {
  const time = new Date().toISOString();
  const tag = `[${time}] [${level.toUpperCase()}]`;
  if (meta !== undefined) return `${tag} ${msg} ${JSON.stringify(meta)}`;
  return `${tag} ${msg}`;
}

export const log = {
  debug: (msg: string, meta?: unknown) =>
    active <= 0 && console.log(fmt("debug", msg, meta)),
  info: (msg: string, meta?: unknown) =>
    active <= 1 && console.log(fmt("info", msg, meta)),
  warn: (msg: string, meta?: unknown) =>
    active <= 2 && console.warn(fmt("warn", msg, meta)),
  error: (msg: string, meta?: unknown) =>
    active <= 3 && console.error(fmt("error", msg, meta)),
};
