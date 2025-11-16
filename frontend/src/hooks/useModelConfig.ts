/**
 * Model Configuration Hook
 *
 * Handles LLM and Whisper model configuration management
 * Works in both Tauri and web environments
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';

export interface ModelConfig {
  provider: 'ollama' | 'groq' | 'claude' | 'openai' | 'openrouter';
  model: string;
  whisperModel: string;
  apiKey?: string;
}

export interface UseModelConfigReturn {
  // State
  modelConfig: ModelConfig;
  isLoading: boolean;

  // Actions
  loadModelConfig: () => Promise<void>;
  saveModelConfig: (config: ModelConfig) => Promise<void>;
  updateModelConfig: (updates: Partial<ModelConfig>) => void;
}

const DEFAULT_CONFIG: ModelConfig = {
  provider: 'ollama',
  model: 'llama3.2:latest',
  whisperModel: 'base'
};

export function useModelConfig(
  initialConfig?: Partial<ModelConfig>
): UseModelConfigReturn {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Load model configuration from backend
   */
  const loadModelConfig = useCallback(async () => {
    try {
      setIsLoading(true);

      const config = await apiClient.getModelConfig();

      if (config && config.provider) {
        setModelConfig(prev => ({
          ...prev,
          provider: config.provider,
          model: config.model || prev.model,
          whisperModel: config.whisperModel || prev.whisperModel,
          apiKey: config.apiKey
        }));

        console.log('Loaded model config:', config);
      }
    } catch (error) {
      console.error('Error loading model config:', error);
      // Don't show toast on load error, use defaults silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save model configuration to backend
   */
  const saveModelConfig = useCallback(async (config: ModelConfig) => {
    try {
      setIsLoading(true);

      await apiClient.saveModelConfig(
        config.provider,
        config.model,
        config.whisperModel,
        config.apiKey
      );

      setModelConfig(config);

      console.log('Saved model config:', config);
      toast.success('Model configuration saved');
    } catch (error) {
      console.error('Error saving model config:', error);
      toast.error('Failed to save model configuration');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update model configuration (local only)
   */
  const updateModelConfig = useCallback((updates: Partial<ModelConfig>) => {
    setModelConfig(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  /**
   * Load configuration on mount
   */
  useEffect(() => {
    loadModelConfig();
  }, [loadModelConfig]);

  return {
    // State
    modelConfig,
    isLoading,

    // Actions
    loadModelConfig,
    saveModelConfig,
    updateModelConfig
  };
}
