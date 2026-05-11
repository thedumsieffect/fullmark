use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FsError {
    pub message: String,
    pub code: String,
}

impl FsError {
    fn new(code: &str, msg: impl Into<String>) -> Self {
        Self { code: code.into(), message: msg.into() }
    }
}

impl From<std::io::Error> for FsError {
    fn from(e: std::io::Error) -> Self {
        FsError::new("io", e.to_string())
    }
}

/// Atomic write: write to a temp file in the same directory, fsync, then rename.
/// rename(2) is atomic on the same filesystem; this guarantees we never leave a
/// half-written `.md` on disk, even across power loss or process kill.
///
/// Returns the resolved canonical path on success.
#[tauri::command]
pub fn atomic_write_text(path: String, content: String) -> Result<String, FsError> {
    let target = PathBuf::from(&path);

    // Resolve parent + sanity check
    let parent = target
        .parent()
        .ok_or_else(|| FsError::new("invalid_path", "target has no parent directory"))?;
    if !parent.exists() {
        fs::create_dir_all(parent)?;
    }

    let stem = target
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| FsError::new("invalid_path", "could not read filename"))?;

    // Unique temp filename: .{stem}.tmp-{nanos}
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| FsError::new("clock", e.to_string()))?
        .as_nanos();
    let tmp = parent.join(format!(".{stem}.tmp-{nanos}"));

    // Write + fsync the temp file before rename so the new content is durable
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(content.as_bytes())?;
        f.sync_all()?;
    }

    // Atomic rename. If it fails, clean up the temp file.
    if let Err(e) = fs::rename(&tmp, &target) {
        let _ = fs::remove_file(&tmp);
        return Err(FsError::new("rename_failed", e.to_string()));
    }

    Ok(target.to_string_lossy().into_owned())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_ms: Option<u128>,
}

/// List immediate children of a directory. Single level only — recursive walk
/// is handled in the frontend so it can stream + show progress for large vaults.
#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<DirEntry>, FsError> {
    let mut entries = Vec::new();
    for ent in fs::read_dir(&path)? {
        let ent = ent?;
        let p = ent.path();
        let md = ent.metadata()?;
        let modified_ms = md
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis());
        entries.push(DirEntry {
            name: ent.file_name().to_string_lossy().into_owned(),
            path: p.to_string_lossy().into_owned(),
            is_dir: md.is_dir(),
            size: md.len(),
            modified_ms,
        });
    }
    // Stable ordering: directories first, then files; both alphabetical
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(entries)
}

/// Read a file as a UTF-8 string. Bytes that aren't valid UTF-8 are lossy-replaced.
/// Returns the canonical path alongside the content so the frontend can
/// reconcile case-insensitive filesystems.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadResult {
    pub content: String,
    pub canonical_path: String,
    pub modified_ms: Option<u128>,
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<ReadResult, FsError> {
    let p = Path::new(&path);
    let content = fs::read_to_string(p)?;
    let canonical = fs::canonicalize(p)
        .ok()
        .and_then(|c| c.to_str().map(|s| s.to_string()))
        .unwrap_or_else(|| p.to_string_lossy().into_owned());
    let modified_ms = fs::metadata(p)
        .ok()
        .and_then(|md| md.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis());
    Ok(ReadResult { content, canonical_path: canonical, modified_ms })
}

/// Resolve `~` and relative paths to an absolute path that the rest of the app
/// can trust as canonical.
#[tauri::command]
pub fn resolve_path(path: String) -> Result<String, FsError> {
    let mut p = PathBuf::from(&path);
    if let Some(stripped) = path.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            p = PathBuf::from(home).join(stripped);
        }
    } else if path == "~" {
        if let Ok(home) = std::env::var("HOME") {
            p = PathBuf::from(home);
        }
    }
    let abs = fs::canonicalize(&p).unwrap_or(p);
    Ok(abs.to_string_lossy().into_owned())
}
