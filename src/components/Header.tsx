import { motion } from 'framer-motion';
import { Film, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="py-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="flex items-center justify-center gap-3"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary via-purple-500 to-accent flex items-center justify-center glow-primary">
              <Film className="w-6 h-6 text-white" />
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center"
            >
              <Zap className="w-3 h-3 text-white" />
            </motion.div>
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold">
            <span className="gradient-text">ShortsCraft</span>
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-muted-foreground max-w-md mx-auto"
        >
          Create stunning YouTube Shorts in seconds with AI-powered visuals and voiceover
        </motion.p>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {['12 Scenes', '1 Minute', '9:16 Vertical', 'AI Voiceover'].map((feature, i) => (
            <span
              key={feature}
              className="px-3 py-1 text-xs font-medium bg-secondary/80 text-muted-foreground rounded-full border border-border/50"
            >
              {feature}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </header>
  );
}
