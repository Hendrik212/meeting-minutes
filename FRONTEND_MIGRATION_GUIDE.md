# Frontend Migration Guide: Tauri to Web/Hybrid

Complete guide for migrating Meetily frontend to support both Tauri desktop and web browser environments.

---

## 🎯 Quick Start with Hooks

**NEW!** The easiest way to migrate is using the custom hooks. See [HOOKS_USAGE_EXAMPLE.md](./HOOKS_USAGE_EXAMPLE.md) for complete working examples.

```typescript
import { useRecordingManager } from '@/hooks/useRecordingManager';
import { useTranscriptManager } from '@/hooks/useTranscriptManager';
import { useSummaryManager } from '@/hooks/useSummaryManager';
import { useModelConfig } from '@/hooks/useModelConfig';

function MyComponent() {
  const recording = useRecordingManager();
  const transcript = useTranscriptManager(serverAddress);
  const summary = useSummaryManager();
  const { modelConfig } = useModelConfig();

  // Everything works in both Tauri and web!
  await recording.startRecording('Meeting Title');
  await transcript.startListeningForTranscripts();
  await summary.generateSummary(text, meetingId, modelConfig.provider, modelConfig.model);
}
```

---

## Overview

### Infrastructure Components

**Core Libraries:**
1. `platform.ts` - Platform detection and compatibility
2. `apiClient.ts` - Unified backend API client
3. `recordingAdapter.ts` - Recording functionality adapter
4. `browserRecording.ts` - Browser audio recording

**Custom Hooks:**
5. `useRecordingManager.ts` - Recording state management
6. `useTranscriptManager.ts` - Transcript handling + WebSocket
7. `useSummaryManager.ts` - AI summary generation + polling
8. `useModelConfig.ts` - Model configuration

**Backend:**
9. WebSocket endpoints for real-time transcripts

### Migration Status

✅ **Completed:**
- Platform detection
- API client
- Recording adapter
- Browser recording utilities
- SidebarProvider migration
- All custom hooks
- WebSocket backend

⏳ **Ready to Migrate (using hooks):**
- Main page (`app/page.tsx`)
- RecordingControls
- DeviceSelection
- Other components

---

## Migration Approaches

### Option 1: Use Hooks (Recommended)

Replace complex state management with simple hooks:

```typescript
// Old (100+ lines of state + invoke calls)
const [isRecording, setIsRecording] = useState(false);
const [devices, setDevices] = useState([]);
// ... many more state variables

const startRecording = async () => {
  const devices = await invoke('list_input_devices');
  setDevices(devices);
  await invoke('start_recording', { ... });
  // ... complex logic
};

// New (much simpler!)
const recording = useRecordingManager();
await recording.startRecording(title);
```

### Option 2: Manual Migration

Use adapters directly for fine-grained control. See details below.

---

# Frontend Migration Guide: Tauri to Web/Hybrid

This guide documents the migration of the Meetily frontend from Tauri-only to a hybrid architecture that supports both Tauri desktop and web browser environments.

## Overview

The migration introduces three new utility libraries:
1. **`platform.ts`** - Platform detection and compatibility layer
2. **`apiClient.ts`** - Unified API client for backend calls
3. **`recordingAdapter.ts`** - Recording functionality adapter
4. **`browserRecording.ts`** - Browser-based audio recording

## Migration Status

### ✅ Completed
- [x] Platform detection utility (`lib/platform.ts`)
- [x] API client (`lib/apiClient.ts`)
- [x] Browser recording utilities (`lib/browserRecording.ts`)
- [x] Recording adapter (`lib/recordingAdapter.ts`)
- [x] SidebarProvider (`components/Sidebar/SidebarProvider.tsx`)

### 🔄 Partial / In Progress
- [ ] Main page (`app/page.tsx`) - Large file, needs systematic migration
- [ ] RecordingControls (`components/RecordingControls.tsx`)
- [ ] Other components using Tauri APIs

### ⏳ Pending
- [ ] Device selection components
- [ ] Settings components
- [ ] Notification handling
- [ ] File system operations

## How to Migrate Components

### Step 1: Replace Tauri Imports

**Before:**
```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
```

**After:**
```typescript
import { isTauri, platformInvoke, platformListen } from '@/lib/platform';
import { apiClient } from '@/lib/apiClient';
import * as recordingAdapter from '@/lib/recordingAdapter';
```

### Step 2: Replace Backend API Calls

#### Get Meetings

**Before:**
```typescript
const meetings = await invoke('api_get_meetings');
```

**After:**
```typescript
const meetings = await apiClient.getMeetings();
```

#### Get Meeting Details

**Before:**
```typescript
const meeting = await invoke('api_get_meeting', { meetingId });
```

