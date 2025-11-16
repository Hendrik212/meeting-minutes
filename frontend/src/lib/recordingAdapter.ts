/**
 * Recording Adapter
 *
 * Provides unified recording interface for both Tauri and Web environments
 */

import { isTauri } from './platform';
import {
  startRecording,
  stopRecording,
  uploadAudio,
  getAudioDevices,
  requestMicrophonePermission,
  type AudioStream,
} from './browserRecording';

export interface RecordingState {
  isRecording: boolean;
  meetingTitle?: string;
}

export interface RecordingDevice {
  name: string;
  id: string;
  is_default: boolean;
}

// Store active recording stream for web environment
let activeRecording: AudioStream | null = null;
let currentMeetingTitle: string = '';

/**
 * Check if currently recording
 */
export async function isRecording(): Promise<boolean> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<boolean>('is_recording');
  } else {
    // Web: Check if we have an active recording stream
    return activeRecording !== null && activeRecording.mediaRecorder.state === 'recording';
  }
}

/**
 * Get available audio input devices
 */
export async function getInputDevices(): Promise<RecordingDevice[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<RecordingDevice[]>('list_input_devices');
  } else {
    // Web: Get microphone devices
    const devices = await getAudioDevices();
    return devices.map(device => ({
      name: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
      id: device.deviceId,
      is_default: device.deviceId === 'default'
    }));
  }
}

/**
 * Get available audio output/system devices
 */
export async function getOutputDevices(): Promise<RecordingDevice[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<RecordingDevice[]>('list_output_devices');
  } else {
    // Web: System audio not available as a list, user selects via browser UI
    return [{
      name: 'Screen/Tab Audio (Select when recording)',
      id: 'screen-audio',
      is_default: true
    }];
  }
}

/**
 * Start recording with specified devices
 */
export async function startRecordingWithDevices(
  micDeviceName: string | null,
  systemDeviceName: string | null,
  meetingTitle: string
): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('start_recording_with_devices_and_meeting', {
      mic_device_name: micDeviceName,
      system_device_name: systemDeviceName,
      meetingName: meetingTitle
    });
  } else {
    // Web: Start browser-based recording
    try {
      // Request microphone permission first
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      // Start microphone recording
      // Find device by name or use default
      const devices = await getAudioDevices();
      const micDevice = devices.find(d => d.label === micDeviceName);

      activeRecording = await startRecording(micDevice?.deviceId);
      currentMeetingTitle = meetingTitle;

      console.log('Web recording started successfully');
    } catch (error) {
      console.error('Failed to start web recording:', error);
      throw error;
    }
  }
}

/**
 * Stop recording and save
 */
export async function stopRecordingAndSave(savePath?: string): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('stop_recording', {
      args: {
        save_path: savePath || '',
      }
    });
    return savePath || '';
  } else {
    // Web: Stop recording and upload to backend
    if (!activeRecording) {
      throw new Error('No active recording to stop');
    }

    try {
      const audioBlob = await stopRecording(activeRecording);
      activeRecording = null;

      // Upload to backend
      const result = await uploadAudio(audioBlob, currentMeetingTitle);

      console.log('Recording uploaded successfully:', result.meeting_id);
      return result.audio_path;
    } catch (error) {
      activeRecording = null;
      console.error('Failed to stop and upload recording:', error);
      throw error;
    }
  }
}

/**
 * Get recording preferences (saved device selections)
 */
export async function getRecordingPreferences(): Promise<{
  preferred_mic_device?: string;
  preferred_system_device?: string;
}> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke('get_recording_preferences');
  } else {
    // Web: Get from localStorage
    const prefs = localStorage.getItem('recording_preferences');
    return prefs ? JSON.parse(prefs) : {};
  }
}

/**
 * Save recording preferences
 */
export async function saveRecordingPreferences(
  micDevice: string | null,
  systemDevice: string | null
): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_recording_preferences', {
      mic_device: micDevice,
      system_device: systemDevice
    });
  } else {
    // Web: Save to localStorage
    localStorage.setItem('recording_preferences', JSON.stringify({
      preferred_mic_device: micDevice,
      preferred_system_device: systemDevice
    }));
  }
}

/**
 * Get language preference
 */
export async function getLanguagePreference(): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('get_language_preference');
  } else {
    // Web: Get from localStorage
    return localStorage.getItem('language_preference') || 'en';
  }
}

/**
 * Save language preference
 */
export async function saveLanguagePreference(language: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_language_preference', { language });
  } else {
    // Web: Save to localStorage
    localStorage.setItem('language_preference', language);
  }
}

/**
 * Check if system audio is supported
 */
export function isSystemAudioSupported(): boolean {
  if (isTauri()) {
    return true;
  } else {
    // Web: Only tab/screen audio via user selection
    return 'getDisplayMedia' in navigator.mediaDevices;
  }
}

/**
 * Get platform-specific recording info message
 */
export function getRecordingInfoMessage(): string {
  if (isTauri()) {
    return 'Desktop app: Can record microphone and all system audio automatically';
  } else {
    return 'Web browser: Can record microphone. For tab audio, you will be prompted to select which tab to share.';
  }
}
