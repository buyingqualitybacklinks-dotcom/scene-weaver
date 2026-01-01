import { useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { usePuter, Scene } from './usePuter';

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

      // Step 3: Generate TTS audio for each scene
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].script) {
          const audioBlob = await puter.generateSpeech(scenes[i].script);
          scenes[i].audioBlob = audioBlob;
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

      // Create a simple slideshow (5 seconds per image = 60 seconds total)
      // Using filter_complex for crossfade transitions
      let filterComplex = '';
      let inputs = '';
      
      for (let i = 0; i < scenes.length; i++) {
        inputs += `-loop 1 -t 5 -i image${i}.png `;
      }

      // Simple concat for now
      filterComplex = `concat=n=${scenes.length}:v=1:a=0,format=yuv420p[v]`;
      
      await ffmpeg.exec([
        '-framerate', '1/5',
        '-i', 'image%d.png',
        '-c:v', 'libx264',
        '-r', '30',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
        '-t', '60',
        'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      // Convert FileData to Blob safely
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
