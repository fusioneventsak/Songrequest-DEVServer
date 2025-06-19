import React, { useState, useEffect } from 'react';
import { LogIn, Loader2 } from 'lucide-react';

interface BackendLoginProps {
  onLogin: () => void;
}

export function BackendLogin({ onLogin }: BackendLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Clear any stale auth state on mount
  useEffect(() => {
    localStorage.removeItem('backendAuth');
    localStorage.removeItem('backendUser');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Check against both allowed users
      const validCredentials = [
        { email: 'info@fusion-events.ca', password: 'fusion3873' },
        { email: 'arthurk@fusion-events.ca', password: 'fusion3873' }
      ];

      const isValid = validCredentials.some(cred => 
        cred.email === email && cred.password === password
      );

      if (isValid) {
        // Set auth state and trigger callback
        localStorage.setItem('backendAuth', 'true');
        localStorage.setItem('backendUser', email);
        onLogin();
      } else {
        setError('Invalid email or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-darker-purple flex items-center justify-center p-4">
      <div className="glass-effect rounded-lg shadow-xl p-8 max-w-md w-full border border-neon-purple/20">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white neon-text mb-2">
            Band Request Hub
          </h1>
          <p className="text-gray-300">
            Please log in to access the backend
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="neon-button w-full flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Log In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}