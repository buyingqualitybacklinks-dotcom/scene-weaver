import { useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { usePuter, Scene } from './usePuter';

// Helper to format time as SRT timestamp (HH:MM:SS,mmm)
function formatSrtTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export type GenerationStep = 
  | 'idle'
  | 'generating-prompts'
  | 'generating-images'
  | 'generating-audio'
  | 'assembling-video'
  | 'complete'
  | 'error';

export interface GenerationState {
  step: GenerationStep;
  progress: number;
  currentScene: number;
  totalScenes: number;
  scenes: Scene[];
  videoUrl?: string;
  error?: string;
}

export function useVideoGeneration() {
  const [state, setState] = useState<GenerationState>({
    step: 'idle',
    progress: 0,
    currentScene: 0,
    totalScenes: 12,
    scenes: [],
  });

  const puter = usePuter();
  const ffmpegRef = { current: null as FFmpeg | null };

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  }, []);

  const generateVideo = useCallback(async (mainPrompt: string, script?: string) => {
    try {
      setState({
        step: 'generating-prompts',
        progress: 0,
        currentScene: 0,
        totalScenes: 12,
        scenes: [],
      });

      // Step 1: Generate scene prompts
      const scenePrompts = await puter.generateScenePrompts(mainPrompt, script);
      const scriptChunks = puter.splitScript(script || '', 12);
      
      const scenes: Scene[] = scenePrompts.map((prompt, i) => ({
        id: i,
        prompt,
        script: scriptChunks[i] || '',
      }));

      setState(prev => ({
        ...prev,
        step: 'generating-images',
        progress: 10,
        scenes,
      }));

      // Step 2: Generate images
      for (let i = 0; i < scenes.length; i++) {
        const imageUrl = await puter.generateImage(scenes[i].prompt);
        scenes[i].imageUrl = imageUrl;
        
        setState(prev => ({
          ...prev,
          currentScene: i + 1,
          progress: 10 + (i + 1) * 5,
          scenes: [...scenes],
        }));
      }

      setState(prev => ({
        ...prev,
        step: 'generating-audio',
        progress: 70,
      }));

      // Step 3: Generate TTS audio for each scene and get durations
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].script) {
          const audioBlob = await puter.generateSpeech(scenes[i].script);
          scenes[i].audioBlob = audioBlob;
          
          // Get audio duration
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          await new Promise<void>((resolve) => {
            audio.onloadedmetadata = () => {
              scenes[i].audioDuration = audio.duration || 5;
              URL.revokeObjectURL(audioUrl);
              resolve();
            };
            audio.onerror = () => {
              scenes[i].audioDuration = 5; // fallback
              URL.revokeObjectURL(audioUrl);
              resolve();
            };
          });
        } else {
          scenes[i].audioDuration = 5; // default 5 seconds for scenes without script
        }
        
        setState(prev => ({
          ...prev,
          currentScene: i + 1,
          progress: 70 + (i + 1) * 1.5,
          scenes: [...scenes],
        }));
      }

      setState(prev => ({
        ...prev,
        step: 'assembling-video',
        progress: 88,
      }));

      // Step 4: Assemble video with FFmpeg
      const ffmpeg = await loadFFmpeg();
      
      // Write images to FFmpeg virtual filesystem
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].imageUrl) {
          const response = await fetch(scenes[i].imageUrl!);
          const imageData = await response.arrayBuffer();
          await ffmpeg.writeFile(`image${i}.png`, new Uint8Array(imageData));
        }
      }

      // Write audio files and concatenate them
      let totalDuration = 0;
      const audioInputs: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].audioBlob) {
          const audioData = await scenes[i].audioBlob!.arrayBuffer();
          await ffmpeg.writeFile(`audio${i}.mp3`, new Uint8Array(audioData));
          audioInputs.push(`audio${i}.mp3`);
        }
        totalDuration += scenes[i].audioDuration || 5;
      }

      // Create audio concat file
      if (audioInputs.length > 0) {
        const audioList = audioInputs.map(f => `file '${f}'`).join('\n');
        await ffmpeg.writeFile('audiolist.txt', audioList);
        await ffmpeg.exec([
          '-f', 'concat', '-safe', '0', '-i', 'audiolist.txt',
          '-c', 'copy', 'combined_audio.mp3'
        ]);
      }

      // Generate SRT subtitles with dynamic timing
      let srtContent = '';
      let currentTime = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].script) {
          const startTime = formatSrtTime(currentTime);
          const endTime = formatSrtTime(currentTime + (scenes[i].audioDuration || 5));
          srtContent += `${i + 1}\n${startTime} --> ${endTime}\n${scenes[i].script.trim()}\n\n`;
        }
        currentTime += scenes[i].audioDuration || 5;
      }
      await ffmpeg.writeFile('subtitles.srt', srtContent);

      // Create video with each image shown for its audio duration
      // First create individual clips then concat
      const videoSegments: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const duration = scenes[i].audioDuration || 5;
        await ffmpeg.exec([
          '-loop', '1', '-t', String(duration),
          '-i', `image${i}.png`,
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30',
          `segment${i}.mp4`
        ]);
        videoSegments.push(`segment${i}.mp4`);
      }

      // Create video concat file
      const videoList = videoSegments.map(f => `file '${f}'`).join('\n');
      await ffmpeg.writeFile('videolist.txt', videoList);
      await ffmpeg.exec([
        '-f', 'concat', '-safe', '0', '-i', 'videolist.txt',
        '-c', 'copy', 'video_only.mp4'
      ]);

      // Combine video with audio and burn in subtitles (Shorts-style: bold, centered, bottom)
      const hasAudio = audioInputs.length > 0;
      const subtitleFilter = "subtitles=subtitles.srt:force_style='Fontsize=24,Bold=1,Alignment=2,MarginV=80,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1'";
      
      if (hasAudio) {
        await ffmpeg.exec([
          '-i', 'video_only.mp4',
          '-i', 'combined_audio.mp3',
          '-vf', subtitleFilter,
          '-c:v', 'libx264', '-c:a', 'aac',
          '-shortest', '-pix_fmt', 'yuv420p',
          'output.mp4'
        ]);
      } else {
        await ffmpeg.exec([
          '-i', 'video_only.mp4',
          '-vf', subtitleFilter,
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
          'output.mp4'
        ]);
      }

      const data = await ffmpeg.readFile('output.mp4');
      const blobParts: BlobPart[] = typeof data === 'string' ? [data] : [new Uint8Array(data).buffer as ArrayBuffer];
      const videoBlob = new Blob(blobParts, { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(videoBlob);

      setState(prev => ({
        ...prev,
        step: 'complete',
        progress: 100,
        videoUrl,
      }));

    } catch (error) {
      console.error('Video generation failed:', error);
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  }, [puter, loadFFmpeg]);

  const reset = useCallback(() => {
    if (state.videoUrl) {
      URL.revokeObjectURL(state.videoUrl);
    }
    setState({
      step: 'idle',
      progress: 0,
      currentScene: 0,
      totalScenes: 12,
      scenes: [],
    });
  }, [state.videoUrl]);

  return {
    state,
    generateVideo,
    reset,
  };
}
