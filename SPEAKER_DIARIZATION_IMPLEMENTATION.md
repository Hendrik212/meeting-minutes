# Speaker Diarization Implementation Guide

## ✅ Completed: Backend Infrastructure

### What's Been Implemented

#### 1. Backend Service (`backend/app/diarization_service.py`)

The `DiarizationService` class provides complete speaker diarization functionality:

- **Voice Activity Detection (VAD)**: Automatically detects speech segments
- **Speaker Clustering**: Identifies unique speakers using pyannote.audio 3.1
- **Timestamp Alignment**: Aligns speaker labels with transcript segments
- **GPU Acceleration**: Automatic CUDA/CPU detection
- **Speaker Renaming**: Convert "SPEAKER_00" → "John"

**Key Methods:**
```python
diarize_audio(audio_path, num_speakers=None, min_speakers=2, max_speakers=10)
align_with_transcript(diarization_result, transcript_segments)
diarize_meeting(audio_path, transcript_segments, ...)
rename_speaker(aligned_transcripts, old_speaker, new_name)
```

#### 2. Database Schema

**New Tables:**

**`speakers`**
```sql
CREATE TABLE speakers (
    id TEXT PRIMARY KEY,              -- Format: "meeting_id_SPEAKER_00"
    meeting_id TEXT NOT NULL,
    speaker_label TEXT NOT NULL,      -- "SPEAKER_00", "SPEAKER_01"
    custom_name TEXT,                 -- User-assigned name (e.g., "John")
    created_at TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);
```

**`diarization_results`**
```sql
CREATE TABLE diarization_results (
    meeting_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,             -- "processing", "completed", "failed"
    num_speakers INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    error TEXT,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
);
```

**Updated Tables:**

**`transcripts`** - Added columns:
- `speaker_id TEXT` - Speaker label
- `speaker_confidence REAL` - Confidence score (0-1)

#### 3. API Endpoints

**POST `/diarize-meeting`**
```json
{
  "meeting_id": "meeting-123",
  "audio_path": "/path/to/recording.wav",
  "num_speakers": null,      // Optional: exact number
  "min_speakers": 2,         // Default: 2
  "max_speakers": 10         // Default: 10
}
```

**GET `/diarization-status/{meeting_id}`**
```json
{
  "status": "completed",
  "num_speakers": 3,
  "created_at": "2025-11-16T10:30:00",
  "updated_at": "2025-11-16T10:35:00",
  "error": null
}
```

**GET `/speakers/{meeting_id}`**
```json
[
  {
    "id": "meeting-123_SPEAKER_00",
    "speaker_label": "SPEAKER_00",
    "custom_name": "John",
    "created_at": "2025-11-16T10:30:00"
  },
  {
    "id": "meeting-123_SPEAKER_01",
    "speaker_label": "SPEAKER_01",
    "custom_name": "Sarah",
    "created_at": "2025-11-16T10:30:00"
  }
]
```

**POST `/update-speaker-name`**
```json
{
  "speaker_id": "meeting-123_SPEAKER_00",
  "custom_name": "John Smith"
}
```

#### 4. Dependencies Added

```txt
# backend/requirements.txt
pyannote.audio==3.1.1
torch>=2.0.0
torchaudio>=2.0.0
```

**Installation Size:** ~300MB on first run (downloads pre-trained models)

---

## 🚧 Next Steps: Frontend & Integration

### Phase 1: Tauri Commands (Rust)

Create Tauri commands to interface with the backend API.

**File:** `frontend/src-tauri/src/diarization/mod.rs`

```rust
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

#[tauri::command]
pub async fn start_diarization(
    meeting_id: String,
    audio_path: String,
    num_speakers: Option<i32>,
    min_speakers: Option<i32>,
    max_speakers: Option<i32>,
) -> Result<String, String> {
    // Call backend API: POST /diarize-meeting
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:5167/diarize-meeting")
        .json(&serde_json::json!({
            "meeting_id": meeting_id,
            "audio_path": audio_path,
            "num_speakers": num_speakers,
            "min_speakers": min_speakers.unwrap_or(2),
            "max_speakers": max_speakers.unwrap_or(10)
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok("Diarization started".to_string())
    } else {
        Err(format!("Diarization failed: {}", response.status()))
    }
}

#[tauri::command]
pub async fn get_diarization_status(meeting_id: String) -> Result<DiarizationStatus, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("http://localhost:5167/diarization-status/{}", meeting_id))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    response
        .json::<DiarizationStatus>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_speakers(meeting_id: String) -> Result<Vec<Speaker>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("http://localhost:5167/speakers/{}", meeting_id))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    response
        .json::<Vec<Speaker>>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_speaker_name(
    speaker_id: String,
    custom_name: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:5167/update-speaker-name")
        .json(&serde_json::json!({
            "speaker_id": speaker_id,
            "custom_name": custom_name
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok("Speaker name updated".to_string())
    } else {
        Err("Failed to update speaker name".to_string())
    }
}
```

