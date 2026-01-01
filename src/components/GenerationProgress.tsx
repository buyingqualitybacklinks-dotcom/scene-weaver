import { motion } from 'framer-motion';
import { Check, Loader2, Image, Volume2, Film, Sparkles } from 'lucide-react';
import { GenerationState, GenerationStep } from '@/hooks/useVideoGeneration';
import { Progress } from '@/components/ui/progress';

interface GenerationProgressProps {
  state: GenerationState;
}

const steps: { key: GenerationStep; label: string; icon: React.ReactNode }[] = [
  { key: 'generating-prompts', label: 'Creating Scene Prompts', icon: <Sparkles className="w-5 h-5" /> },
  { key: 'generating-images', label: 'Generating Images', icon: <Image className="w-5 h-5" /> },
  { key: 'generating-audio', label: 'Creating Voiceover', icon: <Volume2 className="w-5 h-5" /> },
  { key: 'assembling-video', label: 'Assembling Video', icon: <Film className="w-5 h-5" /> },
];

function getStepStatus(currentStep: GenerationStep, targetStep: GenerationStep): 'pending' | 'active' | 'complete' {
  const stepOrder = ['idle', 'generating-prompts', 'generating-images', 'generating-audio', 'assembling-video', 'complete'];
  const currentIndex = stepOrder.indexOf(currentStep);
  const targetIndex = stepOrder.indexOf(targetStep);
  
  if (currentIndex > targetIndex) return 'complete';
  if (currentIndex === targetIndex) return 'active';
  return 'pending';
}

export function GenerationProgress({ state }: GenerationProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="gradient-border p-8 rounded-2xl">
        <div className="space-y-8">
          {/* Overall Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-display text-lg font-semibold">Creating Your Video</h3>
              <span className="text-2xl font-bold gradient-text">{Math.round(state.progress)}%</span>
            </div>
            <Progress value={state.progress} className="h-3" />
          </div>

          {/* Step Indicators */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const status = getStepStatus(state.step, step.key);
              
              return (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    status === 'active' 
                      ? 'bg-primary/10 border border-primary/30' 
                      : status === 'complete'
                      ? 'bg-secondary/50'
                      : 'bg-secondary/20'
                  }`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    status === 'active'
                      ? 'bg-primary text-primary-foreground animate-pulse-glow'
                      : status === 'complete'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-secondary text-muted-foreground'
                  }`}>
                    {status === 'complete' ? (
                      <Check className="w-5 h-5" />
                    ) : status === 'active' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <p className={`font-medium ${
                      status === 'active' ? 'text-foreground' : 
                      status === 'complete' ? 'text-muted-foreground' : 
                      'text-muted-foreground/50'
                    }`}>
                      {step.label}
                    </p>
                    {status === 'active' && step.key === 'generating-images' && (
                      <p className="text-sm text-primary">
                        Scene {state.currentScene} of {state.totalScenes}
                      </p>
                    )}
                    {status === 'active' && step.key === 'generating-audio' && (
                      <p className="text-sm text-primary">
                        Processing audio {state.currentScene} of {state.totalScenes}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Scene Preview Grid */}
          {state.scenes.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Scene Previews</h4>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {state.scenes.map((scene, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="aspect-[9/16] rounded-lg overflow-hidden bg-secondary/50 relative"
                  >
                    {scene.imageUrl ? (
                      <img
                        src={scene.imageUrl}
                        alt={`Scene ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full shimmer flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">{i + 1}</span>
                      </div>
                    )}
                    {scene.audioBlob && (
                      <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <Volume2 className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
