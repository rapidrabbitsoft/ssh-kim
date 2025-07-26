use serde::{Deserialize, Serialize};
use std::env;
use chrono::{DateTime, Utc};
use tauri_plugin_opener::init as init_opener;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshKey {
    pub id: String,
    pub name: String,
    pub tag: Option<String>,
    pub key: String,
    pub key_type: String,
    pub created: DateTime<Utc>,
    pub last_modified: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshKeyUpdate {
    pub name: Option<String>,
    pub tag: Option<String>,
    pub key: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SshKeyLocation {
    pub path: String,
    pub exists: bool,
    pub keys: Vec<String>,
}

mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(init_opener())
        .invoke_handler(tauri::generate_handler![
            get_ssh_keys,
            add_ssh_key,
            update_ssh_key,
            remove_ssh_key,
            scan_ssh_locations,
            read_ssh_key_file,
            get_default_ssh_directory,
            clear_ssh_keys_cache,
            test_delete_key,
            force_reload_keys,
            get_keys_file_location,
            set_custom_keys_file_path,
            load_keys_from_file,
            reset_to_default_path,
            get_current_file_path,
            create_new_keys_file,
            export_keys_to_file,
            open_file_dialog,
            open_save_dialog,
            merge_keys_from_file,
            set_encryption_password,
            clear_encryption_password,
            export_keys_with_password,
            import_keys_with_password,
            get_encryption_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
