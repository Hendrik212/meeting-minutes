# Using the New Hooks - Complete Example

This document shows how to use the new hooks to create a fully functional recording page that works in both Tauri and web environments.

## Complete Working Example

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useRecordingManager } from '@/hooks/useRecordingManager';
import { useTranscriptManager } from '@/hooks/useTranscriptManager';
import { useSummaryManager } from '@/hooks/useSummaryManager';
import { useModelConfig } from '@/hooks/useModelConfig';
import { RecordingControls } from '@/components/RecordingControls';
import { DeviceSelection } from '@/components/DeviceSelection';
import { TranscriptView } from '@/components/TranscriptView';
import { AISummary } from '@/components/AISummary';
import { isTauri } from '@/lib/platform';
import { toast } from 'sonner';

export default function RecordingPage() {
  const [meetingTitle, setMeetingTitle] = useState('+ New Call');
  const [meetingId, setMeetingId] = useState<string | null>(null);

  // Sidebar context for global state
  const { serverAddress, setCurrentMeeting } = useSidebar();

  // Recording management
  const recording = useRecordingManager();

  // Transcript management
  const transcript = useTranscriptManager(serverAddress);

  // Summary management
  const summary = useSummaryManager();

  // Model configuration
  const { modelConfig } = useModelConfig();

  /**
   * Start recording
   */
  const handleStartRecording = async () => {
    try {
      // Clear previous data
      transcript.clearTranscripts();
      summary.clearSummary();

      // Start recording
      await recording.startRecording(meetingTitle);

      // Start listening for real-time transcripts
      const unlisten = await transcript.startListeningForTranscripts(meetingId || undefined);

      // Store unlisten function for cleanup
      return () => {
        unlisten();
      };
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  /**
   * Stop recording
   */
  const handleStopRecording = async () => {
    try {
      // Stop recording
      const audioPath = await recording.stopRecording();

      if (!audioPath) {
        throw new Error('No audio path returned');
      }

      // Save transcripts to backend
      const result = await transcript.saveTranscripts(meetingTitle);

      if (result.success && result.meetingId) {
        setMeetingId(result.meetingId);
        toast.success('Recording saved successfully');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast.error('Failed to stop recording');
    }
  };

  /**
   * Generate summary
   */
  const handleGenerateSummary = async () => {
    if (transcript.transcripts.length === 0) {
      toast.error('No transcripts available to summarize');
      return;
    }

    const fullTranscript = transcript.transcripts
      .map(t => t.text)
      .join(' ');

    await summary.generateSummary(
      fullTranscript,
      meetingId || 'temp-' + Date.now(),
      modelConfig.provider,
      modelConfig.model
    );
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="p-4 border-b">
        <input
          type="text"
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          className="text-2xl font-bold"
        />
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4">
        {/* Left Side - Recording & Transcripts */}
        <div className="space-y-4">
          {/* Device Selection */}
          <DeviceSelection
            selectedDevices={recording.selectedDevices}
            onChange={recording.setSelectedDevices}
            inputDevices={recording.inputDevices}
            outputDevices={recording.outputDevices}
          />

          {/* Recording Controls */}
          <RecordingControls
            isRecording={recording.isRecording}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
            isDisabled={recording.isRecordingDisabled}
          />

          {/* Transcripts */}
          <TranscriptView
            transcripts={transcript.transcripts}
            isRecording={recording.isRecording}
          />
        </div>

        {/* Right Side - Summary */}
        <div className="space-y-4">
          <button
            onClick={handleGenerateSummary}
            disabled={summary.isProcessing || transcript.transcripts.length === 0}
            className="w-full btn btn-primary"
          >
            {summary.isProcessing ? 'Generating...' : 'Generate Summary'}
          </button>

          {summary.summaryStatus !== 'idle' && (
            <div className="text-sm text-gray-600">
              Status: {summary.summaryStatus}
            </div>
          )}

          {summary.aiSummary && (
            <AISummary summary={summary.aiSummary} />
          )}

          {summary.summaryError && (
            <div className="text-red-600">
              Error: {summary.summaryError}
            </div>
          )}
        </div>
      </div>

      {/* Platform indicator */}
      <footer className="p-2 text-xs text-gray-500 text-center border-t">
        Running on: {isTauri() ? 'Desktop (Tauri)' : 'Web Browser'}
      </footer>
    </div>
  );
}
```

## Hook-by-Hook Breakdown

### 1. useRecordingManager

Handles all recording operations:

```typescript
const recording = useRecordingManager();

// State
recording.isRecording              // Boolean: Is currently recording
recording.selectedDevices          // { micDevice, systemDevice }
recording.selectedLanguage         // String: Selected language
recording.inputDevices             // Array: Available microphones
recording.outputDevices            // Array: Available system audio devices
recording.isRecordingDisabled      // Boolean: Recording button disabled state

// Actions
await recording.startRecording(meetingTitle);
const audioPath = await recording.stopRecording();
recording.setSelectedDevices({ micDevice, systemDevice });
recording.setSelectedLanguage(language);
await recording.refreshDevices();
await recording.loadPreferences();
await recording.savePreferences();
```

### 2. useTranscriptManager

Handles transcript storage and real-time updates:

```typescript
const transcript = useTranscriptManager(serverAddress);

// State
transcript.transcripts             // Array<Transcript>: All transcripts
transcript.isSavingTranscript      // Boolean: Is saving

// Actions
transcript.addTranscript(transcript);
transcript.clearTranscripts();
await transcript.saveTranscripts(meetingTitle, meetingId);
await transcript.loadTranscripts(meetingId);

// Real-time updates (returns cleanup function)
const unlisten = await transcript.startListeningForTranscripts(meetingId);
// Later: unlisten();
```

**Real-Time Transcripts**:
- **Tauri**: Uses Tauri events (`transcript-update`)
- **Web**: Uses WebSocket (`ws://localhost:5167/ws/transcripts/{meetingId}`)

### 3. useSummaryManager

Handles AI summary generation:

```typescript
const summary = useSummaryManager();

// State
summary.summaryStatus              // 'idle' | 'processing' | 'completed' | 'error'
summary.aiSummary                  // Summary object
summary.summaryResponse            // Full response
summary.summaryError               // Error message
summary.isProcessing               // Boolean: Is generating

// Actions
await summary.generateSummary(transcriptText, meetingId, provider, model, customPrompt);
await summary.regenerateSummary(transcriptText, meetingId, provider, model, customPrompt);
summary.clearSummary();
await summary.saveSummary(meetingId);
```

**Polling**: Automatically polls backend every 5s for status updates.

### 4. useModelConfig

Handles LLM and Whisper model configuration:

```typescript
const { modelConfig, loadModelConfig, saveModelConfig, updateModelConfig } = useModelConfig();

// State
modelConfig.provider               // 'ollama' | 'groq' | 'claude' | 'openai'
modelConfig.model                  // Model name
modelConfig.whisperModel           // Whisper model name
modelConfig.apiKey                 // API key (optional)

// Actions
await loadModelConfig();
await saveModelConfig(config);
updateModelConfig({ provider: 'openai' });  // Local update
```

## Platform Differences

### Feature Availability

```typescript
import { isFeatureSupported, getUnsupportedFeatureMessage } from '@/lib/platform';

if (isFeatureSupported('system-audio')) {
  // Show system audio selection
} else {
  // Show message: "System audio is only available in desktop app"
  console.log(getUnsupportedFeatureMessage('system-audio'));
}
```

### Real-Time Updates

**Tauri (Desktop)**:
- Uses native Tauri events
- Instantaneous, low latency
- Automatic cleanup

**Web (Browser)**:
- Uses WebSocket connection
- Requires backend WebSocket endpoint
- Auto-reconnection on disconnect

## Migration from Old Code

### Before (Direct Tauri Calls)

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Start recording
await invoke('start_recording_with_devices_and_meeting', {
  mic_device_name: micDevice,
  system_device_name: systemDevice,
  meetingName: title
});

// Listen for transcripts
const unlisten = await listen('transcript-update', (event) => {
  setTranscripts(prev => [...prev, event.payload]);
});

// Get meetings
const meetings = await invoke('api_get_meetings');

// Stop recording
await invoke('stop_recording', { args: { save_path: path } });
```

### After (Using Hooks)

```typescript
import { useRecordingManager } from '@/hooks/useRecordingManager';
import { useTranscriptManager } from '@/hooks/useTranscriptManager';
import { apiClient } from '@/lib/apiClient';

const recording = useRecordingManager();
const transcript = useTranscriptManager();

// Start recording
await recording.startRecording(title);

// Listen for transcripts
const unlisten = await transcript.startListeningForTranscripts();

// Get meetings
const meetings = await apiClient.getMeetings();

// Stop recording
await recording.stopRecording();
```

## Testing in Both Environments

### Development

**Tauri Desktop**:
```bash
cd frontend
pnpm run tauri:dev
```

**Web Browser**:
```bash
# Terminal 1: Backend
cd backend
docker compose up

# Terminal 2: Frontend
cd frontend
pnpm run dev

# Open http://localhost:3000
```

### Production

**Tauri Desktop**:
```bash
cd frontend
pnpm run tauri:build
```

**Web (Docker)**:
```bash
# From project root
docker compose up -d

# Open http://localhost or your domain
```

## Best Practices

1. **Always use hooks** instead of direct API calls
2. **Check platform** when using platform-specific features
3. **Cleanup listeners** in useEffect cleanup functions
4. **Handle errors gracefully** - show user-friendly messages
5. **Save preferences** after user selections
6. **Provide feedback** using toast notifications

## Common Patterns

### Loading Initial Data

```typescript
useEffect(() => {
  const loadData = async () => {
    await recording.loadPreferences();
    await modelConfig.loadModelConfig();

    if (meetingId) {
      await transcript.loadTranscripts(meetingId);
    }
  };

  loadData();
}, [meetingId]);
```

### Cleanup on Unmount

```typescript
useEffect(() => {
  let unlisten: (() => void) | null = null;

  const setup = async () => {
    unlisten = await transcript.startListeningForTranscripts();
  };

  setup();

  return () => {
    if (unlisten) {
      unlisten();
    }
  };
}, []);
```

### Error Handling

```typescript
try {
  await recording.startRecording(title);
  toast.success('Recording started');
} catch (error) {
  console.error('Recording error:', error);
  toast.error(error instanceof Error ? error.message : 'Failed to start recording');
}
```

## Next Steps

1. Replace direct `invoke()` calls with hook equivalents
2. Replace event listeners with `transcript.startListeningForTranscripts()`
3. Use `apiClient` for all backend API calls
4. Test in both Tauri and web environments
5. Handle platform-specific features gracefully

For complete migration guide, see [FRONTEND_MIGRATION_GUIDE.md](./FRONTEND_MIGRATION_GUIDE.md).
