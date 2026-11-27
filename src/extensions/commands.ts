import { IikoCommandError, IikoTimeoutError } from "../core/errors.js";
import { sleep } from "../core/sleep.js";
import type { CallOptions } from "../core/types.js";
import type { CommandsStatusParams, CommandsStatusResponse } from "../transport/generated/types.js";

export type CommandStatus = CommandsStatusResponse;

export interface WaitOptions {
  /** Give up after this long. Defaults to 120 s; must be non-negative. */
  timeoutMs?: number;
  /** Delay between status calls. Defaults to 2 s; must be positive. */
  intervalMs?: number;
  /** Cancels the wait, including the sleep between polls. */
  signal?: AbortSignal;
}

/** Adds `wait` to the generated `commands` resource. */
export function commandsExtension(
  status: (body: CommandsStatusParams, options?: CallOptions) => Promise<CommandsStatusResponse>,
) {
  return {
    /**
     * Polls until the command succeeds.
     *
     * @throws RangeError when `timeoutMs` or `intervalMs` is invalid.
     * @throws IikoCommandError when iiko reports state `Error`.
     * @throws IikoTimeoutError when the command is still running at the deadline.
     * @throws IikoApiError when the status call fails; an unknown
     * `correlationId` is a 410 `PASSED_COMMAND_NOT_FOUND`.
     */
    async wait(
      body: CommandsStatusParams,
      { timeoutMs = 120_000, intervalMs = 2_000, signal }: WaitOptions = {},
    ) {
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
        throw new RangeError("iiko: commands.wait timeoutMs must be a non-negative number");
      }
      if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        throw new RangeError("iiko: commands.wait intervalMs must be a positive number");
      }

      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const current = await status(body, { signal });
        if (current.state === "Success") return current;
        if (current.state === "Error") {
          throw new IikoCommandError(body.correlationId, current.errorReason ?? undefined);
        }
        if (Date.now() + intervalMs > deadline) {
          throw new IikoTimeoutError(
            `iiko: command ${body.correlationId} still in progress after ${timeoutMs} ms`,
            { correlationId: body.correlationId },
          );
        }
        await sleep(intervalMs, signal);
      }
    },
  };
}
