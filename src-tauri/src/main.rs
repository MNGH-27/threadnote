// Threadnote is a desktop widget: debug builds must not open a console either.
#![windows_subsystem = "windows"]

fn main() {
    threadnote_lib::run();
}
