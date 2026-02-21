import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LineChart, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { setAdminAccessSession } from '@/hooks/useAdmin';
import { isPrimaryAdminCredential, isPrimaryAdminEmail } from '@/lib/adminAccess';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password, username);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (isPrimaryAdminCredential(email, password)) {
      setAdminAccessSession(true);
      toast({ title: 'Welcome Admin!' });
      navigate('/admin');
      setLoading(false);
      return;
    }

    if (isPrimaryAdminEmail(email)) {
      setAdminAccessSession(false);
      toast({
        title: 'Access denied',
        description: 'Admin panel sirf configured admin password se open hota hai.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setAdminAccessSession(false);
    toast({ title: isLogin ? 'Welcome back!' : 'Account created!' });
    navigate('/');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background terminal-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <LineChart className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">
            <span className="text-gradient-primary">CryptoScanner</span>
            <span className="text-primary ml-1">Pro</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card card-glow">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-10"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Scanner
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
