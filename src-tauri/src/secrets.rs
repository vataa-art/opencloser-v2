//! OS keychain storage for provider API keys.
//!
//! Values live in the OS credential manager (Windows Credential Manager,
//! macOS Keychain, or the freedesktop Secret Service). They are never
//! written to localStorage, WebView storage, or the SQLite database.
//! An empty value passed to `secret_set` deletes the entry, so callers
//! can treat "clear" and "set empty" as the same operation.

use keyring::Entry;

const SERVICE: &str = "ai.opencloser.app";

fn entry(name: &str) -> Result<Entry, String> {
    let valid = !name.is_empty()
        && name.len() <= 128
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'));
    if !valid {
        return Err("Invalid secret name".into());
    }
    Entry::new(SERVICE, name).map_err(|e| format!("OS keychain unavailable: {}", e))
}

#[tauri::command]
pub fn secret_set(name: String, value: String) -> Result<(), String> {
    if value.is_empty() {
        return secret_delete(name);
    }
    entry(&name)?
        .set_password(&value)
        .map_err(|e| format!("Failed to store secret: {}", e))
}

#[tauri::command]
pub fn secret_get(name: String) -> Result<Option<String>, String> {
    match entry(&name)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to read secret: {}", e)),
    }
}

#[tauri::command]
pub fn secret_delete(name: String) -> Result<(), String> {
    match entry(&name)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete secret: {}", e)),
    }
}
