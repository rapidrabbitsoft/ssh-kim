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

// Encryption key (in a real app, this would be derived from user input or secure storage)
const ENCRYPTION_KEY: &[u8; 32] = b"ssh-kim-encryption-key-32bytes!!";

// In-memory cache for SSH keys
static KEYS_CACHE: Lazy<Mutex<Option<Vec<SshKey>>>> = Lazy::new(|| Mutex::new(None));

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
    let app_data_dir = get_app_data_dir()?;
    Ok(app_data_dir.join("ssh_keys.enc"))
}

// Get application data directory (now portable within app directory)
fn get_app_data_dir() -> Result<PathBuf, String> {
    // Get the current executable's directory
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;
    
    let app_dir = current_exe.parent()
        .ok_or("Failed to get app directory")?;
    
    // Create a data directory within the app directory
    let app_data_dir = app_dir.join("data");
    
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }

    Ok(app_data_dir)
}

// Encrypt data
fn encrypt_data(data: &str) -> Result<String, String> {
    let cipher = Aes256::new_from_slice(ENCRYPTION_KEY)
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
    let cipher = Aes256::new_from_slice(ENCRYPTION_KEY)
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