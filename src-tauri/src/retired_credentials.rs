//! Remove only the retired integration's local credentials; never touch Google or notes.
use keyring::Entry;
use serde::Deserialize;

const SERVICE: &str = "app.threadnote.desktop";
const RECORD: &str = "chatgpt.accounts.v1";
#[derive(Deserialize)]
struct Manifest {
    generation: String,
    chunks: usize,
}
pub fn cleanup() {
    let Ok(entry) = Entry::new(SERVICE, RECORD) else {
        return;
    };
    let Ok(raw) = entry.get_password() else {
        return;
    };
    let Ok(manifest) = serde_json::from_str::<Manifest>(&raw) else {
        return;
    };
    if manifest.chunks > 1000
        || manifest.generation.len() != 36
        || !manifest
            .generation
            .chars()
            .all(|c| c.is_ascii_hexdigit() || c == '-')
    {
        return;
    }
    let mut removed = true;
    for index in 0..manifest.chunks {
        let key = format!("{RECORD}.{}.{index}", manifest.generation);
        match Entry::new(SERVICE, &key).and_then(|e| e.delete_credential()) {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(_) => removed = false,
        }
    }
    // Keep the manifest on failure so the next launch retries the remaining chunks.
    if removed {
        let _ = entry.delete_credential();
    }
}