**After:**
```typescript
const meeting = await apiClient.getMeeting(meetingId);
```

#### Save Meeting Title

**Before:**
```typescript
await invoke('api_save_meeting_title', { meetingId, title });
```

**After:**
```typescript
await apiClient.saveMeetingTitle(meetingId, title);
```

#### Delete Meeting

**Before:**
```typescript
await invoke('api_delete_meeting', { meetingId });
```

**After:**
```typescript
await apiClient.deleteMeeting(meetingId);
```

#### Save Transcript

**Before:**
```typescript
await invoke('api_save_transcript', {
  meetingTitle,
  transcripts,
  folderPath
});
```

**After:**
```typescript
await apiClient.saveTranscript(meetingTitle, transcripts, folderPath);
```

#### Search Transcripts

**Before:**
```typescript
const results = await invoke('api_search_transcripts', { query });
```

**After:**
```typescript
const results = await apiClient.searchTranscripts(query);
```

#### Generate Summary

**Before:**
```typescript
const result = await invoke('api_process_transcript', {
  text,
  model,
  model_name: modelName,
  meeting_id: meetingId,
  custom_prompt: customPrompt
});
```

**After:**
```typescript
const result = await apiClient.generateSummary(
  text,
  model,
  modelName,
  meetingId,
  customPrompt
);
```

#### Get Summary Status

**Before:**
```typescript
const result = await invoke('api_get_summary', { meetingId });
```

**After:**
```typescript
const result = await apiClient.getSummaryStatus(meetingId);
```

#### Get/Save Model Config

**Before:**
```typescript
const config = await invoke('api_get_model_config');
await invoke('api_save_model_config', { provider, model, whisperModel, apiKey });
```

**After:**
```typescript
const config = await apiClient.getModelConfig();
await apiClient.saveModelConfig(provider, model, whisperModel, apiKey);
```

### Step 3: Replace Recording Calls

#### Check Recording Status

**Before:**
```typescript
const isCurrentlyRecording = await invoke('is_recording');
```

**After:**
```typescript
const isCurrentlyRecording = await recordingAdapter.isRecording();
```

#### Get Audio Devices

**Before:**
```typescript
const inputDevices = await invoke('list_input_devices');
const outputDevices = await invoke('list_output_devices');
```

**After:**
```typescript
const inputDevices = await recordingAdapter.getInputDevices();
const outputDevices = await recordingAdapter.getOutputDevices();
```

#### Start Recording

**Before:**
```typescript
await invoke('start_recording_with_devices_and_meeting', {
  mic_device_name: micDevice,
  system_device_name: systemDevice,
  meetingName: title
});
```

**After:**
```typescript
await recordingAdapter.startRecordingWithDevices(
  micDevice,
  systemDevice,
  title
);
```

#### Stop Recording

**Before:**
```typescript
await invoke('stop_recording', {
  args: { save_path: audioPath }
});
```

**After:**
```typescript
const audioPath = await recordingAdapter.stopRecordingAndSave();
```

#### Recording Preferences

**Before:**
```typescript
const prefs = await invoke('get_recording_preferences');
await invoke('save_recording_preferences', { mic_device, system_device });
```

**After:**
```typescript
const prefs = await recordingAdapter.getRecordingPreferences();
await recordingAdapter.saveRecordingPreferences(micDevice, systemDevice);
```

#### Language Preferences

**Before:**
```typescript
const language = await invoke('get_language_preference');
await invoke('save_language_preference', { language });
```

**After:**
```typescript
const language = await recordingAdapter.getLanguagePreference();
await recordingAdapter.saveLanguagePreference(language);
```

### Step 4: Replace Event Listeners

**Before:**
```typescript
const unlisten = await listen<TranscriptUpdate>('transcript-update', (event) => {
  setTranscripts(prev => [...prev, event.payload]);
});
```

**After:**
```typescript
import { platformListen } from '@/lib/platform';

const unlisten = await platformListen<TranscriptUpdate>('transcript-update', (payload) => {
  setTranscripts(prev => [...prev, payload]);
});
```

**Note:** In web environment, events are dispatched using CustomEvent. The Tauri backend would need to be modified to emit events that the web frontend can receive (via WebSocket or polling).

### Step 5: Handle Platform-Specific Features

Some features are only available in Tauri:

```typescript
import { isFeatureSupported, getUnsupportedFeatureMessage } from '@/lib/platform';

if (!isFeatureSupported('file-system')) {
  // Show message or disable feature
  toast.error(getUnsupportedFeatureMessage('file-system'));
  return;
}

// Only in Tauri:
if (isTauri()) {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(path, content);
}
```

## Component-Specific Migration Notes

### `app/page.tsx`

This is the largest file (~1600 lines) with many Tauri calls. Key sections to migrate:

