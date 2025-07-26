use crate::{SshKey, SshKeyUpdate, SshKeyLocation};
use std::fs;
use std::path::PathBuf;
use std::env;
use std::sync::Mutex;
use chrono::Utc;
use uuid::Uuid;
use aes::Aes256;
use aes::cipher::{
    BlockEncrypt, BlockDecrypt,
    KeyInit,
    generic_array::GenericArray,
};
use base64::{Engine as _, engine::general_purpose};
use rand::Rng;
use once_cell::sync::Lazy;
use rfd::FileDialog;
use sha2::{Sha256, Digest};
use serde::Serialize;

#[derive(Serialize)]
pub struct ImportResult {
    pub keys: Vec<SshKey>,
    pub imported_count: usize,
    pub duplicate_count: usize,
    pub total_in_store: usize,
}


// Machine-specific encryption key (derived from machine ID)
static MACHINE_KEY: Lazy<[u8; 32]> = Lazy::new(|| {
    let machine_id = get_machine_id();
    let mut hasher = Sha256::new();
    hasher.update(machine_id.as_bytes());
    hasher.update(b"ssh-kim-machine-key");
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
});

// Password-based encryption key (when user sets a password)
static PASSWORD_KEY: Lazy<Mutex<Option<[u8; 32]>>> = Lazy::new(|| Mutex::new(None));

// Get a unique machine identifier
fn get_machine_id() -> String {
    // Try to get hostname first
    if let Ok(hostname) = env::var("HOSTNAME") {
        return hostname;
    }
    
    // Fallback to computer name on macOS
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = std::process::Command::new("scutil")
            .arg("--get")
            .arg("ComputerName")
            .output() {
            if let Ok(name) = String::from_utf8(output.stdout) {
                return name.trim().to_string();
            }
        }
    }
    
    // Final fallback
    "unknown-machine".to_string()
}

// Derive encryption key from password
fn derive_key_from_password(password: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(b"ssh-kim-password-salt");
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

// Get the machine-specific encryption key (for local files)
fn get_encryption_key() -> [u8; 32] {
    *MACHINE_KEY
}

// Get password-based encryption key (for export/import)
fn get_password_encryption_key(password: &str) -> [u8; 32] {
    derive_key_from_password(password)
}

// Set password-based encryption key
fn set_password_key(password: &str) {
    let key = derive_key_from_password(password);
    if let Ok(mut password_key) = PASSWORD_KEY.lock() {
        *password_key = Some(key);
    }
}

// Clear password-based encryption key (fall back to machine-specific)
fn clear_password_key() {
    if let Ok(mut password_key) = PASSWORD_KEY.lock() {
        *password_key = None;
    }
}

// In-memory cache for SSH keys
static KEYS_CACHE: Lazy<Mutex<Option<Vec<SshKey>>>> = Lazy::new(|| Mutex::new(None));

// Global state for custom file path
static CUSTOM_FILE_PATH: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));

// Get keys from cache or load from file
fn get_cached_keys() -> Result<Vec<SshKey>, String> {
    let mut cache = KEYS_CACHE.lock().unwrap();
    if let Some(cached_keys) = &*cache {
        return Ok(cached_keys.clone());
    }
    
    // Load from file if not in cache
    let keys = load_keys()?;
    *cache = Some(keys.clone());
    Ok(keys)
}

// Update cache and save to file
fn update_cache_and_save(keys: Vec<SshKey>) -> Result<(), String> {
    // Save to file first
    save_keys(&keys)?;
    
    // Then update cache
    let mut cache = KEYS_CACHE.lock().unwrap();
    *cache = Some(keys);
    
    Ok(())
}

// Clear cache (useful for testing or when file changes externally)
fn clear_cache() {
    let mut cache = KEYS_CACHE.lock().unwrap();
    *cache = None;
}