**Register in `frontend/src-tauri/src/lib.rs`:**

```rust
mod diarization;

tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // ... existing commands
        diarization::start_diarization,
        diarization::get_diarization_status,
        diarization::get_speakers,
        diarization::update_speaker_name,
    ])
```

---

### Phase 2: Frontend UI Components

#### Component 1: Speaker List (`frontend/src/components/Diarization/SpeakerList.tsx`)

```tsx
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Speaker {
  id: string;
  speaker_label: string;
  custom_name?: string;
  created_at: string;
}

interface SpeakerListProps {
  meetingId: string;
}

export function SpeakerList({ meetingId }: SpeakerListProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadSpeakers();
  }, [meetingId]);

  const loadSpeakers = async () => {
    try {
      const data = await invoke<Speaker[]>('get_speakers', { meetingId });
      setSpeakers(data);
    } catch (error) {
      console.error('Failed to load speakers:', error);
    }
  };

  const saveSpeakerName = async (speakerId: string) => {
    try {
      await invoke('update_speaker_name', {
        speakerId,
        customName: editName
      });
      setEditingSpeaker(null);
      loadSpeakers();
    } catch (error) {
      console.error('Failed to update speaker name:', error);
    }
  };

  const SPEAKER_COLORS = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-orange-100 text-orange-800',
    'bg-pink-100 text-pink-800',
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Speakers</h3>
      {speakers.map((speaker, index) => (
        <div
          key={speaker.id}
          className={`p-3 rounded-lg ${SPEAKER_COLORS[index % SPEAKER_COLORS.length]}`}
        >
          {editingSpeaker === speaker.id ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={speaker.speaker_label}
                className="flex-1 px-2 py-1 rounded border"
                autoFocus
              />
              <button
                onClick={() => saveSpeakerName(speaker.id)}
                className="px-3 py-1 bg-green-600 text-white rounded"
              >
                Save
              </button>
              <button
                onClick={() => setEditingSpeaker(null)}
                className="px-3 py-1 bg-gray-400 text-white rounded"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => {
                setEditingSpeaker(speaker.id);
                setEditName(speaker.custom_name || '');
              }}
            >
              <span className="font-medium">
                {speaker.custom_name || speaker.speaker_label}
              </span>
              <span className="text-sm opacity-70">Click to rename</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

#### Component 2: Diarization Button (`frontend/src/components/Diarization/DiarizationButton.tsx`)

```tsx
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Users, Loader2 } from 'lucide-react';

interface DiarizationButtonProps {
  meetingId: string;
  audioPath: string;
  onComplete?: () => void;
}

