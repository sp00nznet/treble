//! Treble core — the platform-agnostic engine behind the UI.
//!
//! The frontend only ever talks to this through the Tauri commands in
//! `commands.rs`; nothing here knows about React. See ARCHITECTURE.md.

pub mod catalog;
#[cfg(feature = "native-catalog")]
pub mod catalog_native;
pub mod downloads;
pub mod error;
pub mod library;
pub mod local;
pub mod log;
pub mod lyrics;
pub mod models;
pub mod podcasts;
pub mod spotify_import;
pub mod sync;
pub mod tools;