// Get the path to the encrypted SSH keys file
fn get_keys_file_path() -> Result<PathBuf, String> {
    // Check if custom path is set
    let custom_path = CUSTOM_FILE_PATH.lock().unwrap();
    if let Some(path) = &*custom_path {
        return Ok(path.clone());
    }
    
    // Default to user's home directory
    let home_dir = get_home_dir()?;
    let ssh_kim_dir = home_dir.join(".ssh-kim");
    
    // Create .ssh-kim directory if it doesn't exist
    if !ssh_kim_dir.exists() {
        fs::create_dir_all(&ssh_kim_dir)
            .map_err(|e| format!("Failed to create .ssh-kim directory: {}", e))?;
    }
    
    Ok(ssh_kim_dir.join("keys.enc"))
}

// Get user's home directory
fn get_home_dir() -> Result<PathBuf, String> {
    env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "Failed to get home directory".to_string())
}

// Encrypt data
fn encrypt_data(data: &str) -> Result<String, String> {
    let cipher = Aes256::new_from_slice(&get_encryption_key())
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    let mut rng = rand::thread_rng();
    let iv: [u8; 16] = rng.gen();
    
    // Pad data to 16-byte blocks
    let mut padded_data = data.as_bytes().to_vec();
    let padding = 16 - (padded_data.len() % 16);
    padded_data.extend(std::iter::repeat(padding as u8).take(padding));
    
    let mut encrypted = Vec::new();
    encrypted.extend_from_slice(&iv);
    
    for chunk in padded_data.chunks(16) {
        let mut block = GenericArray::clone_from_slice(chunk);
        cipher.encrypt_block(&mut block);
        encrypted.extend_from_slice(block.as_slice());
    }
    
    Ok(general_purpose::STANDARD.encode(encrypted))
}