1. **Transcript event listeners** (lines 113-150)
   - Replace `listen()` with `platformListen()`
   - Consider WebSocket alternative for web

2. **Recording functions** (lines 750-850)
   - Replace with `recordingAdapter` calls

3. **API calls** (throughout)
   - Replace `invoke('api_*')` with `apiClient.*`

4. **Config management** (lines 1559-1620)
   - Replace with `apiClient.getModelConfig()` etc.

5. **File system operations**
   - Keep Tauri-only, or implement web alternatives (download blobs)

### `components/RecordingControls.tsx`

Replace recording invoke calls with recordingAdapter:

```typescript
// Import
import * as recordingAdapter from '@/lib/recordingAdapter';

// In component
const startRecording = async () => {
  await recordingAdapter.startRecordingWithDevices(micDevice, systemDevice, title);
};

const stopRecording = async () => {
  const audioPath = await recordingAdapter.stopRecordingAndSave();
  // Handle result
};
```

### `components/DeviceSelection.tsx`

```typescript
import * as recordingAdapter from '@/lib/recordingAdapter';

// Fetch devices
const fetchDevices = async () => {
  const inputDevices = await recordingAdapter.getInputDevices();
  const outputDevices = await recordingAdapter.getOutputDevices();
  setInputDevices(inputDevices);
  setOutputDevices(outputDevices);
};
```

## Real-Time Transcription for Web

The current implementation uses Tauri events for real-time transcript updates. For web:

### Option 1: WebSocket (Recommended)

Backend emits transcript updates via WebSocket:

```typescript
// Backend (add WebSocket endpoint)
from fastapi import WebSocket

@app.websocket("/ws/transcripts/{meeting_id}")
async def transcript_websocket(websocket: WebSocket, meeting_id: str):
    await websocket.accept()
    # Send transcript updates as they come
    while True:
        transcript = await get_next_transcript()
        await websocket.send_json(transcript)

// Frontend
import { isTauri } from '@/lib/platform';

if (isTauri()) {
  // Use Tauri events
  await listen('transcript-update', handler);
} else {
  // Use WebSocket
  const ws = new WebSocket('ws://localhost:5167/ws/transcripts/meeting-123');
  ws.onmessage = (event) => {
    const transcript = JSON.parse(event.data);
    handler(transcript);
  };
}
```

### Option 2: Polling

Poll backend for new transcripts:

```typescript
if (!isTauri()) {
  const interval = setInterval(async () => {
    const meeting = await apiClient.getMeeting(meetingId);
    // Check for new transcripts
    setTranscripts(meeting.transcripts);
  }, 1000);

  return () => clearInterval(interval);
}
```

## Browser Recording Features

### Microphone Access

```typescript
import { startRecording, stopRecording } from '@/lib/browserRecording';

// Start
const stream = await startRecording();

// Stop
const audioBlob = await stopRecording(stream);

// Upload
await apiClient.uploadAudio(audioBlob, meetingTitle);
```

### Screen/Tab Audio

```typescript
import { captureScreenAudio, createMixedAudioStream } from '@/lib/browserRecording';

// User selects tab/screen
const screenStream = await captureScreenAudio();

// Mix with microphone
const micStream = await getUserMedia({ audio: true });
const mixedStream = await createMixedAudioStream(micStream, screenStream);

// Record mixed stream
const recording = await startRecording(undefined, { stream: mixedStream });
```

## Testing Checklist

### Tauri Desktop
- [ ] Recording starts/stops correctly
- [ ] Transcripts update in real-time
- [ ] Meetings save and load
- [ ] Summary generation works
- [ ] Device selection works

### Web Browser
- [ ] Can access microphone
- [ ] Recording uploads successfully
- [ ] Transcripts appear after upload
- [ ] Summary generation works
- [ ] Meetings list loads
- [ ] Can view/edit existing meetings

## Limitations

### Web Browser Limitations
| Feature | Tauri | Web | Notes |
|---------|-------|-----|-------|
| Microphone | ✅ | ✅ | Requires permission |
| System Audio | ✅ | ⚠️ | Web: Tab/screen audio only, requires user selection |
| Background Recording | ✅ | ❌ | Web: Tab must be active |
| File System Access | ✅ | ❌ | Web: Download only |
| Real-time Transcription | ✅ | ⚠️ | Web: Needs WebSocket or polling |
| Notifications | ✅ | ✅ | Both support notifications |

## Next Steps

1. **Complete page.tsx migration** - Systematically replace all invoke calls
2. **Add WebSocket support** - For real-time transcripts in web
3. **Test both environments** - Ensure feature parity where possible
4. **Update UI** - Show platform-specific limitations to users
5. **Add service worker** - For offline support (optional)

## Resources

- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
