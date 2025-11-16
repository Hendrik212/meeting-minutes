import { useState, useEffect } from 'react';
import { isTauri, platformInvoke } from '@/lib/platform';
import * as recordingAdapter from '@/lib/recordingAdapter';

export interface PermissionStatus {
  hasMicrophone: boolean;
  hasSystemAudio: boolean;
  isChecking: boolean;
  error: string | null;
}

export function usePermissionCheck() {
  const [status, setStatus] = useState<PermissionStatus>({
    hasMicrophone: false,
    hasSystemAudio: false,
    isChecking: true,
    error: null,
  });

  const checkPermissions = async () => {
    setStatus(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      if (isTauri()) {
        // Tauri: Get audio devices to check for microphone and system audio availability
        const devices = await platformInvoke<Array<{ name: string; device_type: 'Input' | 'Output' }>>('get_audio_devices');

        // Check for microphone devices (Input)
        const inputDevices = devices.filter(d => d.device_type === 'Input');
        const hasMicrophone = inputDevices.length > 0;

        // Check for system audio devices (Output)
        // On macOS, we need ScreenCaptureKit devices for system audio
        const outputDevices = devices.filter(d => d.device_type === 'Output');
        const hasSystemAudio = outputDevices.length > 0;

        console.log('Permission check (Tauri):', {
          hasMicrophone,
          hasSystemAudio,
          inputDevices: inputDevices.length,
          outputDevices: outputDevices.length
        });

        setStatus({
          hasMicrophone,
          hasSystemAudio,
          isChecking: false,
          error: null,
        });

        return { hasMicrophone, hasSystemAudio };
      } else {
        // Web: Use browser's audio device API
        const [inputDevices, outputDevices] = await Promise.all([
          recordingAdapter.getInputDevices(),
          recordingAdapter.getOutputDevices()
        ]);

        const hasMicrophone = inputDevices.length > 0;
        const hasSystemAudio = outputDevices.length > 0; // Web always has "screen audio" option

        console.log('Permission check (Web):', {
          hasMicrophone,
          hasSystemAudio,
          inputDevices: inputDevices.length,
          outputDevices: outputDevices.length
        });

        setStatus({
          hasMicrophone,
          hasSystemAudio,
          isChecking: false,
          error: null,
        });

        return { hasMicrophone, hasSystemAudio };
      }
    } catch (error) {
      console.error('Failed to check audio permissions:', error);
      setStatus({
        hasMicrophone: false,
        hasSystemAudio: false,
        isChecking: false,
        error: error instanceof Error ? error.message : 'Failed to check permissions',
      });
      return { hasMicrophone: false, hasSystemAudio: false };
    }
  };

  const requestPermissions = async () => {
    try {
      if (isTauri()) {
        // Trigger audio permission by trying to access devices
        await platformInvoke('get_audio_devices');
      } else {
        // Web: Request microphone permission
        const { requestMicrophonePermission } = await import('@/lib/browserRecording');
        await requestMicrophonePermission();
      }

      // Recheck after triggering
      setTimeout(() => {
        checkPermissions();
      }, 1000);
    } catch (error) {
      console.error('Failed to request permissions:', error);
    }
  };

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  return {
    ...status,
    checkPermissions,
    requestPermissions,
  };
}