// Decrypt data
fn decrypt_data(encrypted_data: &str) -> Result<String, String> {
    let cipher = Aes256::new_from_slice(&get_encryption_key())
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    let encrypted_bytes = general_purpose::STANDARD.decode(encrypted_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    if encrypted_bytes.len() < 16 {
        return Err("Invalid encrypted data".to_string());
    }
    
    let _iv = &encrypted_bytes[..16];
    let data = &encrypted_bytes[16..];
    
    let mut decrypted = Vec::new();
    
    for chunk in data.chunks(16) {
        let mut block = GenericArray::clone_from_slice(chunk);
        cipher.decrypt_block(&mut block);
        decrypted.extend_from_slice(block.as_slice());
    }
    
    // Remove padding
    if let Some(&padding) = decrypted.last() {
        if padding <= 16 && padding > 0 {
            decrypted.truncate(decrypted.len() - padding as usize);
        }
    }
    
    String::from_utf8(decrypted)
        .map_err(|e| format!("Failed to convert to string: {}", e))
}

// Load SSH keys from encrypted file
fn load_keys() -> Result<Vec<SshKey>, String> {
    let keys_file = get_keys_file_path()?;
    
    if !keys_file.exists() {
        return Ok(Vec::new());
    }
    
    let encrypted_content = fs::read_to_string(&keys_file)
        .map_err(|e| format!("Failed to read keys file: {}", e))?;
    
    let decrypted_content = decrypt_data(&encrypted_content)?;
    
    serde_json::from_str(&decrypted_content)
        .map_err(|e| format!("Failed to parse keys file: {}", e))
}

// Save SSH keys to encrypted file
fn save_keys(keys: &[SshKey]) -> Result<(), String> {
    let keys_file = get_keys_file_path()?;
    
    let content = serde_json::to_string_pretty(keys)
        .map_err(|e| format!("Failed to serialize keys: {}", e))?;
    
    let encrypted_content = encrypt_data(&content)?;
    
    fs::write(&keys_file, encrypted_content)
        .map_err(|e| format!("Failed to write keys file: {}", e))
}

// Detect SSH key type from key content
fn detect_key_type(key_content: &str) -> String {
    if key_content.contains("ssh-rsa") {
        "rsa".to_string()
    } else if key_content.contains("ssh-dss") {
        "dsa".to_string()
    } else if key_content.contains("ecdsa-") {
        "ecdsa".to_string()
    } else if key_content.contains("ssh-ed25519") {
        "ed25519".to_string()
    } else {
        "unknown".to_string()
    }
}

// Get default SSH directory for current user
fn get_default_ssh_dir() -> Result<PathBuf, String> {
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .map_err(|_| "Failed to get home directory")?;
    
    Ok(PathBuf::from(home_dir).join(".ssh"))
}

// Get common SSH public key locations
fn get_common_ssh_locations() -> Vec<PathBuf> {
    let mut locations = Vec::new();
    
    // Default SSH directory (contains public keys)
    if let Ok(home_dir) = env::var("HOME").or_else(|_| env::var("USERPROFILE")) {
        locations.push(PathBuf::from(home_dir).join(".ssh"));
    }
    
    // Windows-specific locations (PuTTY stores public keys)
    #[cfg(target_os = "windows")]
    {
        if let Ok(app_data) = env::var("APPDATA") {
            locations.push(PathBuf::from(app_data).join("PuTTY"));
        }
    }
    
    locations
}

// Scan directory for SSH public keys
fn scan_directory_for_keys(dir_path: &std::path::Path) -> Result<Vec<String>, String> {
    if !dir_path.exists() || !dir_path.is_dir() {
        return Ok(Vec::new());
    }
    
    let mut keys = Vec::new();
    
    for entry in fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory {}: {}", dir_path.display(), e))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            let file_name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            
            // Only look for public key files (.pub extension)
            if file_name.ends_with(".pub") {
                if let Ok(content) = fs::read_to_string(&path) {
                    // Verify it's actually a public key by checking for SSH key format
                    if content.contains("ssh-") && content.lines().count() == 1 {
                        keys.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    
    Ok(keys)
}

#[tauri::command]
pub fn get_ssh_keys() -> Result<Vec<SshKey>, String> {
    get_cached_keys()
}

#[tauri::command]
pub fn add_ssh_key(name: String, tag: Option<String>, key_content: String) -> Result<SshKey, String> {
    let mut keys = get_cached_keys()?;
    
    // Check for duplicate keys by comparing the key content
    if keys.iter().any(|k| k.key.trim() == key_content.trim()) {
        return Err("A key with this content already exists".to_string());
    }
    
    // Check for duplicate names
    if keys.iter().any(|k| k.name.trim().to_lowercase() == name.trim().to_lowercase()) {
        return Err("A key with this name already exists".to_string());
    }
    
    let now = Utc::now();
    let trimmed_key_content = key_content.trim().to_string();
    let key_type = detect_key_type(&trimmed_key_content);
    let new_key = SshKey {
        id: Uuid::new_v4().to_string(),
        name,
        tag,
        key: trimmed_key_content,
        key_type,
        created: now,
        last_modified: now,
    };
    
    keys.push(new_key.clone());
    update_cache_and_save(keys)?;
    
    Ok(new_key)
}

#[tauri::command]
pub fn update_ssh_key(id: String, update: SshKeyUpdate) -> Result<SshKey, String> {
    let mut keys = get_cached_keys()?;
    
    let key_index = keys.iter().position(|k| k.id == id)
        .ok_or("Key not found")?;
    
    // Check for duplicate names (excluding the current key)
    if let Some(name) = &update.name {
        if keys.iter().any(|k| k.id != id && k.name.trim().to_lowercase() == name.trim().to_lowercase()) {
            return Err("A key with this name already exists".to_string());
        }
    }
    
    // Check for duplicate key content (excluding the current key)
    if let Some(key_content) = &update.key {
        if keys.iter().any(|k| k.id != id && k.key.trim() == key_content.trim()) {
            return Err("A key with this content already exists".to_string());
        }
    }
    
    if let Some(name) = update.name {
        keys[key_index].name = name;
    }
    
    if let Some(tag) = update.tag {
        keys[key_index].tag = Some(tag);
    }
    
    if let Some(key_content) = update.key {
        let trimmed_key_content = key_content.trim().to_string();
        keys[key_index].key = trimmed_key_content;
        keys[key_index].key_type = detect_key_type(&keys[key_index].key);
    }
    
    keys[key_index].last_modified = Utc::now();
    
    let updated_key = keys[key_index].clone();
    update_cache_and_save(keys)?;
    
    Ok(updated_key)
}

#[tauri::command]
pub fn remove_ssh_key(id: String) -> Result<(), String> {
    println!("Attempting to remove key with ID: {}", id);
    let mut keys = get_cached_keys()?;
    println!("Loaded {} keys", keys.len());
    
    let initial_count = keys.len();
    let key_ids: Vec<&String> = keys.iter().map(|k| &k.id).collect();
    println!("Available key IDs: {:?}", key_ids);
    
    keys.retain(|k| k.id != id);
    let final_count = keys.len();
    println!("Keys after removal: {} (removed {})", final_count, initial_count - final_count);
    
    if final_count == initial_count {
        println!("Key not found: {}", id);
        return Err("Key not found".to_string());
    }
    
    update_cache_and_save(keys)?;
    println!("Key successfully removed and saved");
    
    Ok(())
}

#[tauri::command]
pub fn scan_ssh_locations() -> Result<Vec<SshKeyLocation>, String> {
    let locations = get_common_ssh_locations();
    let mut results = Vec::new();
    
    for location in locations {
        let exists = location.exists();
        let keys = if exists {
            scan_directory_for_keys(&location)?
        } else {
            Vec::new()
        };
        
        results.push(SshKeyLocation {
            path: location.to_string_lossy().to_string(),
            exists,
            keys,
        });
    }
    
    Ok(results)
}

#[tauri::command]
pub fn read_ssh_key_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(&file_path)
        .map(|content| content.trim().to_string())
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))
}

#[tauri::command]
pub fn get_default_ssh_directory() -> Result<String, String> {
    get_default_ssh_dir()
        .map(|p| p.to_string_lossy().to_string())
} 

#[tauri::command]
pub fn clear_ssh_keys_cache() -> Result<(), String> {
    clear_cache();
    Ok(())
} 

#[tauri::command]
pub fn test_delete_key(id: String) -> Result<(), String> {
    println!("=== TEST DELETE KEY ===");
    println!("Testing delete for key ID: {}", id);
    
    // Bypass cache and work directly with file
    let mut keys = load_keys()?;
    println!("Loaded {} keys from file", keys.len());
    
    let initial_count = keys.len();
    keys.retain(|k| k.id != id);
    let final_count = keys.len();
    
    println!("Keys after removal: {} (removed {})", final_count, initial_count - final_count);
    
    if final_count == initial_count {
        println!("Key not found: {}", id);
        return Err("Key not found".to_string());
    }
    
    save_keys(&keys)?;
    println!("Key successfully removed and saved to file");
    
    // Clear cache to force reload
    clear_cache();
    println!("Cache cleared");
    
    Ok(())
} 

#[tauri::command]
pub fn force_reload_keys() -> Result<Vec<SshKey>, String> {
    println!("Force reloading keys from file...");
    clear_cache();
    let keys = get_cached_keys()?;
    println!("Reloaded {} keys", keys.len());
    Ok(keys)
}

#[tauri::command]
pub fn get_keys_file_location() -> Result<String, String> {
    let path = get_keys_file_path()?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_custom_keys_file_path(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    
    // Validate the path
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Err("Parent directory does not exist".to_string());
        }
    }
    
    // Set the custom path
    let mut custom_path = CUSTOM_FILE_PATH.lock().unwrap();
    *custom_path = Some(path);
    
    // Clear cache to force reload from new location
    clear_cache();
    
    Ok(())
}

