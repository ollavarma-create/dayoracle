mod biorhythm;
mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            biorhythm::get_biorhythms,
            vault::vault_exists,
            vault::vault_delete,
            vault::vault_create,
            vault::vault_read,
            vault::vault_write,
            vault::vault_change_password,
            vault::vault_export,
            vault::vault_import,
            vault::vault_preview_import
        ])
        .run(tauri::generate_context!())
        .expect("failed to run DayOracle");
}
