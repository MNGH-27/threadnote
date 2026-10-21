//! Native controls stay available when every note is hidden. Quit always delegates
//! to the frontend's all-window save handshake; never exit directly from the menu.
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewWindow, Wry,
};
use tauri_plugin_autostart::ManagerExt;

struct TrayState {
    startup: CheckMenuItem<Wry>,
    actions: Vec<MenuItem<Wry>>,
}

pub(crate) fn show_notes(app: &AppHandle) {
    for (label, window) in app.webview_windows() {
        if is_note(&label) {
            let _ = window.unminimize();
            let _ = window.show();
        }
    }
    if let Some(window) = app.get_webview_window("widget") {
        let _ = window.set_focus();
    }
}

fn is_note(label: &str) -> bool {
    label == "widget" || label.starts_with("threadnote-widget-")
}

fn action(app: &AppHandle, name: &str) {
    if let Some(window) = app.get_webview_window("widget") {
        // Make errors and settings visible, including when the main note was hidden.
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("tray:action", name);
    }
}

#[tauri::command]
pub(crate) fn tray_frontend_ready(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    if window.label() != "widget" {
        return Err("Only the main note handles tray actions".into());
    }
    for item in &app.state::<TrayState>().actions {
        item.set_enabled(true).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn tray_sync_startup(app: AppHandle) -> Result<(), String> {
    let enabled = app
        .autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())?;
    app.state::<TrayState>()
        .startup
        .set_checked(enabled)
        .map_err(|error| error.to_string())?;
    app.emit("settings:startup-changed", enabled)
        .map_err(|error| error.to_string())
}

pub(crate) fn setup(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "tray-show", "Show notes", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "tray-hide", "Hide notes", true, None::<&str>)?;
    let new_note = MenuItem::with_id(app, "tray-new", "New note", false, None::<&str>)?;
    let settings = MenuItem::with_id(app, "tray-settings", "Settings…", false, None::<&str>)?;
    let startup = CheckMenuItem::with_id(
        app,
        "tray-startup",
        "Launch at Windows startup",
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "tray-quit", "Save and quit", false, None::<&str>)?;
    let divider = PredefinedMenuItem::separator(app)?;
    let last_divider = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &hide,
            &new_note,
            &divider,
            &settings,
            &startup,
            &last_divider,
            &quit,
        ],
    )?;
    app.manage(TrayState {
        startup,
        actions: vec![new_note, settings, quit],
    });
    let mut builder = TrayIconBuilder::with_id("threadnote-tray")
        .tooltip("Threadnote — desktop notes")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray-show" => show_notes(app),
            "tray-hide" => {
                for (label, window) in app.webview_windows() {
                    if is_note(&label) {
                        let _ = window.hide();
                    }
                }
            }
            "tray-new" => action(app, "new-note"),
            "tray-settings" => action(app, "settings"),
            "tray-quit" => action(app, "quit"),
            "tray-startup" => {
                let manager = app.autolaunch();
                let result = manager.is_enabled().and_then(|enabled| {
                    if enabled {
                        manager.disable()
                    } else {
                        manager.enable()
                    }
                });
                let _ = tray_sync_startup(app.clone());
                if result.is_err() {
                    action(app, "startup-error");
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_notes(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_note;
    #[test]
    fn only_note_windows_are_controlled() {
        assert!(is_note("widget"));
        assert!(is_note("threadnote-widget-abc"));
        assert!(!is_note("site-private-webview"));
        assert!(!is_note("unrelated"));
    }
}
