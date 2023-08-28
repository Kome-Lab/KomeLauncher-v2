use anyhow::bail;

/// Asynchronously stop the process (wait is required)
#[cfg(target_family = "unix")]
pub fn stop_process(pid: u32) -> anyhow::Result<()> {
    let result = unsafe { libc::kill(pid as i32, libc::SIGTERM) };

    if result == -1 {
        bail!("failed to SIGTERM child process, errno: {}", errno::errno())
    }

    Ok(())
}

/// Asynchronously stop the process (wait is required)
/// Note that on windows we assume a PID matches a console and that console contains only the target process
#[cfg(target_os = "windows")]
pub fn stop_process(pid: u32) -> anyhow::Result<()> {
    use winapi_reaper::*;

    let exe = std::env::current_exe()?;

    let result = std::process::Command::new(exe)
        .arg("--interrupt-console")
        .arg(pid.to_string())
        .status()?
        .code()
        .expect("it is not possible for a process to terminate via a signal on windows");

    match result {
        SUCCESS => {}
        ATTACH_FAILED => bail!("failed to attach to child process console"),
        SET_HANDLER_FAILED => bail!("failed to set CTRL-C handler in child process"),
        GET_CONSOLE_WINDOW_FAILED => bail!("failed to get the console window of the child process"),
        CLOSE_WINDOW_FAILED => bail!("failed to close the console window of the child process"),
        c => bail!("reaper process returned unexpected exit code: {c}"),
    }

    Ok(())
}

#[cfg(target_os = "windows")]
pub mod winapi_reaper {
    use std::ptr;

    pub const SUCCESS: i32 = 0;
    pub const ATTACH_FAILED: i32 = 2;
    pub const SET_HANDLER_FAILED: i32 = 3;
    pub const GET_CONSOLE_WINDOW_FAILED: i32 = 4;
    pub const CLOSE_WINDOW_FAILED: i32 = 5;

    /// Send a ^C event to a console.
    ///
    /// A ^C event is sent to all processes connected to this console.
    pub fn winapi_reaper(console_id: u32) {
        use std::process::exit;
        use winapi::um::{wincon::*, winuser::*, consoleapi::*};

        unsafe {
            // detatch this process's console if attached.
            // if this function fails it just means we already don''t have a a console attached.
            FreeConsole();

            // attempt to attach to the child console
            if AttachConsole(console_id) != 0 {
                let console_window = GetConsoleWindow();

                if console_window == ptr::null_mut() {
                    exit(GET_CONSOLE_WINDOW_FAILED)
                }

                // prevent ^Cing our own process so we can return exit code 0
                if SetConsoleCtrlHandler(None, 1) == 0 {
                    exit(SET_HANDLER_FAILED)
                }

                // close the console window
                if CloseWindow(console_window) {
                    exit(SUCCESS)
                } else {
                    exit(CLOSE_WINDOW_FAILED)
                }
            } else {
                exit(ATTACH_FAILED)
            }
        }
    }
}
