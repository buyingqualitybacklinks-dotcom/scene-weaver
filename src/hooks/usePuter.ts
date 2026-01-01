import { useCallback, useRef } from 'react';

declare global {
  interface Window {
    puter: {
      ai: {
        chat: (prompt: string, options?: { model?: string }) => Promise<{ message: { content: string } }>;
        txt2img: (prompt: string, options?: { width?: number; height?: number }) => Promise<{ src: () => string }>;
        txt2speech: (text: string, options?: { voice?: string }) => Promise<Blob>;
      };
    };
  }
}

export interface Scene {
  id: number;
  prompt: string;
  script: string;
  imageUrl?: string;
  audioBlob?: Blob;
}

export function usePuter() {
  const initialized = useRef(false);

  const ensurePuter = useCallback(async () => {
    if (typeof window.puter === 'undefined') {
      // Load Puter.js script dynamically
      if (!initialized.current) {
        const script = document.createElement('script');
        script.src = 'https://js.puter.com/v2/';
        script.async = true;
        document.head.appendChild(script);
        
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Puter.js'));
        });
        initialized.current = true;
      }
      
      // Wait for puter to be available
      await new Promise<void>((resolve) => {
        const check = () => {
          if (typeof window.puter !== 'undefined') {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }
  }, []);

  const generateScenePrompts = useCallback(async (mainPrompt: string, script?: string): Promise<string[]> => {
    await ensurePuter();
    
    const systemPrompt = `You are a visual director creating cinematic scene prompts for a 1-minute YouTube Shorts video (9:16 vertical format).

Given the main theme and optional script, generate exactly 12 distinct scene prompts.

Rules:
- Each prompt must be visually descriptive and cinematic
- Maintain consistent style/aesthetic across all 12 scenes
- Focus on visual elements: lighting, composition, mood, colors
- Each scene should be 5 seconds of content
- Make prompts suitable for AI image generation
- Include camera angle suggestions when relevant
- Ensure visual progression/narrative flow

Format: Return ONLY a JSON array of 12 strings, no other text.
Example: ["Scene 1 prompt...", "Scene 2 prompt...", ...]`;

    const userPrompt = script 
      ? `Main Theme: ${mainPrompt}\n\nScript/Narration:\n${script}\n\nGenerate 12 cinematic scene prompts that match this narrative.`
      : `Main Theme: ${mainPrompt}\n\nGenerate 12 cinematic scene prompts that tell a visual story around this theme.`;

    const response = await window.puter.ai.chat(`${systemPrompt}\n\n${userPrompt}`, { model: 'claude-3-5-sonnet' });
    
    try {
      const content = response.message.content;
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON array found');
    } catch {
      console.error('Failed to parse scene prompts, using fallback');
      return Array(12).fill(mainPrompt).map((p, i) => `Scene ${i + 1}: ${p}`);
    }
  }, [ensurePuter]);

  const generateImage = useCallback(async (prompt: string): Promise<string> => {
    await ensurePuter();
    
    const enhancedPrompt = `${prompt}, vertical 9:16 aspect ratio, cinematic lighting, high quality, professional photography`;
    const image = await window.puter.ai.txt2img(enhancedPrompt, { width: 576, height: 1024 });
    return image.src();
  }, [ensurePuter]);

  const generateSpeech = useCallback(async (text: string): Promise<Blob> => {
    await ensurePuter();
    return await window.puter.ai.txt2speech(text);
  }, [ensurePuter]);

  const splitScript = useCallback((script: string, sceneCount: number = 12): string[] => {
    if (!script.trim()) {
      return Array(sceneCount).fill('');
    }

    // Split by sentences
    const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
    const totalSentences = sentences.length;
    const scenesPerChunk = Math.ceil(totalSentences / sceneCount);
    
    const chunks: string[] = [];
    for (let i = 0; i < sceneCount; i++) {
      const start = i * scenesPerChunk;
      const end = Math.min(start + scenesPerChunk, totalSentences);
      chunks.push(sentences.slice(start, end).join(' ').trim() || '');
    }
    
    return chunks;
  }, []);

  return {
    ensurePuter,
    generateScenePrompts,
    generateImage,
    generateSpeech,
    splitScript,
  };
}
