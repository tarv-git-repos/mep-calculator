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
import { useConfirm } from '@/hooks/use-confirm';

export const Route = createFileRoute('/login')({
  component: Login,
});

type AuthMode = 'Login' | 'Sign Up' | 'Email Verify' | 'Forgot Password';

function Login() {
  const navigate = useNavigate();
  const { isLoggedin, userData, setUserData } = useAuth();
  const confirm = useConfirm();

  const [mode, setMode] = useState<AuthMode>('Login');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!val) {
      setNameError(null);
      return;
    }
    const nameRegex = /^[a-zA-Z\s'\-]+$/;
    if (!nameRegex.test(val.trim())) {
      setNameError('Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).');
    } else if (val.trim().length < 2) {
      setNameError('Full Name must be at least 2 characters long.');
    } else {
      setNameError(null);
    }
  };

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

  const getPasswordErrors = (pass: string) => {
    const errors = [];
    if (!pass) return errors;
    if (pass.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(pass)) errors.push("1 uppercase letter");
    if (!/[a-z]/.test(pass)) errors.push("1 lowercase letter");
    if (!/[0-9]/.test(pass)) errors.push("1 number");
    if (!/[!@#$%^&*(),.?":{}|<>\-_+=\[\]\\\/~`]/.test(pass)) errors.push("1 special character");
    return errors;
  };

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
    const raw = e.clipboardData.getData('text').trim();
    const digits = raw.replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length > 0) {
      const newOtp = ['', '', '', '', '', ''];
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtpArray(newOtp);
      otpInputRefs.current[Math.min(digits.length - 1, 5)]?.focus();
    }
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

        const nameRegex = /^[a-zA-Z\s'\-]+$/;
        if (!nameRegex.test(name.trim())) {
          toast.error('Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).');
          setLoading(false);
          return;
        }

        if (name.trim().length < 2) {
          toast.error('Full Name must be at least 2 characters long.');
          setLoading(false);
          return;
        }

        const pwdErrors = getPasswordErrors(password);
        if (pwdErrors.length > 0) {
          toast.error('Please ensure your password meets all requirements.');
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

        let res = await authService.login(email, password);
        
        if (res.requireForceLogout) {
          const confirmForce = await confirm(
            res.message + "\n\nDo you want to log out the other device and log in here?",
            { title: "Multiple Sessions Detected", confirmText: "Yes, Log In Here", cancelText: "Cancel" }
          );
          if (confirmForce) {
            res = await authService.login(email, password, true);
          } else {
            setLoading(false);
            return;
          }
        }

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
        clearAllAuthStorage();
        toast.success('Email verified successfully! Please log in with your email and password.');
        setMode('Login');
        setOtpArray(Array(6).fill(''));
        setPassword('');
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
          setOtpArray(['', '', '', '', '', '']);
          setNewPassword('');
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

        const pwdErrors = getPasswordErrors(newPassword);
        if (pwdErrors.length > 0) {
          toast.error('Please ensure your new password meets all requirements.');
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans text-slate-800 dark:text-slate-100 selection:bg-blue-600 selection:text-white transition-colors duration-300">
      {/* Soft Ambient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-slate-200/60 dark:bg-indigo-900/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Branding */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-4 shadow-xs">
          <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin-slow" />
          <span>Universal MEP Engineering Suite</span>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-2">
          MEP Calculator
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">
          High-performance HVAC, Electrical & Plumbing calculation platform
        </p>
      </motion.div>

      {/* Main Crisp Auth Card (Light/Dark Auto) */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full sm:max-w-md z-10"
      >
        <div className="bg-white dark:bg-slate-900/90 py-8 px-6 sm:px-10 shadow-xl dark:shadow-[0_20px_50px_rgba(2,132,199,0.15)] shadow-slate-200/60 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 relative overflow-hidden transition-all">
          
          {/* Mode Switcher Tabs for Login vs Sign Up */}
          {(mode === 'Login' || mode === 'Sign Up') && (
            <div className="grid grid-cols-2 p-1 mb-8 rounded-2xl bg-slate-100/90 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 relative">
              <button
                type="button"
                onClick={() => setMode('Login')}
                className={`py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 z-10 cursor-pointer ${
                  mode === 'Login'
                    ? 'text-white bg-blue-600 dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600 shadow-md shadow-blue-600/25 dark:shadow-sky-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('Sign Up')}
                className={`py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 z-10 cursor-pointer ${
                  mode === 'Sign Up'
                    ? 'text-white bg-blue-600 dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600 shadow-md shadow-blue-600/25 dark:shadow-sky-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* LOGIN & SIGN UP FORM */}
            {(mode === 'Login' || mode === 'Sign Up') && (
              <motion.form 
                key={mode}
                initial={{ opacity: 0, x: mode === 'Sign Up' ? 15 : -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'Sign Up' ? -15 : 15 }}
                transition={{ duration: 0.2 }}
                className="space-y-5" 
                onSubmit={handleSubmit}
              >
                {mode === 'Sign Up' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Full Name / User Name
                    </label>
                    <div className="relative rounded-xl shadow-xs">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <UserIcon className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className={`block w-full pl-10 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/90 border text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 transition-all font-medium ${
                          nameError 
                            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                            : 'border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500'
                        }`}
                        placeholder="John Doe"
                      />
                    </div>
                    {nameError && (
                      <p className="text-red-500 dark:text-red-400 text-xs font-semibold mt-1.5 flex items-center gap-1">
                        <span className="size-1 rounded-full bg-red-500 dark:bg-red-400"></span>
                        {nameError}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address / Login ID
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 transition-all font-medium"
                      placeholder="user@example.com"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    {mode === 'Login' && (
                      <button
                        type="button"
                        onClick={() => { setMode('Forgot Password'); setResetStep(1); }}
                        className="text-xs font-semibold text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 transition-all font-medium"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {mode === 'Sign Up' && password.length > 0 && getPasswordErrors(password).length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Missing requirements:
                      </p>
                      <ul className="text-[11px] text-amber-600/90 dark:text-amber-400/80 list-disc pl-4 space-y-0.5 font-medium">
                        {getPasswordErrors(password).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-gradient-to-r dark:from-sky-500 dark:via-blue-600 dark:to-indigo-600 dark:hover:from-sky-400 dark:hover:to-indigo-500 shadow-md shadow-blue-600/20 dark:shadow-sky-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {mode === 'Login' ? (
                      <>Don't have an account? <button type="button" onClick={() => setMode('Sign Up')} className="font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer">Sign up option</button></>
                    ) : (
                      <>Already registered? <button type="button" onClick={() => setMode('Login')} className="font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer">Login here</button></>
                    )}
                  </p>
                </div>
              </motion.form>
            )}

            {/* EMAIL VERIFICATION (OTP TAB) */}
            {mode === 'Email Verify' && (
              <motion.form 
                key="Email Verify"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 text-center" 
                onSubmit={handleVerifyOtp}
              >
                <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/30 text-blue-600 dark:text-sky-400 shadow-xs">
                  <ShieldCheck className="w-7 h-7" />
                </div>

                <div>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Verify Email Address</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                    Enter the 6-digit OTP code sent to <strong className="text-blue-600 dark:text-sky-400">{email || 'your email'}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
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
                        onPaste={handleOtpPaste}
                        className="w-11 h-14 text-center text-2xl font-black bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 shadow-xs transition-all"
                        required
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpArray.join('').length < 6}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600 dark:hover:from-sky-400 dark:hover:to-blue-500 shadow-md shadow-blue-600/20 dark:shadow-sky-500/25 transition-all active:scale-[0.99] disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer"
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

                <div className="flex items-center justify-between text-xs pt-2 text-slate-500 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setMode('Login')}
                    className="inline-flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Login
                  </button>

                  <button
                    type="button"
                    disabled={resending || resendTimer > 0}
                    onClick={handleResendOtp}
                    className="inline-flex items-center text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 font-bold disabled:opacity-50 transition-colors cursor-pointer"
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
                <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-indigo-500/10 border border-blue-200 dark:border-indigo-500/30 text-blue-600 dark:text-indigo-400 shadow-xs">
                  <KeyRound className="w-7 h-7" />
                </div>

                <div className="text-center">
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    {resetStep === 1 ? 'Reset Your Password' : 'Enter OTP & New Password'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                    {resetStep === 1 ? 'Enter your registered email to receive a password reset OTP code' : 'Check your email for the OTP and set your new password'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Registered Email Address
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      disabled={resetStep === 2}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-60 transition-all font-medium"
                      placeholder="user@example.com"
                    />
                  </div>
                </div>

                {resetStep === 2 && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 text-center">
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
                            onPaste={handleOtpPaste}
                            className="w-11 h-13 text-center text-xl font-black bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-sky-500 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm shadow-xs"
                            required
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                        New Password
                      </label>
                      <div className="relative rounded-xl shadow-xs">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="h-4 w-4" />
                        </div>
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="block w-full pl-10 pr-10 py-3 bg-slate-50/70 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-sky-500/40 focus:border-blue-600 dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-950 text-sm placeholder-slate-400 dark:placeholder-slate-500 font-medium"
                          placeholder="New password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      {newPassword.length > 0 && getPasswordErrors(newPassword).length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[11px] text-amber-600 dark:text-amber-500 font-semibold flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> Missing requirements:
                          </p>
                          <ul className="text-[11px] text-amber-600/90 dark:text-amber-400/80 list-disc pl-4 space-y-0.5 font-medium">
                            {getPasswordErrors(newPassword).map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-gradient-to-r dark:from-sky-500 dark:to-blue-600 dark:hover:from-sky-400 dark:hover:to-blue-500 shadow-md shadow-blue-600/20 dark:shadow-sky-500/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? 'Processing...' : (resetStep === 1 ? 'Send Reset OTP Code' : 'Save New Password & Login')}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode('Login'); setResetStep(1); }}
                    className="inline-flex items-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors cursor-pointer"
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
