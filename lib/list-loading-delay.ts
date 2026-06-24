const parsedLogsDelay = Number(process.env.NEXT_PUBLIC_LOGS_LOAD_DELAY_MS ?? "2500");

/** Delay (ms) for Logs list fetch so loading UI can be previewed. Set env to `0` to disable. */
export const LOGS_LIST_LOAD_DELAY_MS =
  Number.isFinite(parsedLogsDelay) && parsedLogsDelay >= 0 ? parsedLogsDelay : 0;

export async function waitForListLoadingTestDelay(delayMs: number) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}
