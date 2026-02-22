import { Link } from 'react-router-dom';
import { LineChart } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Scanner', to: '/scanner' },
    { label: 'Smart Signals', to: '/signals' },
    { label: 'AI Chat', to: '/chat' },
    { label: 'Backtest', to: '/backtest' },
    { label: 'Marketplace', to: '/marketplace' },
  ],
  Resources: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Trade Journal', to: '/journal' },
  ],
  Legal: [
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Terms & Conditions', to: '/terms' },
    { label: 'Disclaimer', to: '/disclaimer' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 mt-auto">
      <div className="container mx-auto px-4 py-10 sm:py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <LineChart className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-extrabold text-gradient-primary">CryptoScanner PRO</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time crypto market intelligence powered by AI and advanced technical analysis.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">{title}</h4>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[10px] text-muted-foreground">
            © {new Date().getFullYear()} CryptoScanner PRO. All rights reserved.
          </p>
          <p className="text-[10px] text-muted-foreground text-center">
            Market data by Binance. For educational purposes only. Not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
