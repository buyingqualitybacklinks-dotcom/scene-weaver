import { AnimatePresence, motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { PromptInput } from '@/components/PromptInput';
import { GenerationProgress } from '@/components/GenerationProgress';
import { VideoPreview } from '@/components/VideoPreview';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useVideoGeneration } from '@/hooks/useVideoGeneration';

const Index = () => {
  const { state, generateVideo, reset } = useVideoGeneration();

  const isGenerating = !['idle', 'complete', 'error'].includes(state.step);
  const isComplete = state.step === 'complete';
  const isError = state.step === 'error';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 container mx-auto px-4 py-6 md:py-12 min-h-screen flex flex-col">
        <Header />

        <main className="flex-1 flex items-center justify-center py-8">
          <AnimatePresence mode="wait">
            {state.step === 'idle' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <PromptInput
                  onGenerate={generateVideo}
                  isLoading={isGenerating}
                />
              </motion.div>
            )}

            {isGenerating && (
              <motion.div
                key="progress"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <GenerationProgress state={state} />
              </motion.div>
            )}

            {isComplete && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <VideoPreview state={state} onReset={reset} />
              </motion.div>
            )}

            {isError && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full"
              >
                <ErrorDisplay message={state.error || ''} onRetry={reset} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="text-primary">Puter.js</span> AI &amp; <span className="text-accent">FFmpeg</span>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
