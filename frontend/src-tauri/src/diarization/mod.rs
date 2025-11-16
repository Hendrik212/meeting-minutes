use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct Speaker {
    pub id: String,
    pub speaker_label: String,
    pub custom_name: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiarizationStatus {
    pub status: String,
    pub num_speakers: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DiarizeRequestBody {
    meeting_id: String,
    audio_path: String,
    num_speakers: Option<i32>,
    min_speakers: i32,
    max_speakers: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct UpdateSpeakerNameBody {
    speaker_id: String,
    custom_name: String,
}

/// Start speaker diarization for a meeting
#[tauri::command]
pub async fn start_diarization(
    meeting_id: String,
    audio_path: String,
    num_speakers: Option<i32>,
    min_speakers: Option<i32>,
    max_speakers: Option<i32>,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request_body = DiarizeRequestBody {
        meeting_id: meeting_id.clone(),
        audio_path,
        num_speakers,
        min_speakers: min_speakers.unwrap_or(2),
        max_speakers: max_speakers.unwrap_or(10),
    };

    let response = client
        .post("http://localhost:5167/diarize-meeting")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to backend: {}", e))?;

    if response.status().is_success() {
        Ok(format!("Diarization started for meeting {}", meeting_id))
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Diarization failed: {}", error_text))
    }
}

/// Get diarization status for a meeting
#[tauri::command]
pub async fn get_diarization_status(meeting_id: String) -> Result<DiarizationStatus, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(&format!("http://localhost:5167/diarization-status/{}", meeting_id))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to backend: {}", e))?;

    if response.status().is_success() {
        response
            .json::<DiarizationStatus>()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    } else if response.status().as_u16() == 404 {
        // Not started yet - return default status
        Ok(DiarizationStatus {
            status: "not_started".to_string(),
            num_speakers: None,
            created_at: "".to_string(),
            updated_at: "".to_string(),
            error: None,
        })
    } else {
        Err(format!("Failed to get status: {}", response.status()))
    }
}

/// Get all speakers for a meeting
#[tauri::command]
pub async fn get_speakers(meeting_id: String) -> Result<Vec<Speaker>, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(&format!("http://localhost:5167/speakers/{}", meeting_id))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to backend: {}", e))?;

    if response.status().is_success() {
        response
            .json::<Vec<Speaker>>()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    } else {
        Err(format!("Failed to get speakers: {}", response.status()))
    }
}

/// Update a speaker's custom name
#[tauri::command]
pub async fn update_speaker_name(
    speaker_id: String,
    custom_name: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request_body = UpdateSpeakerNameBody {
        speaker_id: speaker_id.clone(),
        custom_name: custom_name.clone(),
    };

    let response = client
        .post("http://localhost:5167/update-speaker-name")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to backend: {}", e))?;

    if response.status().is_success() {
        Ok(format!("Speaker {} updated to {}", speaker_id, custom_name))
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Failed to update speaker name: {}", error_text))
    }
}
