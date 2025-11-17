/**
 * API Client Adapter
 *
 * Provides a unified interface for API calls that works in both:
 * 1. Tauri desktop app (using Tauri invoke commands)
 * 2. Web browser (using fetch API)
 *
 * This allows gradual migration from Tauri to web without breaking existing code.
 */

import { getBackendUrl } from './config';

// Detect if running in Tauri environment
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * API Client for backend communication
 */
export class ApiClient {
  private isTauri: boolean;

  constructor() {
    this.isTauri = isTauriEnvironment();
    console.log('[ApiClient] Initialized in', this.isTauri ? 'Tauri' : 'Web', 'mode');
  }

  /**
   * Get the current backend URL (may change after config is loaded)
   */
  private getBaseUrl(): string {
    return getBackendUrl();
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        }
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // ====================================================================
  // Meeting Management
  // ====================================================================

  async getMeetings(): Promise<Array<{ id: string; title: string }>> {
    return this.fetch('/get-meetings');
  }

  async getMeeting(meetingId: string): Promise<any> {
    return this.fetch(`/get-meeting/${meetingId}`);
  }

  async saveMeetingTitle(meetingId: string, title: string): Promise<void> {
    await this.fetch('/save-meeting-title', {
      method: 'POST',
      body: JSON.stringify({ meeting_id: meetingId, title })
    });
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    await this.fetch('/delete-meeting', {
      method: 'POST',
      body: JSON.stringify({ meeting_id: meetingId })
    });
  }

  async saveMeetingSummary(meetingId: string, summary: any): Promise<void> {
    await this.fetch('/save-meeting-summary', {
      method: 'POST',
      body: JSON.stringify({ meeting_id: meetingId, summary })
    });
  }

  // ====================================================================
  // Transcript Management
  // ====================================================================

  async saveTranscript(
    meetingTitle: string,
    transcripts: any[],
    folderPath?: string
  ): Promise<any> {
    return this.fetch('/save-meeting', {
      method: 'POST',
      body: JSON.stringify({
        meeting_title: meetingTitle,
        transcripts,
        folder_path: folderPath
      })
    });
  }

  async searchTranscripts(query: string): Promise<any> {
    return this.fetch('/search-transcripts', {
      method: 'POST',
      body: JSON.stringify({ query })
    });
  }

  // ====================================================================
  // Summary Generation
  // ====================================================================

  async generateSummary(
    text: string,
    model: string,
    modelName: string,
    meetingId: string,
    customPrompt?: string
  ): Promise<{ process_id: string }> {
    return this.fetch('/process-transcript', {
      method: 'POST',
      body: JSON.stringify({
        text,
        model,
        model_name: modelName,
        meeting_id: meetingId,
        custom_prompt: customPrompt
      })
    });
  }

  async getSummaryStatus(processId: string): Promise<any> {
    return this.fetch(`/get-summary/${processId}`);
  }

  // ====================================================================
  // Model Configuration
  // ====================================================================

  async getModelConfig(): Promise<any> {
    return this.fetch('/get-model-config');
  }

  async saveModelConfig(
    provider: string,
    model: string,
    whisperModel: string,
    apiKey?: string
  ): Promise<void> {
    await this.fetch('/save-model-config', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        model,
        whisperModel,
        apiKey
      })
    });
  }

  async getTranscriptConfig(): Promise<any> {
    return this.fetch('/get-transcript-config');
  }

  async saveTranscriptConfig(
    provider: string,
    model: string,
    apiKey?: string,
    diarization?: number
  ): Promise<void> {
    await this.fetch('/save-transcript-config', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        model,
        apiKey,
        diarization
      })
    });
  }

  async getApiKey(provider: string): Promise<{ api_key: string }> {
    return this.fetch('/get-api-key', {
      method: 'POST',
      body: JSON.stringify({ provider })
    });
  }

  async getTranscriptApiKey(provider: string): Promise<{ api_key: string }> {
    return this.fetch('/get-transcript-api-key', {
      method: 'POST',
      body: JSON.stringify({ provider })
    });
  }

  // ====================================================================
  // Templates
  // ====================================================================

  async listTemplates(): Promise<{ templates: Array<{ id: string; name: string; prompt: string }> }> {
    return this.fetch('/list-templates');
  }

  // ====================================================================
  // Auto-Generate Settings
  // ====================================================================

  async getAutoGenerateSetting(): Promise<{ enabled: boolean }> {
    return this.fetch('/get-auto-generate-setting');
  }

  async saveAutoGenerateSetting(enabled: boolean): Promise<{ success: boolean; enabled: boolean }> {
    return this.fetch('/save-auto-generate-setting', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
  }

  // ====================================================================
  // Audio Management (Web-specific)
  // ====================================================================

  async uploadAudio(
    audioBlob: Blob,
    meetingTitle: string,
    meetingId?: string
  ): Promise<{ meeting_id: string; audio_path: string; message: string }> {
    const formData = new FormData();

    // Convert blob to file
    const extension = this.getExtensionFromMimeType(audioBlob.type);
    const audioFile = new File([audioBlob], `recording${extension}`, {
      type: audioBlob.type
    });

    formData.append('audio', audioFile);
    formData.append('meeting_title', meetingTitle);
    if (meetingId) {
      formData.append('meeting_id', meetingId);
    }

    const url = `${this.getBaseUrl()}/audio/upload`;

    const response = await fetch(url, {
      method: 'POST',
      body: formData
      // Don't set Content-Type header - browser will set it with boundary
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  async downloadAudio(meetingId: string): Promise<Blob> {
    const url = `${this.getBaseUrl()}/audio/download/${meetingId}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }

    return await response.blob();
  }

  // ====================================================================
  // Health Check
  // ====================================================================

  async healthCheck(): Promise<{ status: string; service: string; timestamp: number }> {
    return this.fetch('/health');
  }

  // ====================================================================
  // Utilities
  // ====================================================================

  private getExtensionFromMimeType(mimeType: string): string {
    const map: { [key: string]: string } = {
      'audio/webm': '.webm',
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a',
      'audio/wav': '.wav',
      'audio/mpeg': '.mp3'
    };

    const baseType = mimeType.split(';')[0];
    return map[baseType] || '.webm';
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Export for convenience
export default apiClient;
