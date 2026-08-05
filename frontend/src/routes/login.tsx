import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { 
  Lock, Mail, User as UserIcon, ShieldCheck, KeyRound, ArrowLeft, RefreshCw, 
  Eye, EyeOff, Sparkles, CheckCircle2, ArrowRight, ShieldAlert, Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Route = createFileRoute('/login')({
  component: Login,
});

type AuthMode = 'Login' | 'Sign Up' | 'Email Verify' | 'Forgot Password';

function Login() {
  const navigate = useNavigate();
  const { isLoggedin, userData, setUserData } = useAuth();

  const [mode, setMode] = useState<AuthMode>('Login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [otpArray, setOtpArray] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resetStep, setResetStep] = useState<1 | 2>(1);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto countdown for OTP resend
  useEffect(() => {
    let interval: any = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // If already logged in & email verified, redirect to homepage
  useEffect(() => {
    if (isLoggedin && userData) {
      if (userData.isAccountVerified !== false) {
        navigate({ to: '/' });
      } else {
        setMode('Email Verify');
        if (userData.email) setEmail(userData.email);
      }
    }
  }, [isLoggedin, userData, navigate]);

  // Handle individual OTP input box changes
  const handleOtpInput = (val: string, index: number) => {
    const cleanVal = val.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpArray];
    newOtp[index] = cleanVal;
    setOtpArray(newOtp);

    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim().slice(0, 6);
    if (/^\d+$/.test(pastedText)) {
      const digits = pastedText.split('');
      const newOtp = [...otpArray];
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtpArray(newOtp);
      otpInputRefs.current[Math.min(digits.length, 5)]?.focus();
    }
  };

  // One-click Auto-fill Admin credentials for quick testing
  const handleFillAdmin = () => {
    setMode('Login');
    setEmail('admin@tarv.ai');
    setPassword('admin@tarv.ai');
    toast.info('Admin credentials auto-filled!');
  };

  // Submit Handler for Login & Sign Up
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'Sign Up') {
        if (!name || !email || !password) {
          toast.error('Please fill in your name, email address, and password.');
          setLoading(false);
          return;
        }

        const res = await authService.register(name, email, password);
        if (res.success) {
          if (res.userData) {
            setUserData(res.userData);
          }
          toast.success(res.message || 'Account created! Verification OTP sent to your email.');
          setMode('Email Verify');
          setResendTimer(30);
        } else {
          toast.error(res.message || 'Registration failed');
        }
      } else if (mode === 'Login') {
        if (!email || !password) {
          toast.error('Please enter your email and password.');
          setLoading(false);
          return;
        }

        const res = await authService.login(email, password);
        if (res.success) {
          if (res.userData) {
            setUserData(res.userData);
          }
          toast.success(res.message || 'Logged in successfully');
          navigate({ to: '/' });
        } else {
          toast.error(res.message || 'Login failed');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during request processing.');
    } finally {
      setLoading(false);
    }
  };

  // Confirm Email OTP Handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpArray.join('');
    if (otpCode.length < 6) {
      toast.error('Please enter the full 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.verifyAccount(otpCode, email);
      if (res.success) {
        toast.success(res.message || 'Email verified successfully!');
        if (res.userData) {
          setUserData(res.userData);
        } else if (userData) {
          setUserData({ ...userData, isAccountVerified: true });
        }
        navigate({ to: '/' });
      } else {
        toast.error(res.message || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Verification error');
    } finally {
      setLoading(false);
    }
  };

  // Resend Verification OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setResending(true);
    try {
      const res = await authService.sendVerifyOtp(email);
      if (res.success) {
        toast.success(res.message || 'Verification OTP sent to your email.');
        setResendTimer(45);
      } else {
        toast.error(res.message || 'Failed to resend OTP.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Resend failed');
    } finally {
      setResending(false);
    }
  };

  // Forgot / Reset Password Handler
  const handleForgotOrReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (resetStep === 1) {
        if (!email) {
          toast.error('Please enter your email address.');
          setLoading(false);
          return;
        }
        const res = await authService.sendResetOtp(email);
        if (res.success) {
          toast.success(res.message || 'Reset OTP sent to your email.');
          setResetStep(2);
        } else {
          toast.error(res.message || 'Error sending reset code');
        }
      } else {
        const otpCode = otpArray.join('');
        if (otpCode.length < 6 || !newPassword) {
          toast.error('Please enter the 6-digit OTP and your new password.');
          setLoading(false);
          return;
        }
        const res = await authService.resetPassword(email, otpCode, newPassword);
        if (res.success) {
          toast.success(res.message || 'Password reset successfully! Please login.');
          setMode('Login');
          setResetStep(1);
          setPassword('');
        } else {
          toast.error(res.message || 'Password reset failed');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error processing request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans text-slate-100 selection:bg-sky-500 selection:text-white">
      {/* Background Animated Glowing Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-sky-600/20 to-blue-600/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-tr from-indigo-600/20 to-purple-600/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-500/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Header Branding */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-4 shadow-inner">
          <Cpu className="w-3.5 h-3.5 text-sky-400 animate-spin-slow" />
          <span>Universal MEP Engineering Suite</span>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          MEP Calculator
        </h1>
        <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
          High-performance HVAC, Electrical & Plumbing calculation platform
        </p>
      </motion.div>

      {/* Main Glassmorphic Auth Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full sm:max-w-md z-10"
      >
        <div className="bg-slate-900/80 backdrop-blur-2xl py-8 px-6 sm:px-10 shadow-[0_20px_50px_rgba(2,132,199,0.15)] rounded-3xl border border-slate-800/80 relative overflow-hidden">
          
          {/* Subtle top card accent highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />

          {/* Mode Switcher Tabs for Login vs Sign Up */}
          {(mode === 'Login' || mode === 'Sign Up') && (
            <div className="grid grid-cols-2 p-1.5 mb-8 rounded-2xl bg-slate-950/80 border border-slate-800/80 relative">
              <button
                type="button"
                onClick={() => setMode('Login')}
                className={`py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 z-10 ${
                  mode === 'Login'
                    ? 'text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('Sign Up')}
                className={`py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 z-10 ${
                  mode === 'Sign Up'
                    ? 'text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-md shadow-sky-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Quick Demo / Admin Auto-Fill Banner */}
          {mode === 'Login' && (
            <div className="mb-6 p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-slate-300 font-medium">Quick Admin Login:</span>
              </div>
              <button
                type="button"
                onClick={handleFillAdmin}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 transition-all cursor-pointer"
              >
                Auto-fill Admin
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* LOGIN & SIGN UP FORM */}
            {(mode === 'Login' || mode === 'Sign Up') && (
              <motion.form 
                key={mode}
                initial={{ opacity: 0, x: mode === 'Sign Up' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'Sign Up' ? -20 : 20 }}
                transition={{ duration: 0.25 }}
                className="space-y-5" 
                onSubmit={handleSubmit}
              >
                {mode === 'Sign Up' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Full Name / User Name
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <UserIcon className="h-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full pl-10 pr-4 py-3 bg-slate-950/90 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 text-sm placeholder-slate-500 transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Email Address / Login ID
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-slate-950/90 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 text-sm placeholder-slate-500 transition-all"
                      placeholder="user@example.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Password
                    </label>
                    {mode === 'Login' && (
                      <button
                        type="button"
                        onClick={() => { setMode('Forgot Password'); setResetStep(1); }}
                        className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 bg-slate-950/90 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 text-sm placeholder-slate-500 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'Login' ? 'Sign In to Dashboard' : 'Create Free Account'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Subtext info */}
                <div className="text-center pt-2">
                  <p className="text-xs text-slate-400">
                    {mode === 'Login' ? (
                      <>Don't have an account? <button type="button" onClick={() => setMode('Sign Up')} className="font-semibold text-sky-400 hover:underline">Sign up option</button></>
                    ) : (
                      <>Already registered? <button type="button" onClick={() => setMode('Login')} className="font-semibold text-sky-400 hover:underline">Login here</button></>
                    )}
                  </p>
                </div>
              </motion.form>
            )}

            {/* EMAIL VERIFICATION (OTP TAB) */}
            {mode === 'Email Verify' && (
              <motion.form 
                key="Email Verify"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 text-center" 
                onSubmit={handleVerifyOtp}
              >
                <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shadow-inner">
                  <ShieldCheck className="w-7 h-7" />
                </div>

                <div>
                  <h4 className="text-xl font-bold text-white mb-1">Verify Email Address</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Enter the 6-digit OTP code sent to <strong className="text-sky-400">{email || 'your email'}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    6-Digit Verification Code
                  </label>
                  <div className="flex justify-between gap-2 max-w-xs mx-auto">
                    {Array(6).fill(0).map((_, index) => (
                      <input
                        key={index}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        ref={(el) => { otpInputRefs.current[index] = el; }}
                        value={otpArray[index] || ''}
                        onChange={(e) => handleOtpInput(e.target.value, index)}
                        onKeyDown={(e) => handleOtpKeyDown(e, index)}
                        onPaste={index === 0 ? handleOtpPaste : undefined}
                        className="w-11 h-14 text-center text-2xl font-black bg-slate-950 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-inner transition-all"
                        required
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpArray.join('').length < 6}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/25 transition-all active:scale-[0.99] disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Confirming OTP...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm OTP & Login</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-2 text-slate-400 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setMode('Login')}
                    className="inline-flex items-center text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Login
                  </button>

                  <button
                    type="button"
                    disabled={resending || resendTimer > 0}
                    onClick={handleResendOtp}
                    className="inline-flex items-center text-sky-400 hover:text-sky-300 font-semibold disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${resending ? 'animate-spin' : ''}`} />
                    {resending ? 'Resending...' : (resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP')}
                  </button>
                </div>
              </motion.form>
            )}

            {/* FORGOT / RESET PASSWORD */}
            {mode === 'Forgot Password' && (
              <motion.form 
                key="Forgot Password"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-5" 
                onSubmit={handleForgotOrReset}
              >
                <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-inner">
                  <KeyRound className="w-7 h-7" />
                </div>

                <div className="text-center">
                  <h4 className="text-xl font-bold text-white mb-1">
                    {resetStep === 1 ? 'Reset Your Password' : 'Enter OTP & New Password'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    {resetStep === 1 ? 'Enter your registered email to receive a password reset OTP code' : 'Check your email for the OTP and set your new password'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Registered Email Address
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      disabled={resetStep === 2}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-slate-950/90 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder-slate-500 disabled:opacity-60 transition-all"
                      placeholder="user@example.com"
                    />
                  </div>
                </div>

                {resetStep === 2 && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">
                        6-Digit Reset OTP Code
                      </label>
                      <div className="flex justify-between gap-2 max-w-xs mx-auto mb-4">
                        {Array(6).fill(0).map((_, index) => (
                          <input
                            key={index}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            ref={(el) => { otpInputRefs.current[index] = el; }}
                            value={otpArray[index] || ''}
                            onChange={(e) => handleOtpInput(e.target.value, index)}
                            onKeyDown={(e) => handleOtpKeyDown(e, index)}
                            onPaste={index === 0 ? handleOtpPaste : undefined}
                            className="w-11 h-13 text-center text-xl font-black bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-sky-500 text-sm"
                            required
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                        New Password
                      </label>
                      <div className="relative rounded-xl shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="h-4 h-4" />
                        </div>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="block w-full pl-10 pr-10 py-3 bg-slate-950/90 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm placeholder-slate-500"
                          placeholder="New password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? 'Processing...' : (resetStep === 1 ? 'Send Reset OTP Code' : 'Save New Password & Login')}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode('Login'); setResetStep(1); }}
                    className="inline-flex items-center text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Login
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </div>
  );
}
