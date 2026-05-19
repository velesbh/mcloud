import { config } from "./config.js";
const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const active = levels[config.logLevel];
function fmt(level, msg, meta) {
    const time = new Date().toISOString();
    const tag = `[${time}] [${level.toUpperCase()}]`;
    if (meta !== undefined)
        return `${tag} ${msg} ${JSON.stringify(meta)}`;
    return `${tag} ${msg}`;
}
export const log = {
    debug: (msg, meta) => active <= 0 && console.log(fmt("debug", msg, meta)),
    info: (msg, meta) => active <= 1 && console.log(fmt("info", msg, meta)),
    warn: (msg, meta) => active <= 2 && console.warn(fmt("warn", msg, meta)),
    error: (msg, meta) => active <= 3 && console.error(fmt("error", msg, meta)),
};
//# sourceMappingURL=logger.js.map