#[tauri::command]
pub fn load_keys_from_file(file_path: String) -> Result<Vec<SshKey>, String> {
    println!("🔍 load_keys_from_file: Starting with file_path: {}", file_path);
    let path = PathBuf::from(&file_path);
    println!("🔍 load_keys_from_file: Converted to PathBuf: {:?}", path);
    
    // Validate file exists
    if !path.exists() {
        println!("❌ load_keys_from_file: File does not exist: {}", file_path);
        return Err("File does not exist".to_string());
    }
    println!("✅ load_keys_from_file: File exists");
    
    // Check if it's a file (not a directory)
    if !path.is_file() {
        println!("❌ load_keys_from_file: Path is not a file: {}", file_path);
        return Err("Path is not a file".to_string());
    }
    println!("✅ load_keys_from_file: Path is a file");
    
    // Read and decrypt the file
    println!("🔍 load_keys_from_file: Reading file content...");
    let encrypted_content = fs::read_to_string(&path)
        .map_err(|e| {
            println!("❌ load_keys_from_file: Failed to read file {}: {}", file_path, e);
            format!("Failed to read file: {}", e)
        })?;
    println!("✅ load_keys_from_file: Successfully read file, content length: {}", encrypted_content.len());
    
    println!("🔍 load_keys_from_file: Attempting to decrypt...");
    let decrypted_content = decrypt_data(&encrypted_content)
        .map_err(|e| {
            println!("❌ load_keys_from_file: Failed to decrypt file {}: {}", file_path, e);
            format!("Failed to decrypt: {}", e)
        })?;
    println!("✅ load_keys_from_file: Successfully decrypted file, content length: {}", decrypted_content.len());
    
    println!("🔍 load_keys_from_file: Parsing JSON...");
    let keys: Vec<SshKey> = serde_json::from_str(&decrypted_content)
        .map_err(|e| {
            println!("❌ load_keys_from_file: Failed to parse JSON from file {}: {}", file_path, e);
            format!("Failed to parse keys file: {}", e)
        })?;
    println!("✅ load_keys_from_file: Successfully parsed {} keys from file", keys.len());
    
    // Set this as the current custom path
    println!("🔍 load_keys_from_file: Setting custom path...");
    let mut custom_path = CUSTOM_FILE_PATH.lock().unwrap();
    *custom_path = Some(path);
    println!("✅ load_keys_from_file: Set custom path");
    
    // Update cache with loaded keys
    println!("🔍 load_keys_from_file: Updating cache...");
    let mut cache = KEYS_CACHE.lock().unwrap();
    *cache = Some(keys.clone());
    println!("✅ load_keys_from_file: Updated cache");
    
    println!("🎉 load_keys_from_file: Function completed successfully");
    Ok(keys)
}

