//! Bounded loopback callback listener: no tokens or authorization codes enter HTML.
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use url::Url;

#[derive(Debug, PartialEq)]
pub(super) enum Callback {
    Ignore,
    Code(String),
    Denied,
}

pub(super) fn parse_callback(target: &str, expected_state: &str) -> Callback {
    let Ok(url) = Url::parse(&format!("http://127.0.0.1{target}")) else {
        return Callback::Ignore;
    };
    if url.path() != "/" {
        return Callback::Ignore;
    }
    let pairs: Vec<_> = url.query_pairs().collect();
    let states: Vec<_> = pairs.iter().filter(|(key, _)| key == "state").collect();
    if states.len() != 1 {
        return Callback::Ignore;
    }
    let supplied = states[0].1.as_bytes();
    let expected = expected_state.as_bytes();
    if supplied.len() != expected.len()
        || supplied
            .iter()
            .zip(expected)
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            != 0
    {
        return Callback::Ignore;
    }
    if pairs.iter().any(|(key, _)| key == "error") {
        return Callback::Denied;
    }
    let codes: Vec<_> = pairs
        .iter()
        .filter(|(key, value)| key == "code" && !value.is_empty())
        .collect();
    if codes.len() == 1 {
        Callback::Code(codes[0].1.to_string())
    } else {
        Callback::Ignore
    }
}

fn respond(stream: &mut TcpStream, result: &Callback) {
    let (code, message) = match result {
        Callback::Code(_) => (
            "200 OK",
            "Authorization received. Return to Threadnote to finish connecting.",
        ),
        Callback::Denied => ("200 OK", "Sign-in cancelled. You can return to Threadnote."),
        Callback::Ignore => (
            "400 Bad Request",
            "This request is not a valid Threadnote sign-in callback.",
        ),
    };
    let body = format!("<!doctype html><meta charset=utf-8><title>Threadnote</title><body style='margin:0;display:grid;place-items:center;min-height:100vh;background:#18191d;color:#eee;font:16px system-ui'><main><h2>Threadnote</h2><p>{message}</p></main></body>");
    let response = format!("HTTP/1.1 {code}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\nConnection: close\r\n\r\n{body}", body.len());
    let _ = stream.write_all(response.as_bytes());
}

pub(super) fn wait_for_callback(
    listener: TcpListener,
    state: String,
    cancel: Arc<AtomicBool>,
    timeout: Duration,
) -> Result<String, String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if cancel.load(Ordering::SeqCst) {
            return Err("GOOGLE_LOGIN_CANCELLED".into());
        }
        match listener.accept() {
            Ok((mut stream, peer)) => {
                if !peer.ip().is_loopback() {
                    continue;
                }
                let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
                let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));
                let mut bytes = Vec::new();
                let mut buffer = [0u8; 1024];
                while bytes.len() < 8192
                    && Instant::now() < deadline
                    && !cancel.load(Ordering::SeqCst)
                {
                    match stream.read(&mut buffer) {
                        Ok(0) | Err(_) => break,
                        Ok(count) => {
                            bytes.extend_from_slice(&buffer[..count]);
                            if bytes.windows(4).any(|part| part == b"\r\n\r\n") {
                                break;
                            }
                        }
                    }
                }
                let request = String::from_utf8_lossy(&bytes);
                let mut line = request
                    .lines()
                    .next()
                    .unwrap_or_default()
                    .split_whitespace();
                let method = line.next().unwrap_or_default();
                let target = line.next().unwrap_or_default();
                let result = if method == "GET" {
                    parse_callback(target, &state)
                } else {
                    Callback::Ignore
                };
                respond(&mut stream, &result);
                match result {
                    Callback::Code(code) => return Ok(code),
                    Callback::Denied => return Err("GOOGLE_LOGIN_CANCELLED".into()),
                    Callback::Ignore => {}
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(30))
            }
            Err(_) => return Err("GOOGLE_CALLBACK_ERROR".into()),
        }
    }
    Err("GOOGLE_LOGIN_TIMEOUT".into())
}
