import { motion } from 'framer-motion';
import { Download, RefreshCw, Play, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GenerationState } from '@/hooks/useVideoGeneration';

interface VideoPreviewProps {
  state: GenerationState;
  onReset: () => void;
}

export function VideoPreview({ state, onReset }: VideoPreviewProps) {
  const handleDownload = () => {
    if (state.videoUrl) {
      const a = document.createElement('a');
      a.href = state.videoUrl;
      a.download = 'youtube-short.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto"
    >
      {/* Success Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-center gap-3 mb-8 p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
      >
        <CheckCircle className="w-6 h-6 text-green-400" />
        <span className="text-green-400 font-medium">Your YouTube Short is ready!</span>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Video Player */}
        <div className="gradient-border p-6 rounded-2xl">
          <div className="space-y-4">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              Preview
            </h3>
            
            <div className="aspect-[9/16] bg-black rounded-xl overflow-hidden relative mx-auto max-w-[280px]">
              {state.videoUrl ? (
                <video
                  src={state.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  poster={state.scenes[0]?.imageUrl}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No video available
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleDownload}
                variant="gradient"
                size="lg"
                className="flex-1"
                disabled={!state.videoUrl}
              >
                <Download className="w-5 h-5" />
                Download Video
              </Button>
              <Button
                onClick={onReset}
                variant="outline"
                size="lg"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Scene Storyboard */}
        <div className="gradient-border p-6 rounded-2xl">
          <div className="space-y-4">
            <h3 className="font-display text-lg font-semibold">Storyboard</h3>
            
            <div className="grid grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2">
              {state.scenes.map((scene, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="space-y-2"
                >
                  <div className="aspect-[9/16] rounded-lg overflow-hidden bg-secondary/50">
                    {scene.imageUrl ? (
                      <img
                        src={scene.imageUrl}
                        alt={`Scene ${i + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full shimmer" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-primary">Scene {i + 1}</p>
                    {scene.script && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        "{scene.script}"
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Another */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center"
      >
        <Button
          onClick={onReset}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Create Another Video
        </Button>
      </motion.div>
    </motion.div>
  );
}
