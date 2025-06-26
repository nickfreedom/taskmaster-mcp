export const Logger = {
  isHTTP: false,
  log: (...args: unknown[]): void => {
    if (Logger.isHTTP) {
      // eslint-disable-next-line no-console
      console.log("[INFO]", ...args);
    } else {
      // eslint-disable-next-line no-console
      console.error("[INFO]", ...args);
    }
  },
  error: (...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.error("[ERROR]", ...args);
  },
};
