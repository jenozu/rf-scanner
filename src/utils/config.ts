/**
 * App configuration helpers
 */

export function getStagingBinCode(): string {
  const configured = localStorage.getItem("rf_config_staging_bin");
  return configured || "D-01-01"; // default to Receiving zone bin
}

export function setStagingBinCode(binCode: string) {
  localStorage.setItem("rf_config_staging_bin", binCode.toUpperCase());
}

