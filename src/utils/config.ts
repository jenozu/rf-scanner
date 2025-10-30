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

export function generateLicensePlateId(): string {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "");
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `LP-${ts}-${rand}`;
}


