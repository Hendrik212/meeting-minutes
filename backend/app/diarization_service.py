"""
Speaker Diarization Service

Uses pyannote.audio for speaker diarization to identify "who spoke when" in meeting transcripts.
Integrates with existing Whisper transcription to add speaker labels to transcript segments.
"""

import logging
from typing import List, Dict, Optional, Tuple
import tempfile
import os
from pathlib import Path
import json

logger = logging.getLogger(__name__)

class DiarizationService:
    """
    Handles speaker diarization using pyannote.audio

    Features:
    - Voice Activity Detection (VAD)
    - Speaker embedding extraction
    - Speaker clustering and identification
    - Alignment with transcript timestamps
    """

    def __init__(self):
        """Initialize the diarization service"""
        self.pipeline = None
        self._initialized = False
        logger.info("DiarizationService created (lazy initialization)")

    def _initialize_pipeline(self):
        """Lazy initialization of pyannote pipeline"""
        if self._initialized:
            return

        try:
            from pyannote.audio import Pipeline

            # Load pre-trained speaker diarization pipeline
            # Note: Requires HuggingFace token for first-time download
            # Users should set HUGGINGFACE_TOKEN environment variable
            logger.info("Loading pyannote.audio speaker diarization pipeline...")

            # Try to use the latest diarization pipeline
            # This will download ~300MB on first run
            self.pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=os.getenv("HUGGINGFACE_TOKEN")
            )

            # Enable GPU if available
            import torch
            if torch.cuda.is_available():
                self.pipeline.to(torch.device("cuda"))
                logger.info("GPU acceleration enabled for diarization")
            else:
                logger.info("Using CPU for diarization (GPU not available)")

            self._initialized = True
            logger.info("Diarization pipeline loaded successfully")

        except ImportError:
            logger.error("pyannote.audio not installed. Install with: pip install pyannote.audio")
            raise ImportError(
                "pyannote.audio is required for speaker diarization. "
                "Install with: pip install pyannote.audio"
            )
        except Exception as e:
            logger.error(f"Failed to initialize diarization pipeline: {str(e)}")
            raise

    async def diarize_audio(
        self,
        audio_path: str,
        num_speakers: Optional[int] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None
    ) -> Dict:
        """
        Perform speaker diarization on an audio file

        Args:
            audio_path: Path to audio file (WAV, MP3, etc.)
            num_speakers: Exact number of speakers (if known)
            min_speakers: Minimum number of speakers to detect
            max_speakers: Maximum number of speakers to detect

        Returns:
            Dictionary containing speaker segments:
            {
                "speakers": ["SPEAKER_00", "SPEAKER_01", ...],
                "segments": [
                    {
                        "start": 0.5,
                        "end": 3.2,
                        "speaker": "SPEAKER_00",
                        "confidence": 0.95
                    },
                    ...
                ]
            }
        """
        try:
            # Initialize pipeline if needed
            self._initialize_pipeline()

            # Validate audio file exists
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found: {audio_path}")

            logger.info(f"Starting diarization for: {audio_path}")

            # Configure diarization parameters
            diarization_params = {}
            if num_speakers is not None:
                diarization_params["num_speakers"] = num_speakers
            else:
                if min_speakers is not None:
                    diarization_params["min_speakers"] = min_speakers
                if max_speakers is not None:
                    diarization_params["max_speakers"] = max_speakers

            # Run diarization
            diarization = self.pipeline(audio_path, **diarization_params)

            # Convert to structured format
            speakers = set()
            segments = []

            for turn, _, speaker in diarization.itertracks(yield_label=True):
                speakers.add(speaker)
                segments.append({
                    "start": turn.start,
                    "end": turn.end,
                    "speaker": speaker,
                    "duration": turn.end - turn.start,
                    "confidence": 1.0  # pyannote doesn't provide per-segment confidence
                })

            logger.info(f"Diarization complete. Found {len(speakers)} speakers in {len(segments)} segments")

            return {
                "speakers": sorted(list(speakers)),
                "segments": segments,
                "num_speakers": len(speakers),
                "total_segments": len(segments)
            }

        except Exception as e:
            logger.error(f"Diarization failed: {str(e)}", exc_info=True)
            raise

    def align_with_transcript(
        self,
        diarization_result: Dict,
        transcript_segments: List[Dict]
    ) -> List[Dict]:
        """
        Align diarization results with transcript segments

        Args:
            diarization_result: Output from diarize_audio()
            transcript_segments: List of transcript segments with timestamps
                [
                    {
                        "text": "Hello world",
                        "start": 0.5,
                        "end": 2.0
                    },
                    ...
                ]

        Returns:
            Transcript segments with speaker labels added:
            [
                {
                    "text": "Hello world",
                    "start": 0.5,
                    "end": 2.0,
                    "speaker": "SPEAKER_00",
                    "speaker_confidence": 0.95
                },
                ...
            ]
        """
        try:
            aligned_segments = []
            diarization_segments = diarization_result["segments"]

            for transcript_seg in transcript_segments:
                # Find overlapping speaker segment(s)
                transcript_start = transcript_seg.get("start", transcript_seg.get("audio_start_time", 0))
                transcript_end = transcript_seg.get("end", transcript_seg.get("audio_end_time", 0))

                # Find best matching speaker (most overlap)
                best_speaker = None
                best_overlap = 0.0

                for diar_seg in diarization_segments:
                    # Calculate overlap
                    overlap_start = max(transcript_start, diar_seg["start"])
                    overlap_end = min(transcript_end, diar_seg["end"])
                    overlap_duration = max(0, overlap_end - overlap_start)

                    if overlap_duration > best_overlap:
                        best_overlap = overlap_duration
                        best_speaker = diar_seg["speaker"]

                # Add speaker label to transcript
                aligned_seg = transcript_seg.copy()
                aligned_seg["speaker"] = best_speaker if best_speaker else "UNKNOWN"
                aligned_seg["speaker_confidence"] = (
                    best_overlap / (transcript_end - transcript_start)
                    if (transcript_end - transcript_start) > 0
                    else 0.0
                )

                aligned_segments.append(aligned_seg)

            logger.info(f"Aligned {len(aligned_segments)} transcript segments with speakers")
            return aligned_segments

        except Exception as e:
            logger.error(f"Alignment failed: {str(e)}", exc_info=True)
            raise

    async def diarize_meeting(
        self,
        audio_path: str,
        transcript_segments: List[Dict],
        num_speakers: Optional[int] = None,
        min_speakers: Optional[int] = 2,
        max_speakers: Optional[int] = 10
    ) -> Dict:
        """
        Complete diarization workflow for a meeting

        Args:
            audio_path: Path to meeting audio file
            transcript_segments: Existing transcript segments with timestamps
            num_speakers: Exact number of speakers (if known)
            min_speakers: Minimum speakers to detect (default: 2)
            max_speakers: Maximum speakers to detect (default: 10)

        Returns:
            {
                "speakers": ["SPEAKER_00", "SPEAKER_01", ...],
                "aligned_transcripts": [transcript segments with speaker labels],
                "summary": {
                    "num_speakers": 2,
                    "total_segments": 45,
                    "speaker_distribution": {
                        "SPEAKER_00": 23,
                        "SPEAKER_01": 22
                    }
                }
            }
        """
        try:
            logger.info(f"Starting complete diarization workflow for {audio_path}")

            # Step 1: Diarize audio
            diarization_result = await self.diarize_audio(
                audio_path=audio_path,
                num_speakers=num_speakers,
                min_speakers=min_speakers,
                max_speakers=max_speakers
            )

            # Step 2: Align with transcript
            aligned_transcripts = self.align_with_transcript(
                diarization_result=diarization_result,
                transcript_segments=transcript_segments
            )

            # Step 3: Generate summary statistics
            speaker_distribution = {}
            for seg in aligned_transcripts:
                speaker = seg.get("speaker", "UNKNOWN")
                speaker_distribution[speaker] = speaker_distribution.get(speaker, 0) + 1

            result = {
                "speakers": diarization_result["speakers"],
                "aligned_transcripts": aligned_transcripts,
                "summary": {
                    "num_speakers": diarization_result["num_speakers"],
                    "total_segments": len(aligned_transcripts),
                    "speaker_distribution": speaker_distribution
                }
            }

            logger.info("Diarization workflow complete")
            return result

        except Exception as e:
            logger.error(f"Diarization workflow failed: {str(e)}", exc_info=True)
            raise

    def rename_speaker(
        self,
        aligned_transcripts: List[Dict],
        old_speaker: str,
        new_name: str
    ) -> List[Dict]:
        """
        Rename a speaker label (e.g., "SPEAKER_00" -> "John")

        Args:
            aligned_transcripts: Transcript segments with speaker labels
            old_speaker: Current speaker label (e.g., "SPEAKER_00")
            new_name: New name for the speaker (e.g., "John")

        Returns:
            Updated transcript segments with renamed speaker
        """
        renamed_segments = []
        for seg in aligned_transcripts:
            seg_copy = seg.copy()
            if seg_copy.get("speaker") == old_speaker:
                seg_copy["speaker"] = new_name
            renamed_segments.append(seg_copy)

        logger.info(f"Renamed speaker {old_speaker} to {new_name}")
        return renamed_segments
