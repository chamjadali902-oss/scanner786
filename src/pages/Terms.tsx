import { Footer } from '@/components/Footer';

const Terms = () => (
  <div className="min-h-screen bg-background terminal-bg flex flex-col">
    <div className="container mx-auto px-4 py-12 max-w-3xl flex-1">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gradient-primary">Terms & Conditions</h1>
      <div className="prose prose-invert prose-sm max-w-none space-y-4 text-muted-foreground text-sm leading-relaxed">
        <p><strong>Last updated:</strong> February 2026</p>
        <h2 className="text-foreground text-lg font-bold">1. Acceptance of Terms</h2>
        <p>By using CryptoScanner PRO, you agree to these terms and conditions. If you do not agree, please do not use the service.</p>
        <h2 className="text-foreground text-lg font-bold">2. Service Description</h2>
        <p>CryptoScanner PRO provides cryptocurrency market scanning, AI-powered analysis, and trading tools for educational and informational purposes.</p>
        <h2 className="text-foreground text-lg font-bold">3. No Financial Advice</h2>
        <p>All information provided is for educational purposes only and should not be considered financial advice. Trading cryptocurrency involves significant risk.</p>
        <h2 className="text-foreground text-lg font-bold">4. User Responsibilities</h2>
        <p>You are responsible for your trading decisions. We are not liable for any losses incurred from using our analysis or signals.</p>
        <h2 className="text-foreground text-lg font-bold">5. Account Security</h2>
        <p>You are responsible for maintaining the security of your account credentials.</p>
      </div>
    </div>
    <Footer />
  </div>
);

export default Terms;
