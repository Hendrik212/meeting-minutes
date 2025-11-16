# Speaker Diarization - Usage Guide

## ✅ Implementation Complete

The speaker diarization feature is now fully implemented across the entire stack:

### Backend (Python/FastAPI) ✅
- DiarizationService with pyannote.audio 3.1
- Database schema with speakers and diarization_results tables
- API endpoints for diarization operations
- Background task processing

### Rust (Tauri Commands) ✅
- `start_diarization` - Start speaker identification
- `get_diarization_status` - Poll processing status
- `get_speakers` - Get speaker list
- `update_speaker_name` - Rename speakers

### Frontend (React Components) ✅
- `SpeakerList` - Display and rename speakers
- `DiarizationButton` - Start/monitor diarization

---

## 📖 How to Use in Your Application

### Quick Integration Example

Here's how to add speaker diarization to a meeting details page:

```tsx
// Example: MeetingDetailsPage.tsx
import { useState, useEffect } from 'react';
import { SpeakerList, DiarizationButton } from '@/components/Diarization';

export function MeetingDetailsPage({ meetingId }: { meetingId: string }) {
  const [audioPath, setAudioPath] = useState('');
  const [showSpeakers, setShowSpeakers] = useState(false);

  // Load meeting data and get audio file path
  useEffect(() => {
    loadMeetingData();
  }, [meetingId]);

  const loadMeetingData = async () => {
    // Get meeting details from backend
    const meeting = await fetch(`http://localhost:5167/get-meeting/${meetingId}`)
      .then(res => res.json());

    // Set audio path (adjust based on your folder structure)
    // The audio path should point to the recording file
    setAudioPath(meeting.folder_path + '/recording.wav');
  };

  const handleDiarizationComplete = () => {
    setShowSpeakers(true);
  };

  const handleStatusChange = (status: string) => {
    if (status === 'completed') {
      setShowSpeakers(true);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1>Meeting Details</h1>

      {/* Other meeting details */}

      {/* Speaker Diarization Section */}
      <div className="border-t pt-6">
        <h2 className="text-xl font-semibold mb-4">Speaker Identification</h2>

        <DiarizationButton
          meetingId={meetingId}
          audioPath={audioPath}
          onComplete={handleDiarizationComplete}
          onStatusChange={handleStatusChange}
        />

        {showSpeakers && (
          <div className="mt-6">
            <SpeakerList
              meetingId={meetingId}
              onSpeakerUpdate={() => {
                // Optional: Refresh transcript display with new speaker names
                console.log('Speaker names updated');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 🎨 Component API Reference

### DiarizationButton

**Props:**
- `meetingId` (string, required) - The meeting ID
- `audioPath` (string, required) - Path to the audio recording file
- `onComplete` (function, optional) - Callback when diarization completes successfully
- `onStatusChange` (function, optional) - Callback when status changes (processing, completed, failed)

**Features:**
- Automatic status polling every 2 seconds during processing
- Visual status indicators:
  - Not started: Blue button with Users icon
  - Processing: Spinning loader
  - Completed: Green checkmark with speaker count
  - Failed: Red alert icon
- Toast notifications for user feedback

**Example:**
```tsx
<DiarizationButton
  meetingId="meeting-123"
  audioPath="/path/to/recording.wav"
  onComplete={() => console.log('Done!')}
  onStatusChange={(status) => console.log('Status:', status)}
/>
```

---

### SpeakerList

**Props:**
- `meetingId` (string, required) - The meeting ID
- `onSpeakerUpdate` (function, optional) - Callback when speaker name is updated

**Features:**
- Color-coded speaker display (8 distinct colors)
- Inline editing with keyboard shortcuts:
  - Enter: Save changes
  - Escape: Cancel editing
- Real-time updates via Tauri commands
- Automatic refresh after updates

**Example:**
```tsx
<SpeakerList
  meetingId="meeting-123"
  onSpeakerUpdate={() => refreshTranscripts()}
/>
```

**Speaker Colors:**
The component uses 8 predefined color schemes that cycle based on speaker index:
1. Blue
2. Green
3. Purple
4. Orange
5. Pink
6. Indigo
7. Yellow
8. Red

---

## 🔧 Configuration Options

### Backend Configuration

**Environment Variables** (create `backend/.env`):
```bash
# Required for first-time model download
HUGGINGFACE_TOKEN=your_huggingface_token

# Optional: Change backend port
PORT=5167

# Optional: Database path
DATABASE_PATH=meeting_minutes.db
```

**Get HuggingFace Token:**
1. Go to https://huggingface.co/settings/tokens
2. Create a new token with read permissions
3. Copy and paste into `.env` file

### Diarization Parameters

You can adjust diarization parameters by modifying the `start_diarization` call:

```tsx
await invoke('start_diarization', {
  meetingId: 'meeting-123',
  audioPath: '/path/to/audio.wav',
  numSpeakers: null,      // null = auto-detect, or specify exact number
  minSpeakers: 2,         // Minimum speakers to detect
  maxSpeakers: 10         // Maximum speakers to detect
});
```

**Parameter Recommendations:**
- **Small meetings (1-4 people):** `minSpeakers: 2, maxSpeakers: 4`
- **Medium meetings (5-8 people):** `minSpeakers: 3, maxSpeakers: 8`
- **Large meetings (9+ people):** `minSpeakers: 5, maxSpeakers: 15`

---

## 🚀 Getting Started

### 1. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Set HuggingFace Token

```bash
echo "HUGGINGFACE_TOKEN=your_token_here" > .env
```

### 3. Start Backend Server

```bash
python app/main.py
```

The backend will:
- Download pyannote models (~300MB) on first run
- Start FastAPI server on http://localhost:5167
- Initialize database tables

### 4. Build Frontend (if needed)

```bash
cd frontend
pnpm install
pnpm run tauri:dev
```

### 5. Test Diarization

1. Record a meeting or use an existing one
2. Navigate to meeting details
3. Click "Identify Speakers" button
4. Wait for processing (2-10 minutes depending on meeting length)
5. See identified speakers appear
6. Click "Rename" to assign real names

---

## 📊 Performance & Limitations

### Processing Time

**CPU Mode:**
- ~2-3x real-time (10 min audio = 20-30 min processing)
- Uses ~2GB RAM
- Single-threaded

**GPU Mode (CUDA):**
- ~0.5-1x real-time (10 min audio = 5-10 min processing)
- Requires ~4GB GPU VRAM
- Significantly faster for long meetings

### Accuracy

**Good Results:**
- Clear audio with minimal background noise
- Speakers with distinct voices
- Proper microphone placement
- 2-8 speakers in meeting

**Challenging Scenarios:**
- Overlapping speech
- Similar-sounding voices
- Heavy background noise
- Very large meetings (10+ people)
- Poor audio quality

### Limitations

1. **Post-Processing Only:** Diarization runs after recording completes, not in real-time
2. **Audio Quality:** Requires decent audio quality for accurate results
3. **Language:** Works with any language, but optimized for English
4. **Speaker Count:** Best results with 2-8 speakers
5. **Processing Time:** Can be slow on CPU for long meetings

---

## 🐛 Troubleshooting

### "Failed to connect to backend"

**Solution:**
```bash
# Check if backend is running
curl http://localhost:5167/docs

# Restart backend
cd backend
python app/main.py
```

### "HUGGINGFACE_TOKEN not set"

**Solution:**
```bash
# Create .env file in backend directory
echo "HUGGINGFACE_TOKEN=your_token" > backend/.env

# Get token from: https://huggingface.co/settings/tokens
```

### "Audio file not found"

**Solution:**
```tsx
// Ensure audio path is absolute and file exists
import { invoke } from '@tauri-apps/api/core';

// Get correct audio path from meeting folder
const folderPath = await invoke('get_meeting_folder_path', { meetingId });
const audioPath = `${folderPath}/recording.wav`;
```

### "Diarization failed: No speakers found"

**Possible Causes:**
1. Audio file is too short (< 10 seconds)
2. No speech detected in audio
3. Audio quality too poor

**Solution:**
- Check audio file plays correctly
- Try adjusting `minSpeakers` parameter
- Verify audio contains clear speech

### "Model download failed"

**Solution:**
```bash
# Check internet connection
ping huggingface.co

# Verify HuggingFace token permissions
# Token needs "read" access

# Manual download (if needed):
python -c "from pyannote.audio import Pipeline; Pipeline.from_pretrained('pyannote/speaker-diarization-3.1', use_auth_token='your_token')"
```

---

## 🎯 Advanced Usage

### Custom Diarization with Specific Speaker Count

```tsx
// If you know exactly how many speakers
await invoke('start_diarization', {
  meetingId: meetingId,
  audioPath: audioPath,
  numSpeakers: 3,  // Exact count
  minSpeakers: null,
  maxSpeakers: null
});
```

### Programmatic Speaker Name Updates

```tsx
// Update speaker names via API
const speakers = await invoke('get_speakers', { meetingId });

for (const speaker of speakers) {
  if (speaker.speaker_label === 'SPEAKER_00') {
    await invoke('update_speaker_name', {
      speakerId: speaker.id,
      customName: 'John Smith'
    });
  }
}
```

### Integration with Transcript Display

```tsx
// Show speaker names in transcript
interface TranscriptSegment {
  text: string;
  speaker?: string;  // Will be speaker_id or custom_name
  timestamp: string;
}

function TranscriptView({ segments, speakers }) {
  return (
    <div>
      {segments.map((seg, i) => {
        // Find speaker by ID
        const speaker = speakers.find(s =>
          s.id === seg.speaker || s.speaker_label === seg.speaker
        );
        const speakerName = speaker?.custom_name || speaker?.speaker_label;

        return (
          <div key={i}>
            <strong>{speakerName}:</strong> {seg.text}
          </div>
        );
      })}
    </div>
  );
}
```

---

## 📝 Next Steps

### Planned Enhancements

1. **Real-time Diarization**
   - Process during recording, not just after
   - Show speakers as meeting progresses

2. **Voice Profiles**
   - Save speaker embeddings
   - Recognize speakers across multiple meetings
   - "This sounds like John from the last meeting"

3. **Multi-language Support**
   - Optimize for non-English languages
   - Better handling of accents

4. **Export Features**
   - Export speaker-separated audio tracks
   - Generate speaker-specific transcripts
   - Meeting analytics (talk time per speaker)

5. **UI Improvements**
   - Drag-and-drop speaker merging
   - Speaker timeline visualization
   - Audio playback synced with speakers

---

## 🤝 Contributing

Found a bug or have a feature request? Please open an issue on GitHub!

**Common Improvements:**
- Better error messages
- Progress bar during processing
- Cancel diarization mid-process
- Speaker merge/split tools
- Export to standard diarization formats (RTTM)

---

## 📄 License

This speaker diarization implementation uses:
- **pyannote.audio** - MIT License
- **torch** - BSD License
- **Tauri** - MIT or Apache 2.0
- **React** - MIT License

---

## 🎉 Summary

You now have a complete speaker diarization system:

✅ **Backend:** Python/FastAPI service with pyannote.audio
✅ **Rust:** Tauri commands for IPC communication
✅ **Frontend:** React components for UI
✅ **Database:** Speaker storage and management
✅ **Ready to integrate:** Just add components to your page!

**Quick Start:**
1. Install backend dependencies
2. Set HuggingFace token
3. Start backend server
4. Add `<DiarizationButton>` and `<SpeakerList>` to your meeting page
5. Start identifying speakers!

Happy coding! 🚀
