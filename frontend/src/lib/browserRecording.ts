/**
 * Browser-based Audio Recording Utilities
 *
 * Provides browser-compatible recording functionality using Web Audio API
 * Replaces Tauri-based recording for web deployments
 */

export interface RecordingOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  sampleRate?: number;
}

export interface AudioStream {
  stream: MediaStream;
  mediaRecorder: MediaRecorder;
  audioChunks: Blob[];
}

/**
 * Request microphone access from the browser
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop the stream immediately, we just needed permission
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    return false;
  }
}

/**
 * Get available audio input devices
 */
export async function getAudioDevices(): Promise<MediaDeviceInfo[]> {
  try {
    // First request permission to enumerate devices
    await requestMicrophonePermission();

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  } catch (error) {
    console.error('Error enumerating audio devices:', error);
    return [];
  }
}

/**
 * Start recording audio from microphone
 *
 * @param deviceId - Optional specific device ID to use
 * @param options - Recording options (mime type, bitrate, etc.)
 * @returns AudioStream object with recording controls
 */
export async function startRecording(
  deviceId?: string,
  options: RecordingOptions = {}
): Promise<AudioStream> {
  try {
    // Request microphone access
    const constraints: MediaStreamConstraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId } }
        : true
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Determine best supported MIME type
    const mimeType = options.mimeType || getSupportedMimeType();

    // Create MediaRecorder
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: options.audioBitsPerSecond || 128000
    });

    const audioChunks: Blob[] = [];

    // Collect audio data
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    // Start recording
    mediaRecorder.start(100); // Collect data every 100ms

    return {
      stream,
      mediaRecorder,
      audioChunks
    };

  } catch (error) {
    console.error('Error starting recording:', error);
    throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stop recording and return the audio blob
 */
export async function stopRecording(audioStream: AudioStream): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const { stream, mediaRecorder, audioChunks } = audioStream;

      mediaRecorder.onstop = () => {
        // Create final blob from chunks
        const mimeType = mediaRecorder.mimeType;
        const audioBlob = new Blob(audioChunks, { type: mimeType });

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        resolve(audioBlob);
      };

      mediaRecorder.onerror = (event) => {
        reject(new Error(`Recording error: ${event}`));
      };

      // Stop the recorder
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      } else {
        // Already stopped, resolve immediately
        const mimeType = mediaRecorder.mimeType;
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());
        resolve(audioBlob);
      }

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Upload audio blob to backend API
 */
export async function uploadAudio(
  audioBlob: Blob,
  meetingTitle: string,
  apiUrl: string = '/api'
): Promise<{ meeting_id: string; audio_path: string; message: string }> {
  try {
    const formData = new FormData();

    // Convert blob to file with appropriate extension
    const extension = getExtensionFromMimeType(audioBlob.type);
    const audioFile = new File([audioBlob], `recording${extension}`, {
      type: audioBlob.type
    });

    formData.append('audio', audioFile);
    formData.append('meeting_title', meetingTitle);

    const response = await fetch(`${apiUrl}/audio/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }

    return await response.json();

  } catch (error) {
    console.error('Error uploading audio:', error);
    throw new Error(`Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Request screen/tab audio capture (requires user selection)
 */
export async function captureScreenAudio(): Promise<MediaStream | null> {
  try {
    // @ts-ignore - getDisplayMedia audio option
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: false,
      audio: true
    });

    return stream;
  } catch (error) {
    console.error('Screen audio capture failed:', error);
    return null;
  }
}

/**
 * Mix microphone and screen audio into single stream
 */
export async function createMixedAudioStream(
  micStream: MediaStream,
  screenStream: MediaStream
): Promise<MediaStream> {
  const audioContext = new AudioContext();

  // Create sources
  const micSource = audioContext.createMediaStreamSource(micStream);
  const screenSource = audioContext.createMediaStreamSource(screenStream);

  // Create destination
  const destination = audioContext.createMediaStreamDestination();

  // Create gain nodes for volume control
  const micGain = audioContext.createGain();
  const screenGain = audioContext.createGain();

  // Set default volumes (can be adjusted)
  micGain.gain.value = 1.0;
  screenGain.gain.value = 0.5; // Reduce screen audio to prevent overwhelming mic

  // Connect the audio graph
  micSource.connect(micGain);
  screenGain.connect(micGain);

  micGain.connect(destination);
  screenGain.connect(destination);

  return destination.stream;
}

/**
 * Get the best supported MIME type for recording
 */
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/wav'
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  // Fallback
  return 'audio/webm';
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const map: { [key: string]: string } = {
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
    'audio/mpeg': '.mp3'
  };

  // Find matching type (ignore codecs)
  const baseType = mimeType.split(';')[0];
  return map[baseType] || '.webm';
}

/**
 * Download audio blob as file (for testing/debugging)
 */
export function downloadAudioBlob(blob: Blob, filename: string = 'recording') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}${getExtensionFromMimeType(blob.type)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert audio blob to WAV format (if needed)
 * Note: This is a simplified version, may need proper WAV encoding
 */
export async function convertToWav(audioBlob: Blob): Promise<Blob> {
  // For now, just return the blob as-is
  // In production, you might want to use a library like lamejs or audiobuffer-to-wav
  return audioBlob;
}
