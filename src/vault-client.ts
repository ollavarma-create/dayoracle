import { invoke } from "@tauri-apps/api/core";
import { makeBackup, parseBackup, type JournalBackup } from "./journal-backup";
import type { ForecastHistory } from "./forecast-history";
import type { ReflectionStore } from "./evening-reflection";

export type VaultState = { birthDate: string; intentions: Record<string, string>; reflections: ReflectionStore; forecasts?: ForecastHistory };
export type VaultStatus = "checking" | "unprotected" | "locked" | "unlocked";

export function serializeVault(state: VaultState): string {
  return JSON.stringify(makeBackup(state.birthDate, state.intentions, state.reflections, state.forecasts ?? {}));
}

export function deserializeVault(raw: string): VaultState {
  const parsed: JournalBackup = parseBackup(raw);
  return { birthDate: parsed.birthDate, intentions: parsed.intentions, reflections: parsed.reflections, forecasts: parsed.forecasts };
}

export async function vaultExists(): Promise<boolean> {
  return invoke<boolean>("vault_exists");
}

export async function createVault(password: string, state: VaultState): Promise<void> {
  await invoke("vault_create", { password, journalJson: serializeVault(state) });
}

export async function unlockVault(password: string): Promise<VaultState> {
  return deserializeVault(await invoke<string>("vault_read", { password }));
}

export async function writeVault(password: string, state: VaultState): Promise<void> {
  await invoke("vault_write", { password, journalJson: serializeVault(state) });
}

export async function changeVaultPassword(oldPassword: string, newPassword: string): Promise<void> {
  await invoke("vault_change_password", { oldPassword, newPassword });
}

export async function exportEncryptedVault(password: string): Promise<string> {
  return invoke<string>("vault_export", { password });
}

export async function importEncryptedVault(password: string, encryptedJson: string): Promise<void> {
  await invoke("vault_import", { password, encryptedJson });
}

/** Decrypt and validate an external backup without modifying the current vault. */
export async function previewEncryptedVault(password: string, encryptedJson: string): Promise<VaultState> {
  return deserializeVault(await invoke<string>("vault_preview_import", { password, encryptedJson }));
}

/** Permanently remove the active encrypted vault after password verification. */
export async function deleteVault(password: string): Promise<void> {
  await invoke("vault_delete", { password });
}
