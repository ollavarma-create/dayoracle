mod biorhythm;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![biorhythm::get_biorhythms])
        .run(tauri::generate_context!())
        .expect("failed to run DayOracle");
}
