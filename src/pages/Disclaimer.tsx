import { Footer } from '@/components/Footer';

const Disclaimer = () => (
  <div className="min-h-screen bg-background terminal-bg flex flex-col">
    <div className="container mx-auto px-4 py-12 max-w-3xl flex-1">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gradient-primary">Disclaimer</h1>
      <div className="prose prose-invert prose-sm max-w-none space-y-4 text-muted-foreground text-sm leading-relaxed">
        <p><strong>Last updated:</strong> February 2026</p>
        <h2 className="text-foreground text-lg font-bold">Risk Warning</h2>
        <p>Cryptocurrency trading carries a high level of risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you.</p>
        <h2 className="text-foreground text-lg font-bold">No Guarantees</h2>
        <p>Past performance of any trading system or methodology is not necessarily indicative of future results. AI predictions and signals are probabilistic and not guaranteed.</p>
        <h2 className="text-foreground text-lg font-bold">Educational Purpose</h2>
        <p>CryptoScanner PRO is designed for educational and research purposes. Always do your own research before making any investment decisions.</p>
      </div>
    </div>
    <Footer />
  </div>
);

export default Disclaimer;
