//! Optional password-encrypted local journal. No password hints, accounts or network.
//! Format v1: Argon2id (64 MiB, 3 iterations) + AES-256-GCM.
//! The entire JSON payload, including dates and notes, is encrypted.
use aes_gcm::{aead::{Aead, KeyInit, OsRng}, Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::{Path, PathBuf}};
use tauri::Manager;
use zeroize::Zeroizing;

const FORMAT: &str = "dayoracle-encrypted-journal";
const MAX_PLAINTEXT: usize = 2_000_000;
const MAX_ENVELOPE: usize = 4_000_000;
const SALT_BYTES: usize = 16;
const NONCE_BYTES: usize = 12;

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    format: String,
    version: u8,
    kdf: String,
    salt: String,
    nonce: String,
    ciphertext: String,
}

fn derive_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>, String> {
    if password.is_empty() { return Err("Password must not be empty".into()); }
    let params = Params::new(65536, 3, 1, Some(32)).map_err(|_| "KDF configuration error")?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0u8; 32]);
    argon.hash_password_into(password.as_bytes(), salt, &mut *key)
        .map_err(|_| "Key derivation failed")?;
    Ok(key)
}

fn encrypt(password: &str, plaintext: &str) -> Result<String, String> {
    if plaintext.len() > MAX_PLAINTEXT { return Err("Journal exceeds 2 MB".into()); }
    // Enforce valid JSON so the vault cannot become a general arbitrary data sink.
    let _: serde_json::Value = serde_json::from_str(plaintext).map_err(|_| "Invalid journal JSON")?;
    let mut salt = [0u8; SALT_BYTES];
    let mut nonce = [0u8; NONCE_BYTES];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);
    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&*key).map_err(|_| "Cipher initialization failed")?;
    let encrypted = cipher.encrypt(Nonce::from_slice(&nonce), plaintext.as_bytes())
        .map_err(|_| "Encryption failed")?;
    use base64::{engine::general_purpose::STANDARD, Engine};
    serde_json::to_string(&Envelope {
        format: FORMAT.into(), version: 1, kdf: "argon2id-m65536-t3-p1".into(),
        salt: STANDARD.encode(salt), nonce: STANDARD.encode(nonce),
        ciphertext: STANDARD.encode(encrypted),
    }).map_err(|_| "Serialization failed".into())
}

fn decrypt(password: &str, raw: &str) -> Result<String, String> {
    if raw.len() > MAX_ENVELOPE { return Err("Encrypted journal too large".into()); }
    let envelope: Envelope = serde_json::from_str(raw).map_err(|_| "Invalid encrypted journal")?;
    if envelope.format != FORMAT || envelope.version != 1 || envelope.kdf != "argon2id-m65536-t3-p1" {
        return Err("Unsupported encrypted journal format".into());
    }
    use base64::{engine::general_purpose::STANDARD, Engine};
    let salt = STANDARD.decode(envelope.salt).map_err(|_| "Invalid salt")?;
    let nonce = STANDARD.decode(envelope.nonce).map_err(|_| "Invalid nonce")?;
    let ciphertext = STANDARD.decode(envelope.ciphertext).map_err(|_| "Invalid ciphertext")?;
    if salt.len() != SALT_BYTES || nonce.len() != NONCE_BYTES || ciphertext.len() > MAX_PLAINTEXT + 16 {
        return Err("Invalid encrypted journal dimensions".into());
    }
    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&*key).map_err(|_| "Cipher initialization failed")?;
    let plaintext = cipher.decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| "Wrong password or damaged journal")?;
    String::from_utf8(plaintext).map_err(|_| "Invalid decrypted text".into())
}

fn vault_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("journal.vault.json"))
}

