import { useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
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

// Optimized settings for browser environment
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;
const FRAME_RATE = 24;
const SCENE_COUNT = 6; // Reduced for memory optimization

export function useVideoGeneration() {
  const [state, setState] = useState<GenerationState>({
    step: 'idle',
    progress: 0,
    currentScene: 0,
    totalScenes: SCENE_COUNT,
    scenes: [],
  });

  const puter = usePuter();
  const ffmpegRef = { current: null as FFmpeg | null };

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      ffmpegRef.current = ffmpeg;
      return ffmpeg;
    } catch (error) {
      console.error('FFmpeg load failed:', error);
      throw new Error('FFmpeg yüklenemedi. Lütfen sayfayı yenileyin ve tekrar deneyin.');
    }
  }, []);

  // Helper to safely delete FFmpeg files
  const safeDeleteFile = async (ffmpeg: FFmpeg, filename: string) => {
    try {
      await ffmpeg.deleteFile(filename);
    } catch {
      // File might not exist, ignore
    }
  };

  // Build drawtext filter for subtitles (replaces SRT-based subtitles filter)
  const buildDrawtextFilter = (scenes: Scene[]): string => {
    let currentTime = 0;
    const filters: string[] = [];
    
    for (let i = 0; i < scenes.length; i++) {
      const duration = scenes[i].audioDuration || 5;
      const startTime = currentTime;
      const endTime = currentTime + duration;
      const text = (scenes[i].script || '').trim().replace(/'/g, "\\'").replace(/:/g, "\\:");
      
      if (text) {
        // Shorts-style: bold, white text with black outline, centered at bottom
        filters.push(
          `drawtext=text='${text}':fontsize=28:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-120:enable='between(t,${startTime},${endTime})'`
        );
      }
      currentTime = endTime;
    }
    
    return filters.length > 0 ? filters.join(',') : '';
  };

  const generateVideo = useCallback(async (mainPrompt: string, script?: string) => {
    let ffmpeg: FFmpeg | null = null;
    
    try {
      setState({
        step: 'generating-prompts',
        progress: 0,
        currentScene: 0,
        totalScenes: SCENE_COUNT,
        scenes: [],
      });

      // Step 1: Generate scene prompts (reduced to SCENE_COUNT for memory)
      console.log('[Video] Generating prompts...');
      const scenePrompts = await puter.generateScenePrompts(mainPrompt, script);
      const limitedPrompts = scenePrompts.slice(0, SCENE_COUNT);
      const scriptChunks = puter.splitScript(script || '', SCENE_COUNT);
      
      const scenes: Scene[] = limitedPrompts.map((prompt, i) => ({
        id: i,
        prompt,
        script: scriptChunks[i] || '',
      }));

      setState(prev => ({
        ...prev,
        step: 'generating-images',
        progress: 10,
        scenes,
        totalScenes: scenes.length,
      }));

      // Step 2: Generate images
      console.log('[Video] Generating images...');
      for (let i = 0; i < scenes.length; i++) {
        try {
          const imageUrl = await puter.generateImage(scenes[i].prompt);
          scenes[i].imageUrl = imageUrl;
          
          setState(prev => ({
            ...prev,
            currentScene: i + 1,
            progress: 10 + (i + 1) * (40 / scenes.length),
            scenes: [...scenes],
          }));
        } catch (error) {
          console.error(`[Video] Image ${i} generation failed:`, error);
          throw new Error(`Görsel ${i + 1} oluşturulamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
        }
      }

      setState(prev => ({
        ...prev,
        step: 'generating-audio',
        progress: 50,
      }));

      // Step 3: Generate TTS audio for each scene and get durations
      console.log('[Video] Generating audio...');
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].script) {
          try {
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
          } catch (error) {
            console.error(`[Video] Audio ${i} generation failed:`, error);
            scenes[i].audioDuration = 5; // fallback on error
          }
        } else {
          scenes[i].audioDuration = 5; // default 5 seconds for scenes without script
        }
        
        setState(prev => ({
          ...prev,
          currentScene: i + 1,
          progress: 50 + (i + 1) * (20 / scenes.length),
          scenes: [...scenes],
        }));
      }

      setState(prev => ({
        ...prev,
        step: 'assembling-video',
        progress: 70,
      }));

      // Step 4: Assemble video with FFmpeg
      console.log('[Video] Loading FFmpeg...');
      ffmpeg = await loadFFmpeg();
      
      // Write images to FFmpeg virtual filesystem
      console.log('[Video] Writing images...');
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].imageUrl) {
          try {
            const response = await fetch(scenes[i].imageUrl!);
            const imageData = await response.arrayBuffer();
            await ffmpeg.writeFile(`image${i}.png`, new Uint8Array(imageData));
          } catch (error) {
            console.error(`[Video] Failed to write image ${i}:`, error);
            throw new Error(`Görsel ${i + 1} işlenemedi`);
          }
        }
      }

      // Write audio files and concatenate them
      console.log('[Video] Writing audio files...');
      const audioInputs: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        if (scenes[i].audioBlob) {
          try {
            const audioData = await scenes[i].audioBlob!.arrayBuffer();
            await ffmpeg.writeFile(`audio${i}.mp3`, new Uint8Array(audioData));
            audioInputs.push(`audio${i}.mp3`);
          } catch (error) {
            console.error(`[Video] Failed to write audio ${i}:`, error);
          }
        }
      }

      // Create audio concat file
      if (audioInputs.length > 0) {
        console.log('[Video] Concatenating audio...');
        const audioList = audioInputs.map(f => `file '${f}'`).join('\n');
        await ffmpeg.writeFile('audiolist.txt', audioList);
        await ffmpeg.exec([
          '-f', 'concat', '-safe', '0', '-i', 'audiolist.txt',
          '-c', 'copy', 'combined_audio.mp3'
        ]);
        
        // Clean up individual audio files
        for (const file of audioInputs) {
          await safeDeleteFile(ffmpeg, file);
        }
        await safeDeleteFile(ffmpeg, 'audiolist.txt');
      }

      setState(prev => ({ ...prev, progress: 75 }));

      // Create video segments with optimized settings
      console.log('[Video] Creating video segments...');
      const videoSegments: string[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const duration = scenes[i].audioDuration || 5;
        
        try {
          await ffmpeg.exec([
            '-loop', '1', 
            '-t', String(duration),
            '-i', `image${i}.png`,
            '-vf', `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease,pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
            '-c:v', 'libx264',
            '-preset', 'ultrafast', // Faster encoding
            '-pix_fmt', 'yuv420p',
            '-r', String(FRAME_RATE),
            `segment${i}.mp4`
          ]);
          videoSegments.push(`segment${i}.mp4`);
          
          // Clean up image after processing
          await safeDeleteFile(ffmpeg, `image${i}.png`);
          
          setState(prev => ({
            ...prev,
            progress: 75 + (i + 1) * (15 / scenes.length),
          }));
        } catch (error) {
          console.error(`[Video] Segment ${i} creation failed:`, error);
          throw new Error(`Video segmenti ${i + 1} oluşturulamadı`);
        }
      }

      // Create video concat file
      console.log('[Video] Concatenating video segments...');
      const videoList = videoSegments.map(f => `file '${f}'`).join('\n');
      await ffmpeg.writeFile('videolist.txt', videoList);
      await ffmpeg.exec([
        '-f', 'concat', '-safe', '0', '-i', 'videolist.txt',
        '-c', 'copy', 'video_only.mp4'
      ]);
      
      // Clean up segment files
      for (const file of videoSegments) {
        await safeDeleteFile(ffmpeg, file);
      }
      await safeDeleteFile(ffmpeg, 'videolist.txt');

      setState(prev => ({ ...prev, progress: 92 }));

      // Build drawtext filter for subtitles (browser-compatible, no font dependencies)
      console.log('[Video] Adding subtitles and finalizing...');
      const hasAudio = audioInputs.length > 0;
      const drawtextFilter = buildDrawtextFilter(scenes);
      
      try {
        if (hasAudio && drawtextFilter) {
          await ffmpeg.exec([
            '-i', 'video_only.mp4',
            '-i', 'combined_audio.mp3',
            '-vf', drawtextFilter,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-c:a', 'aac',
            '-shortest',
            '-pix_fmt', 'yuv420p',
            'output.mp4'
          ]);
        } else if (hasAudio) {
          await ffmpeg.exec([
            '-i', 'video_only.mp4',
            '-i', 'combined_audio.mp3',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-shortest',
            'output.mp4'
          ]);
        } else if (drawtextFilter) {
          await ffmpeg.exec([
            '-i', 'video_only.mp4',
            '-vf', drawtextFilter,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            'output.mp4'
          ]);
        } else {
          // Just copy the video if no audio and no subtitles
          await ffmpeg.exec([
            '-i', 'video_only.mp4',
            '-c', 'copy',
            'output.mp4'
          ]);
        }
      } catch (error) {
        console.error('[Video] Final assembly failed:', error);
        throw new Error('Video birleştirme başarısız oldu');
      }

      // Clean up intermediate files
      await safeDeleteFile(ffmpeg, 'video_only.mp4');
      await safeDeleteFile(ffmpeg, 'combined_audio.mp3');

      setState(prev => ({ ...prev, progress: 98 }));

      console.log('[Video] Reading output...');
      const data = await ffmpeg.readFile('output.mp4');
      const blobParts: BlobPart[] = typeof data === 'string' ? [data] : [new Uint8Array(data).buffer as ArrayBuffer];
      const videoBlob = new Blob(blobParts, { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(videoBlob);
      
      // Clean up output file
      await safeDeleteFile(ffmpeg, 'output.mp4');

      console.log('[Video] Complete!');
      setState(prev => ({
        ...prev,
        step: 'complete',
        progress: 100,
        videoUrl,
      }));

    } catch (error) {
      console.error('[Video] Generation failed:', error);
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu',
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
      totalScenes: SCENE_COUNT,
      scenes: [],
    });
  }, [state.videoUrl]);

  return {
    state,
    generateVideo,
    reset,
  };
}
