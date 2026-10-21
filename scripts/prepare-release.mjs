import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Package only the installer, never local databases, OAuth JSON or workspace files.
const root = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(path.join(root, "src-tauri/tauri.conf.json"), "utf8"));
const version = config.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Expected a stable numeric package version");
const filename = `Threadnote-${version}-Windows-x64-Setup.exe`;
const source = path.join(
  root,
  "src-tauri/target/release/bundle/nsis",
  `Threadnote_${version}_x64-setup.exe`,
);
const bytes = await readFile(source);
if (bytes[0] !== 0x4d || bytes[1] !== 0x5a)
  throw new Error("Installer is not a Windows executable");
const checksum = createHash("sha256").update(bytes).digest("hex");
const output = path.join(root, "releases", version, "windows-x64");
await mkdir(output, { recursive: true });
await copyFile(source, path.join(output, filename));
await writeFile(path.join(output, "SHA256SUMS.txt"), `${checksum}  ${filename}\n`);
await writeFile(
  path.join(output, "README.txt"),
  `Threadnote ${version} - Windows x64\n\n1. Run ${filename} and follow the installer.\n2. Open Threadnote from the Start menu.\n3. Hover near the top edge of a note to reveal its controls.\n4. Use Add to insert content sections. Use + in the window controls for a new note window.\n5. Connect Google from Settings when the publisher has enabled access for your account.\n\nRequirements: Windows 10/11 x64. No Node.js, Rust or developer tools are required.\nIf Microsoft WebView2 is missing, its bundled bootstrapper requires an internet connection to install the runtime. Google services and live websites also require internet.\n\nThis is an unsigned preview installer, not a Google-verified public release. Windows may display an unknown-publisher warning. Verify the source of the installer before running it. SHA256SUMS.txt checks integrity, but is not a digital publisher signature.\n\nNotes are saved locally. Google authentication uses your system browser. You do not need to supply API keys or developer credentials. Google services remain subject to the publisher's Google API configuration and verification. Local notes work without Google sign-in.\n\nClose hides/closes a note window. Settings > Quit app saves open notes before exiting. Launch at startup is enabled on first run and can be changed in Settings.\n\nUninstall through Windows Settings > Apps. Saved local data may remain after uninstall; disconnect Google in the app first if you want to revoke its access.\n\nThis package has been built and statically checked; installation on a clean Windows machine still requires a manual acceptance test.\n`,
);
await writeFile(
  path.join(output, "TRAY-CONTROLS.txt"),
  "While Threadnote is running, its icon appears in the Windows notification area near the clock. Windows may place it under the hidden-icons arrow.\n\nLeft-click: show your notes.\nRight-click: Show notes, Hide notes, New note, Settings, Launch at Windows startup, Save and quit.\n\nHiding notes does not delete them or stop the app. Save and quit waits for all open notes to save; a save failure keeps Threadnote running and displays an error. Closing the main native window with Alt+F4 hides it so the tray remains available.\n",
);
console.log(`Installer prepared: ${path.join(output, filename)}`);
console.log(`SHA-256: ${checksum}`);
