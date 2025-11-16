/**
 * Recording Manager Hook
 *
 * Handles all recording-related logic for both Tauri and web environments
 */

import { useState, useCallback, useEffect } from 'react';
import { isTauri } from '@/lib/platform';
import * as recordingAdapter from '@/lib/recordingAdapter';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';

export interface SelectedDevices {
  micDevice: string | null;
  systemDevice: string | null;
}

export interface RecordingDevice {
  name: string;
  id: string;
  is_default: boolean;
}

export interface UseRecordingManagerReturn {
  // State
  isRecording: boolean;
  selectedDevices: SelectedDevices;
  selectedLanguage: string;
  inputDevices: RecordingDevice[];
  outputDevices: RecordingDevice[];
  isRecordingDisabled: boolean;

  // Actions
  startRecording: (meetingTitle: string) => Promise<void>;
  stopRecording: () => Promise<string | null>; // Returns audio path
  setSelectedDevices: (devices: SelectedDevices) => void;
  setSelectedLanguage: (language: string) => void;
  refreshDevices: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;
}

export function useRecordingManager(): UseRecordingManagerReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>({
    micDevice: null,
    systemDevice: null
  });
  const [selectedLanguage, setSelectedLanguage] = useState('auto-translate');
  const [inputDevices, setInputDevices] = useState<RecordingDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<RecordingDevice[]>([]);
  const [isRecordingDisabled, setIsRecordingDisabled] = useState(false);

  /**
   * Load user preferences (devices, language)
   */
  const loadPreferences = useCallback(async () => {
    try {
      // Load device preferences
      const prefs = await recordingAdapter.getRecordingPreferences();
      if (prefs.preferred_mic_device || prefs.preferred_system_device) {
        setSelectedDevices({
          micDevice: prefs.preferred_mic_device || null,
          systemDevice: prefs.preferred_system_device || null
        });
      }

      // Load language preference
      const language = await recordingAdapter.getLanguagePreference();
      if (language) {
        setSelectedLanguage(language);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }, []);

  /**
   * Save user preferences
   */
  const savePreferences = useCallback(async () => {
    try {
      await recordingAdapter.saveRecordingPreferences(
        selectedDevices.micDevice,
        selectedDevices.systemDevice
      );
      await recordingAdapter.saveLanguagePreference(selectedLanguage);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }, [selectedDevices, selectedLanguage]);

  /**
   * Refresh available audio devices
   */
  const refreshDevices = useCallback(async () => {
    try {
      const [inputs, outputs] = await Promise.all([
        recordingAdapter.getInputDevices(),
        recordingAdapter.getOutputDevices()
      ]);

      setInputDevices(inputs);
      setOutputDevices(outputs);

      // If no devices selected but we have available devices, select defaults
      if (!selectedDevices.micDevice && inputs.length > 0) {
        const defaultInput = inputs.find(d => d.is_default) || inputs[0];
        setSelectedDevices(prev => ({
          ...prev,
          micDevice: defaultInput.name
        }));
      }

      if (!selectedDevices.systemDevice && outputs.length > 0) {
        const defaultOutput = outputs.find(d => d.is_default) || outputs[0];
        setSelectedDevices(prev => ({
          ...prev,
          systemDevice: defaultOutput.name
        }));
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to load audio devices');
    }
  }, [selectedDevices]);

  /**
   * Start recording
   */
  const startRecording = useCallback(async (meetingTitle: string) => {
    try {
      setIsRecordingDisabled(true);

      // Validate devices
      if (!selectedDevices.micDevice) {
        toast.error('Please select a microphone device');
        setIsRecordingDisabled(false);
        return;
      }

      // Start recording via adapter (handles both Tauri and web)
      await recordingAdapter.startRecordingWithDevices(
        selectedDevices.micDevice,
        selectedDevices.systemDevice,
        meetingTitle
      );

      setIsRecording(true);

      // Save preferences
      await savePreferences();

      // Analytics - use meetingTitle as temporary ID (meeting not created yet)
      Analytics.trackRecordingStarted(meetingTitle);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start recording');
      setIsRecording(false);
    } finally {
      setIsRecordingDisabled(false);
    }
  }, [selectedDevices, savePreferences]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      setIsRecordingDisabled(true);

      // Stop recording via adapter (handles both Tauri and web)
      const audioPath = await recordingAdapter.stopRecordingAndSave();

      setIsRecording(false);

      // Analytics - pass empty string as meetingId (meeting created later)
      Analytics.trackRecordingStopped('', undefined);

      toast.success('Recording stopped');
      return audioPath;
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to stop recording');
      setIsRecording(false);
      return null;
    } finally {
      setIsRecordingDisabled(false);
    }
  }, []);

  /**
   * Check recording state on mount and periodically
   */
  useEffect(() => {
    const checkRecordingState = async () => {
      try {
        const isCurrentlyRecording = await recordingAdapter.isRecording();
        setIsRecording(isCurrentlyRecording);
      } catch (error) {
        console.error('Error checking recording state:', error);
      }
    };

    // Check initial state
    checkRecordingState();

    // Poll recording state every 2 seconds
    const interval = setInterval(checkRecordingState, 2000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Load devices and preferences on mount
   */
  useEffect(() => {
    refreshDevices();
    loadPreferences();
  }, []);

  return {
    // State
    isRecording,
    selectedDevices,
    selectedLanguage,
    inputDevices,
    outputDevices,
    isRecordingDisabled,

    // Actions
    startRecording,
    stopRecording,
    setSelectedDevices,
    setSelectedLanguage,
    refreshDevices,
    loadPreferences,
    savePreferences
  };
}
