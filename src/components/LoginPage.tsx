import { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';
import '../styles/Login.css';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const { isAdmin, user, error: authError, loginAdmin } = useFirebaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    setError('');
    setHasSubmitted(false);
  }, []);

  // Auto-navigate when auth state changes
  if ((isAdmin || user) && !isLoading) {
    setTimeout(() => onLogin(), 100);
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHasSubmitted(true);
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      setIsLoading(true);
      await loginAdmin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };


  // (signup removed - default admin is created automatically)

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Admin Access</h1>
          <p className="login-subtitle">Lordnine Guild Management</p>
        </div>

        <div className="login-content">
          <div className="login-section admin-section">
            <h2>Guild Admin Access</h2>
            <p className="section-description">Full access to edit and manage guild data</p>

            <form onSubmit={handleSignIn} className="auth-form">
                <div className="form-group">
                  <label htmlFor="signin-email">Email</label>
                  <input
                    id="signin-email"
                    type="email"
                    className={`auth-input ${error ? 'error' : ''}`}
                    placeholder="admin@lordnineguild.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="signin-password">Password</label>
                  <div className="input-wrapper">
                    <input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      className={`auth-input ${error ? 'error' : ''}`}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="show-toggle"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff size={18} strokeWidth={1.8} />
                      ) : (
                        <Eye size={18} strokeWidth={1.8} />
                      )}
                    </button>
                  </div>
                </div>

                {(error || (hasSubmitted && authError)) && (
                  <p className="error-message">{error || authError}</p>
                )}

                <button 
                  type="submit"
                  className="login-btn admin-btn"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
                {/* default admin button removed */}
              </form>
          </div>
        </div>

        <div className="login-footer">
          <p className="footer-text">
            <Lock size={14} strokeWidth={1.8} /> Passwords are securely encrypted and stored by Firebase
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
