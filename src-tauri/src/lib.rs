mod agy;
mod ai;
mod db;
mod relay;
mod secrets;

use std::sync::Mutex;
use tauri::Manager;

struct RelayState {
    port: u16,
    token: String,
}

#[tauri::command]
fn get_relay_port(state: tauri::State<Mutex<RelayState>>) -> u16 {
    state.lock().unwrap().port
}

#[tauri::command]
fn get_relay_token(state: tauri::State<Mutex<RelayState>>) -> String {
    state.lock().unwrap().token.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            dotenvy::from_path("../.env").ok();
            db::schema::init(app.handle());

            // Start voice relay server for OpenAI/ElevenLabs/Deepgram.
            // A per-launch random token gates the loopback socket so that
            // random local processes cannot spend our provider credits.
            let relay_token = uuid::Uuid::new_v4().simple().to_string();
            let relay_port =
                tauri::async_runtime::block_on(relay::start_relay_server(relay_token.clone()))
                    .unwrap_or(0);
            app.manage(Mutex::new(RelayState {
                port: relay_port,
                token: relay_token,
            }));
            app.manage(agy::AgyState::default());
            log::info!("Voice relay available on port {}", relay_port);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::commands::get_leads,
            db::commands::update_lead_status,
            db::commands::add_leads,
            db::commands::get_call_logs,
            db::commands::add_call_log,
            db::commands::get_lead_call_logs,
            db::commands::get_lead_notes,
            db::commands::add_lead_note,
            db::commands::delete_lead,
            db::commands::set_lead_compliance,
            db::commands::assert_lead_callable,
            ai::gemini::generate_demo_leads,
            ai::gemini::process_onboarding_chat,
            ai::gemini::analyze_call_transcript,
            ai::gemini::objection_trainer_turn,
            ai::kb::kb_ingest_document,
            ai::kb::kb_search,
            ai::copilot::copilot_turn,
            get_relay_port,
            get_relay_token,
            secrets::secret_set,
            secrets::secret_get,
            secrets::secret_delete,
            agy::list_agy_agents,
            agy::start_agy_agent,
            agy::get_agy_job,
            agy::cancel_agy_agent
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
