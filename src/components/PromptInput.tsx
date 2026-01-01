import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, FileText, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface PromptInputProps {
  onGenerate: (prompt: string, script?: string) => void;
  isLoading: boolean;
}

export function PromptInput({ onGenerate, isLoading }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [script, setScript] = useState('');
  const [showScript, setShowScript] = useState(false);

  const handleSubmit = () => {
    if (prompt.trim()) {
      onGenerate(prompt.trim(), script.trim() || undefined);
    }
  };

  const examplePrompts = [
    "A journey through the cosmos exploring nebulae and distant galaxies",
    "The rise and fall of ancient civilizations told through dramatic visuals",
    "A day in the life of wildlife in the African savanna",
    "The art of Japanese zen gardens and meditation",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="gradient-border p-8 rounded-2xl">
        <div className="space-y-6">
          {/* Main Prompt */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground/80">
              <Sparkles className="w-4 h-4 text-primary" />
              Video Concept
            </label>
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your video concept... e.g., 'An epic journey through the history of space exploration'"
                className="min-h-[120px] bg-background/50 border-border/50 focus:border-primary/50 resize-none text-base placeholder:text-muted-foreground/50"
                disabled={isLoading}
              />
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
                {prompt.length} chars
              </div>
            </div>
          </div>

          {/* Optional Script Toggle */}
          <button
            onClick={() => setShowScript(!showScript)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="w-4 h-4" />
            Add custom script (optional)
            {showScript ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Script Input */}
          <motion.div
            initial={false}
            animate={{ 
              height: showScript ? 'auto' : 0,
              opacity: showScript ? 1 : 0 
            }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">
              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Enter your narration script here. It will be split into 12 scenes and converted to voiceover..."
                className="min-h-[150px] bg-background/50 border-border/50 focus:border-primary/50 resize-none text-base placeholder:text-muted-foreground/50"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Tip: Write about 150-200 words for a 1-minute video. The script will be automatically divided into 12 scenes.
              </p>
            </div>
          </motion.div>

          {/* Generate Button */}
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading}
            variant="gradient"
            size="xl"
            className="w-full"
          >
            <Wand2 className="w-5 h-5" />
            {isLoading ? 'Generating...' : 'Create YouTube Short'}
          </Button>
        </div>
      </div>

      {/* Example Prompts */}
      <div className="mt-8 space-y-3">
        <p className="text-sm text-muted-foreground text-center">
          Need inspiration? Try one of these:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {examplePrompts.map((example, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setPrompt(example)}
              disabled={isLoading}
              className="p-4 text-left text-sm bg-secondary/50 hover:bg-secondary rounded-xl border border-border/50 hover:border-primary/30 transition-all disabled:opacity-50"
            >
              {example}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
