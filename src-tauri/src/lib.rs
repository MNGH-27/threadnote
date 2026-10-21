mod google;
mod links;
mod retired_credentials;
mod tray;

use google::{
    google_api_request, google_auth_status, google_cancel_connect, google_connect,
    google_disconnect,
};
use links::{open_external, open_website};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_local_workspace_schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "widget_first_schema",
            sql: include_str!("../migrations/0002_widget_first.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "composable_note_sections",
            sql: include_str!("../migrations/0003_note_sections.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "resizable_canvas_connections",
            sql: include_str!("../migrations/0004_canvas_connections.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "atomic_section_connection_cleanup",
            sql: include_str!("../migrations/0005_connection_cleanup.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "google_calendar_section",
            sql: include_str!("../migrations/0006_google_calendar_section.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            tray::show_notes(app);
        }))
        .manage(google::GoogleState::default())
        .setup(|app| {
            retired_credentials::cleanup();
            tray::setup(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "widget" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    // Alt+F4 must not destroy the coordinator while the tray stays alive.
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            quit_app,
            tray::tray_frontend_ready,
            tray::tray_sync_startup,
            open_external,
            open_website,
            google_auth_status,
            google_connect,
            google_disconnect,
            google_cancel_connect,
            google_api_request,
            google::google_open_service_setup
        ])
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--widget"]),
        ))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:sticky.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Threadnote");
}
