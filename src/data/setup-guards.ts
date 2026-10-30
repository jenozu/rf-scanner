/**
 * Guards for the two Setup actions that can wipe the shared inventory for every device.
 * They are there to stop accidents, not to stop a determined administrator.
 */

/** A server inventory list longer than this is treated as real data, not sample data. */
export const REAL_DATA_THRESHOLD = 20;

/** Why "Initialize Sample Data" must not run, or null if it may. */
export function sampleDataBlockedReason(serverItemCount: number): string | null {
  if (serverItemCount > REAL_DATA_THRESHOLD) {
    return `The server already holds ${serverItemCount} inventory items. Sample data would replace them for every device, so it is switched off.`;
  }
  return null;
}

export const CLEAR_CONFIRM_WORD = "CLEAR";

/** Whether "Clear All Data" may go ahead, given who asked and what they typed. */
export function clearDataCheck(
  role: string | undefined,
  typed: string | null
): { allowed: true } | { allowed: false; reason: string } {
  if (role !== "admin") {
    return { allowed: false, reason: "Only an administrator can clear the shared data." };
  }
  if (typed === null) return { allowed: false, reason: "Cancelled. Nothing was cleared." };
  if (typed.trim() !== CLEAR_CONFIRM_WORD) {
    return { allowed: false, reason: `You did not type ${CLEAR_CONFIRM_WORD}. Nothing was cleared.` };
  }
  return { allowed: true };
}

/**
 * Warning to show before replacing the inventory list from a file. Replacing rebuilds
 * EVERY bin from the file, so anything received, picked or counted since the file was
 * made is lost for all devices. Returns null when the server has no real inventory yet
 * (nothing to lose), otherwise the text for a confirm dialog.
 */
export function replaceInventoryWarning(serverItemCount: number, fileName?: string): string | null {
  if (serverItemCount <= REAL_DATA_THRESHOLD) return null;
  return (
    `Replace the inventory with ${fileName ? `"${fileName}"` : "this file"}?\n\n` +
    `The server holds ${serverItemCount} inventory items. This rebuilds ALL bins from the file for EVERY device: ` +
    `anything received, picked or counted since the file was made will be lost.\n\n` +
    `Use a fresh export. Take a backup first if you are not sure.`
  );
}