#[tauri::command]
pub fn reset_to_default_path() -> Result<(), String> {
    // Clear custom path
    let mut custom_path = CUSTOM_FILE_PATH.lock().unwrap();
    *custom_path = None;
    
    // Clear cache to force reload from default location
    clear_cache();
    
    Ok(())
}

#[tauri::command]
pub fn get_current_file_path() -> Result<String, String> {
    let path = get_keys_file_path()?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn create_new_keys_file() -> Result<(), String> {
    // Create an empty keys array and save it
    let empty_keys: Vec<SshKey> = Vec::new();
    save_keys(&empty_keys)?;
    
    // Clear cache to force reload
    clear_cache();
    
    Ok(())
}

#[tauri::command]
pub fn export_keys_to_file(file_path: String) -> Result<(), String> {
    println!("Exporting keys to file: {}", file_path);
    let path = PathBuf::from(&file_path);
    
    // Get current keys
    let keys = get_cached_keys()?;
    println!("Exporting {} keys to {}", keys.len(), file_path);
    
    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    
    // Save keys to the specified location
    let content = serde_json::to_string_pretty(&keys)
        .map_err(|e| format!("Failed to serialize keys: {}", e))?;
    
    let encrypted_content = encrypt_data(&content)?;
    
    fs::write(&path, encrypted_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    println!("Successfully exported keys to {}", file_path);
    Ok(())
} 

#[tauri::command]
pub fn open_file_dialog() -> Option<String> {
    FileDialog::new()
        .add_filter("SSH Kim Files", &["enc"])
        .add_filter("All Files", &["*"])
        .set_title("Select SSH Kim File")
        .pick_file()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_save_dialog() -> Option<String> {
    FileDialog::new()
        .add_filter("SSH Kim Files", &["enc"])
        .add_filter("All Files", &["*"])
        .set_title("Save SSH Kim File")
        .set_file_name("ssh_kim_keys.enc")
        .save_file()
        .map(|path| path.to_string_lossy().to_string())
} 

#[tauri::command]
pub fn merge_keys_from_file(source_file_path: String) -> Result<Vec<SshKey>, String> {
    println!("🔍 merge_keys_from_file: Starting merge from source file: {}", source_file_path);
    
    // Try to load keys from the source file with current encryption
    let source_keys = match load_keys_from_file(source_file_path.clone()) {
        Ok(keys) => {
            println!("🔍 merge_keys_from_file: Successfully loaded {} keys with current encryption", keys.len());
            keys
        }
        Err(e) => {
            // If current encryption fails, try with machine-specific encryption
            println!("🔍 merge_keys_from_file: Current encryption failed, trying machine-specific: {}", e);
            
            // Temporarily clear password key to use machine-specific encryption
            clear_password_key();
            
            match load_keys_from_file(source_file_path.clone()) {
                Ok(keys) => {
                    println!("🔍 merge_keys_from_file: Successfully loaded {} keys with machine-specific encryption", keys.len());
                    keys
                }
                Err(e2) => {
                    println!("🔍 merge_keys_from_file: Machine-specific encryption also failed: {}", e2);
                    return Err(format!("Failed to decrypt file. The file may be password-protected or corrupted. Try using 'Import with Password Protection' instead."));
                }
            }
        }
    };
    
    // Get current keys
    let current_keys = get_cached_keys()?;
    println!("🔍 merge_keys_from_file: Current keys count: {}", current_keys.len());
    
    // Create a set of existing key IDs to avoid duplicates
    let existing_ids: std::collections::HashSet<String> = current_keys.iter()
        .map(|key| key.id.clone())
        .collect();
    
    // Filter out duplicates from source keys
    let new_keys: Vec<SshKey> = source_keys.into_iter()
        .filter(|key| !existing_ids.contains(&key.id))
        .collect();
    
    println!("🔍 merge_keys_from_file: Found {} new keys to merge", new_keys.len());
    
    // Combine current keys with new keys
    let merged_keys = [current_keys, new_keys].concat();
    println!("🔍 merge_keys_from_file: Total keys after merge: {}", merged_keys.len());
    
    // Save the merged keys
    save_keys(&merged_keys)?;
    println!("🔍 merge_keys_from_file: Saved merged keys");
    
    // Update cache
    let mut cache = KEYS_CACHE.lock().unwrap();
    *cache = Some(merged_keys.clone());
    
    println!("🎉 merge_keys_from_file: Merge completed successfully");
    Ok(merged_keys)
} 

#[tauri::command]
pub fn set_encryption_password(password: String) -> Result<(), String> {
    println!("🔍 set_encryption_password: Setting password-based encryption");
    set_password_key(&password);
    println!("✅ set_encryption_password: Password-based encryption enabled");
    Ok(())
}

#[tauri::command]
pub fn clear_encryption_password() -> Result<(), String> {
    println!("🔍 clear_encryption_password: Clearing password-based encryption");
    clear_password_key();
    println!("✅ clear_encryption_password: Fallback to machine-specific encryption");
    Ok(())
}

#[tauri::command]
pub fn export_keys_with_password(file_path: String, password: String) -> Result<(), String> {
    println!("🔍 export_keys_with_password: Exporting with password protection");
    
    // Get current keys (decrypted from machine-specific encryption)
    let keys = get_cached_keys()?;
    println!("🔍 export_keys_with_password: Exporting {} keys", keys.len());
    
    // Create parent directory if it doesn't exist
    let path = PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    
    // Serialize keys to JSON
    let content = serde_json::to_string_pretty(&keys)
        .map_err(|e| format!("Failed to serialize keys: {}", e))?;
    
    // Encrypt with password-based encryption
    let password_key = get_password_encryption_key(&password);
    let cipher = Aes256::new_from_slice(&password_key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    let mut rng = rand::thread_rng();
    let iv: [u8; 16] = rng.gen();
    
    // Pad data to 16-byte blocks
    let mut padded_data = content.as_bytes().to_vec();
    let padding = 16 - (padded_data.len() % 16);
    padded_data.extend(std::iter::repeat(padding as u8).take(padding));
    
    let mut encrypted = Vec::new();
    encrypted.extend_from_slice(&iv);
    
    for chunk in padded_data.chunks(16) {
        let mut block = GenericArray::clone_from_slice(chunk);
        cipher.encrypt_block(&mut block);
        encrypted.extend_from_slice(block.as_slice());
    }
    
    let encrypted_content = general_purpose::STANDARD.encode(encrypted);
    
    // Write encrypted content to file
    fs::write(&path, encrypted_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    println!("✅ export_keys_with_password: Successfully exported with password protection");
    Ok(())
}

#[tauri::command]
pub fn import_keys_with_password(file_path: String, password: String) -> Result<ImportResult, String> {
    println!("🔍 import_keys_with_password: Importing with password protection");
    
    // Read encrypted file
    let encrypted_content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Decrypt with password-based encryption
    let password_key = get_password_encryption_key(&password);
    let cipher = Aes256::new_from_slice(&password_key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;
    
    let encrypted_bytes = general_purpose::STANDARD.decode(&encrypted_content)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    if encrypted_bytes.len() < 16 {
        return Err("Invalid encrypted data".to_string());
    }
    
    let _iv = &encrypted_bytes[..16];
    let data = &encrypted_bytes[16..];
    
    let mut decrypted = Vec::new();
    
    for chunk in data.chunks(16) {
        let mut block = GenericArray::clone_from_slice(chunk);
        cipher.decrypt_block(&mut block);
        decrypted.extend_from_slice(block.as_slice());
    }
    
    // Remove padding
    if let Some(&padding) = decrypted.last() {
        if padding <= 16 && padding > 0 {
            decrypted.truncate(decrypted.len() - padding as usize);
        }
    }
    
    let decrypted_content = String::from_utf8(decrypted)
        .map_err(|e| format!("Failed to convert to string: {}", e))?;
    
    // Parse keys from JSON
    let imported_keys: Vec<SshKey> = serde_json::from_str(&decrypted_content)
        .map_err(|e| format!("Failed to parse keys file: {}", e))?;
    
    println!("🔍 import_keys_with_password: Successfully decrypted {} keys", imported_keys.len());
    
    // Get current keys to check for duplicates
    let current_keys = get_cached_keys()?;
    println!("🔍 import_keys_with_password: Current keys count: {}", current_keys.len());
    
    // Create a set of existing key IDs to check for duplicates
    let existing_ids: std::collections::HashSet<String> = current_keys.iter()
        .map(|key| key.id.clone())
        .collect();
    
    // Filter out duplicates from imported keys
    let new_keys: Vec<SshKey> = imported_keys.iter()
        .filter(|key| !existing_ids.contains(&key.id))
        .cloned()
        .collect();
    
    let duplicate_count = imported_keys.len() - new_keys.len();
    println!("🔍 import_keys_with_password: New keys: {}, Duplicates: {}", new_keys.len(), duplicate_count);
    
    if new_keys.len() == 0 {
        // All keys were duplicates - return current keys with duplicate info
        println!("✅ import_keys_with_password: All {} keys were duplicates", imported_keys.len());
        return Ok(ImportResult {
            keys: current_keys.clone(),
            imported_count: 0,
            duplicate_count: imported_keys.len(),
            total_in_store: current_keys.len(),
        });
    }
    
    // Merge new keys with current keys and save
    let merged_keys = [current_keys, new_keys.clone()].concat();
    save_keys(&merged_keys)?;
    
    // Update cache
    let mut cache = KEYS_CACHE.lock().unwrap();
    *cache = Some(merged_keys.clone());
    
    println!("✅ import_keys_with_password: Successfully imported {} new keys ({} duplicates skipped)", new_keys.len(), duplicate_count);
    
    Ok(ImportResult {
        keys: merged_keys.clone(),
        imported_count: new_keys.len(),
        duplicate_count,
        total_in_store: merged_keys.len(),
    })
}

#[tauri::command]
pub fn get_encryption_mode() -> Result<String, String> {
    if let Ok(password_key) = PASSWORD_KEY.lock() {
        if password_key.is_some() {
            Ok("password".to_string())
        } else {
            Ok("machine".to_string())
        }
    } else {
        Ok("machine".to_string())
    }
} 