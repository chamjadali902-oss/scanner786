import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  LineChart, Brain, Sparkles, Shield, BarChart3, Beaker,
  Globe, BookOpen, ArrowRight, Zap, Target, TrendingUp,
  Activity, ChevronRight
} from 'lucide-react';
import { Footer } from '@/components/Footer';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const }
  }),
};

const features = [
  {
    icon: LineChart,
    title: 'Smart Scanner',
    desc: 'Scan 200+ crypto pairs across multiple timeframes with RSI, MACD, EMA, Bollinger, SMC, and more.',
    color: 'from-primary to-accent',
  },
  {
    icon: Brain,
    title: 'AI Trade Analysis',
    desc: 'AI analyzes your open trades across all timeframes, detects traps, and predicts price ranges.',
    color: 'from-[hsl(270,70%,60%)] to-primary',
  },
  {
    icon: Sparkles,
    title: 'Smart Signals',
    desc: 'AI-powered signals that combine multiple indicators for high-probability entries.',
    color: 'from-[hsl(var(--bullish))] to-primary',
  },
  {
    icon: Shield,
    title: 'SMC & Price Action',
    desc: 'Order blocks, fair value gaps, break of structure, volume spike detection — all built-in.',
    color: 'from-[hsl(var(--warning))] to-[hsl(var(--bearish))]',
  },
  {
    icon: Beaker,
    title: 'Backtesting Engine',
    desc: 'Test your strategies against historical data before risking real capital.',
    color: 'from-primary to-[hsl(270,70%,60%)]',
  },
  {
    icon: Globe,
    title: 'Strategy Marketplace',
    desc: 'Share your winning strategies or discover community-built ones.',
    color: 'from-[hsl(var(--bullish))] to-[hsl(var(--warning))]',
  },
];

const stats = [
  { value: '200+', label: 'Crypto Pairs' },
  { value: '7', label: 'Timeframes' },
  { value: '15+', label: 'Indicators' },
  { value: 'Real-time', label: 'Data Feed' },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background terminal-bg flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 grid-lines opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

        <div className="relative container mx-auto px-4 pt-20 sm:pt-28 pb-16 sm:pb-24 text-center">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 glow-primary"
          >
            <LineChart className="w-8 h-8 sm:w-10 sm:h-10 text-primary-foreground" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4"
          >
            <span className="text-gradient-primary">CryptoScanner</span>
            <span className="text-primary ml-2 text-lg sm:text-2xl font-bold align-super">PRO</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
          >
            Real-time market intelligence powered by AI. Scan, analyze, and trade with confidence across all timeframes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button size="lg" className="text-base h-12 px-8 gap-2 scanner-pulse" onClick={() => navigate('/scanner')}>
              <Zap className="w-5 h-5" /> Start Scanning <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base h-12 px-8 gap-2" onClick={() => navigate('/auth')}>
              Create Free Account
            </Button>
          </motion.div>

          {/* Live indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <div className="w-2 h-2 rounded-full bg-bullish animate-pulse" />
            <Activity className="w-3.5 h-3.5 text-bullish" />
            <span>Live market data from Binance</span>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card/30">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="text-center"
              >
                <p className="text-2xl sm:text-3xl font-extrabold text-gradient-primary font-mono">{stat.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16 sm:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-3">
            Everything You Need to <span className="text-gradient-primary">Trade Smart</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Professional-grade tools, AI-powered analysis, and real-time data — all in one platform.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="group relative rounded-xl border border-border bg-card p-5 sm:p-6 card-glow hover:border-primary/30 transition-all duration-500"
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                <f.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-base sm:text-lg font-bold mb-2 text-foreground">{f.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              <ChevronRight className="absolute top-5 right-5 w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-muted/30 p-8 sm:p-12 text-center card-glow"
        >
          <Target className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-xl sm:text-3xl font-extrabold mb-3">
            Stop Guessing. Start <span className="text-gradient-primary">Scanning.</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-6">
            Join traders who use AI-powered multi-timeframe analysis to avoid traps and find high-probability setups.
          </p>
          <Button size="lg" className="h-12 px-8 text-base gap-2" onClick={() => navigate('/scanner')}>
            <TrendingUp className="w-5 h-5" /> Launch Scanner
          </Button>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
