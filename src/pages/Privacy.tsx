import { AppLayout } from '@/components/AppLayout';
import { Footer } from '@/components/Footer';

const Privacy = () => (
  <div className="min-h-screen bg-background terminal-bg flex flex-col">
    <div className="container mx-auto px-4 py-12 max-w-3xl flex-1">
      <h1 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gradient-primary">Privacy Policy</h1>
      <div className="prose prose-invert prose-sm max-w-none space-y-4 text-muted-foreground text-sm leading-relaxed">
        <p><strong>Last updated:</strong> February 2026</p>
        <h2 className="text-foreground text-lg font-bold">1. Information We Collect</h2>
        <p>We collect information you provide directly: email address, trading data you input, and saved strategies. We also collect usage data such as pages visited and features used.</p>
        <h2 className="text-foreground text-lg font-bold">2. How We Use Your Information</h2>
        <p>Your data is used to provide and improve our services, including AI-powered analysis, scanner functionality, and personalized trading insights.</p>
        <h2 className="text-foreground text-lg font-bold">3. Data Security</h2>
        <p>We implement industry-standard security measures including encryption and secure authentication to protect your data.</p>
        <h2 className="text-foreground text-lg font-bold">4. Third-Party Services</h2>
        <p>We use Binance API for market data. We do not sell your personal information to third parties.</p>
        <h2 className="text-foreground text-lg font-bold">5. Contact</h2>
        <p>For privacy-related inquiries, please contact us through the application.</p>
      </div>
    </div>
    <Footer />
  </div>
);

export default Privacy;