fn read_vault(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|_| "Encrypted journal not found or unreadable".into())
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid vault location")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut tmp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    tmp.as_file().set_permissions(readonly_owner_permissions()).map_err(|e| e.to_string())?;
    tmp.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    tmp.as_file().sync_all().map_err(|e| e.to_string())?;
    tmp.persist(path).map_err(|e| e.error.to_string())?;
    Ok(())
}
#[cfg(unix)]
fn readonly_owner_permissions() -> fs::Permissions {
    use std::os::unix::fs::PermissionsExt;
    fs::Permissions::from_mode(0o600)
}
#[cfg(not(unix))]
fn readonly_owner_permissions() -> fs::Permissions {
    fs::Permissions::readonly()
}

#[tauri::command]
pub fn vault_exists(app: tauri::AppHandle) -> Result<bool, String> {
    Ok(vault_path(&app)?.exists())
}

#[tauri::command]
pub fn vault_create(app: tauri::AppHandle, password: String, journal_json: String) -> Result<(), String> {
    let path = vault_path(&app)?;
    if path.exists() { return Err("Encrypted journal already exists".into()); }
    let encrypted = encrypt(&password, &journal_json)?;
    atomic_write(&path, &encrypted)
}

#[tauri::command]
pub fn vault_read(app: tauri::AppHandle, password: String) -> Result<String, String> {
    decrypt(&password, &read_vault(&vault_path(&app)?)?)
}

#[tauri::command]
pub fn vault_write(app: tauri::AppHandle, password: String, journal_json: String) -> Result<(), String> {
    let path = vault_path(&app)?;
    // Never overwrite an existing vault without authenticating the old ciphertext.
    decrypt(&password, &read_vault(&path)?)?;
    atomic_write(&path, &encrypt(&password, &journal_json)?)
}

#[tauri::command]
pub fn vault_change_password(app: tauri::AppHandle, old_password: String, new_password: String) -> Result<(), String> {
    let path = vault_path(&app)?;
    let plaintext = Zeroizing::new(decrypt(&old_password, &read_vault(&path)?)?);
    atomic_write(&path, &encrypt(&new_password, &plaintext)?)
}

#[tauri::command]
pub fn vault_export(app: tauri::AppHandle, password: String) -> Result<String, String> {
    let raw = read_vault(&vault_path(&app)?)?;
    decrypt(&password, &raw)?; // Verify password and integrity before returning ciphertext.
    Ok(raw)
}

#[tauri::command]
pub fn vault_import(
    app: tauri::AppHandle,
    password: String,
    encrypted_json: String,
) -> Result<(), String> {
    let plaintext = Zeroizing::new(decrypt(&password, &encrypted_json)?);
    let _: serde_json::Value =
        serde_json::from_str(&plaintext).map_err(|_| "Invalid journal JSON")?;
    let path = vault_path(&app)?;
    if path.exists() {
        return Err("Encrypted journal already exists; import requires an empty vault".into());
    }
    atomic_write(&path, &encrypted_json)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roundtrip_and_wrong_password() {
        let original = r#"{"birthDate":"2000-01-01","note":"päiväkirja"}"#;
        let encrypted = encrypt("correct horse battery staple", original).unwrap();
        assert!(!encrypted.contains("päiväkirja"));
        assert_eq!(
            decrypt("correct horse battery staple", &encrypted).unwrap(),
            original
        );
        assert!(decrypt("wrong", &encrypted).is_err());
    }
    #[test]
    fn random_salt_and_nonce() {
        let a = encrypt("password", "{}").unwrap();
        let b = encrypt("password", "{}").unwrap();
        assert_ne!(a, b);
    }
    #[test]
    fn detects_tampering_and_unsupported_versions() {
        let raw = encrypt("password", "{}").unwrap();
        let mut value: serde_json::Value = serde_json::from_str(&raw).unwrap();
        value["version"] = 2.into();
        assert!(decrypt("password", &value.to_string()).is_err());
        let mut value: serde_json::Value = serde_json::from_str(&raw).unwrap();
        value["ciphertext"] = "AAAA".into();
        assert!(decrypt("password", &value.to_string()).is_err());
    }
    #[test]
    fn rejects_empty_password_and_non_json() {
        assert!(encrypt("", "{}").is_err());
        assert!(encrypt("password", "not JSON").is_err());
    }
}