export function DiarizationButton({
  meetingId,
  audioPath,
  onComplete
}: DiarizationButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('not_started');

  const startDiarization = async () => {
    try {
      setIsProcessing(true);
      await invoke('start_diarization', {
        meetingId,
        audioPath,
        numSpeakers: null,
        minSpeakers: 2,
        maxSpeakers: 10
      });

      // Poll for status
      const interval = setInterval(async () => {
        try {
          const statusData = await invoke<any>('get_diarization_status', { meetingId });
          setStatus(statusData.status);

          if (statusData.status === 'completed') {
            clearInterval(interval);
            setIsProcessing(false);
            onComplete?.();
          } else if (statusData.status === 'failed') {
            clearInterval(interval);
            setIsProcessing(false);
            console.error('Diarization failed:', statusData.error);
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 2000);

    } catch (error) {
      console.error('Failed to start diarization:', error);
      setIsProcessing(false);
    }
  };

  return (
    <Button
      onClick={startDiarization}
      disabled={isProcessing}
      variant="outline"
      className="flex items-center gap-2"
    >
      {isProcessing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Identifying Speakers...
        </>
      ) : (
        <>
          <Users className="h-4 w-4" />
          Identify Speakers
        </>
      )}
    </Button>
  );
}
```

#### Component 3: Transcript with Speakers (`frontend/src/components/TranscriptWithSpeakers.tsx`)

```tsx
interface TranscriptSegment {
  text: string;
  timestamp: string;
  speaker?: string;
  speaker_confidence?: number;
}

export function TranscriptWithSpeakers({ segments }: { segments: TranscriptSegment[] }) {
  const SPEAKER_COLORS: Record<string, string> = {
    'SPEAKER_00': 'text-blue-600',
    'SPEAKER_01': 'text-green-600',
    'SPEAKER_02': 'text-purple-600',
    'SPEAKER_03': 'text-orange-600',
  };

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => (
        <div key={index} className="flex gap-3">
          {segment.speaker && (
            <div className={`font-semibold min-w-[120px] ${SPEAKER_COLORS[segment.speaker] || 'text-gray-600'}`}>
              {segment.speaker}
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm text-gray-500">{segment.timestamp}</p>
            <p>{segment.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### Phase 3: Integration with Meeting Details Page

**File:** `frontend/src/app/meeting-details/page-content.tsx`

```tsx
import { SpeakerList } from '@/components/Diarization/SpeakerList';
import { DiarizationButton } from '@/components/Diarization/DiarizationButton';
import { useState } from 'react';

export function MeetingDetailsContent({ meetingId }: { meetingId: string }) {
  const [showSpeakers, setShowSpeakers] = useState(false);

  return (
    <div>
      {/* Existing meeting details UI */}

      {/* Add Diarization Section */}
      <div className="mt-6">
        <DiarizationButton
          meetingId={meetingId}
          audioPath={`/path/to/meetings/${meetingId}/recording.wav`}
          onComplete={() => setShowSpeakers(true)}
        />
      </div>

      {showSpeakers && (
        <div className="mt-4">
          <SpeakerList meetingId={meetingId} />
        </div>
      )}
    </div>
  );
}
```

---

## 🔧 Setup Instructions

### Backend Setup

1. **Install Dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Set HuggingFace Token (Required for first-time model download):**
   ```bash
   # Create .env file in backend/
   echo "HUGGINGFACE_TOKEN=your_token_here" > .env
   ```

   Get token from: https://huggingface.co/settings/tokens

3. **Start Backend:**
   ```bash
   python app/main.py
   ```

### Frontend Setup

1. **Create Rust Module:**
   ```bash
   cd frontend/src-tauri/src
   mkdir diarization
   touch diarization/mod.rs
   ```

2. **Add Components:**
   ```bash
   cd frontend/src/components
   mkdir Diarization
   # Create the component files listed above
   ```

3. **Test:**
   ```bash
   cd frontend
   pnpm run tauri:dev
   ```

---

## 📊 Usage Flow

1. **User records a meeting** → Audio + Transcript saved
2. **User opens meeting details** → Sees "Identify Speakers" button
3. **User clicks button** → Backend starts diarization (background task)
4. **Backend processes:**
   - Runs pyannote.audio on audio file
   - Identifies speakers (SPEAKER_00, SPEAKER_01, etc.)
   - Aligns speakers with transcript timestamps
   - Saves results to database
5. **Frontend polls status** → Shows progress
6. **On completion** → Displays speaker list
7. **User can rename speakers** → "SPEAKER_00" → "John Smith"
8. **Transcript updates** → Shows speaker names with color coding

---

## ⚙️ Configuration Options

### Diarization Settings

Add to settings modal:

```tsx
interface DiarizationSettings {
  enableAutoDiarization: boolean;  // Auto-run on new recordings
  minSpeakers: number;              // Default: 2
  maxSpeakers: number;              // Default: 10
  useGPU: boolean;                  // Use GPU acceleration
}
```

---

## 🐛 Troubleshooting

### Common Issues

**1. "HUGGINGFACE_TOKEN not set"**
- Solution: Create `.env` file in `backend/` with your HuggingFace token

**2. "GPU not available"**
- Solution: Install CUDA toolkit or run on CPU (slower but works)

**3. "Diarization failed: No speakers found"**
- Solution: Ensure audio file has clear speech, try adjusting min/max speakers

**4. "Model download failed"**
- Solution: Check internet connection, verify HuggingFace token permissions

---

## 📈 Performance

- **CPU:** ~2-3x real-time (10min audio = 20-30min processing)
- **GPU (CUDA):** ~0.5-1x real-time (10min audio = 5-10min processing)
- **Memory:** ~2GB RAM, ~4GB GPU VRAM

---

## 🎯 Future Enhancements

1. **Real-time diarization** during recording
2. **Speaker embeddings** for cross-meeting speaker recognition
3. **Voice profiles** - save and reuse speaker identities
4. **Multi-language** speaker separation
5. **Gender/age detection** using speaker characteristics
6. **Export** speaker-separated audio tracks

---

## Summary

✅ **Backend Complete:**
- Diarization service with pyannote.audio
- Database schema for speakers
- API endpoints for diarization operations
- Background task processing

🚧 **Frontend Remaining:**
- Tauri Rust commands (1-2 hours)
- React UI components (2-3 hours)
- Integration with meeting details (1 hour)

**Total Estimated Time to Complete:** 4-6 hours of frontend development

The backend foundation is solid and ready for frontend integration!
