import React, { useEffect, useRef } from 'react';
import { Sparkles, Trophy, Star, CheckCircle, Rocket, ShieldCheck, X } from 'lucide-react';

interface WelcomeToTarvModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  pioneerNumber: number;
}

export function WelcomeToTarvModal({ isOpen, onClose, userName, pioneerNumber }: WelcomeToTarvModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Particle Confetti Effect
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      spin: number;
      spinSpeed: number;
      opacity: number;
    }> = [];

    const colors = ['#f59e0b', '#fbbf24', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981'];

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.5,
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: (Math.random() - 0.5) * 4,
        speedY: Math.random() * 3 + 2,
        spin: Math.random() * 360,
        spinSpeed: (Math.random() - 0.5) * 6,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.spin += p.spinSpeed;

        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.spin * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden text-slate-100 font-sans">
        
        {/* Canvas for particle confetti */}
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none w-full h-full z-0 opacity-80" />

        {/* Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 p-8 text-center flex flex-col items-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-amber-500/10 mb-4 animate-bounce">
            <Trophy className="w-4 h-4 text-amber-400" />
            Founding Pioneer #{pioneerNumber} of 50
          </div>

          {/* Hero Icon */}
          <div className="relative my-3">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/20 transform rotate-3">
              <Rocket className="w-10 h-10 text-slate-950 -rotate-12" />
            </div>
            <div className="absolute -top-2 -right-2 bg-yellow-400 p-1.5 rounded-full text-slate-950 shadow-md">
              <Star className="w-4 h-4 fill-slate-950" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-400 mt-2">
            Welcome to TARV 🚀
          </h2>
          <p className="text-sm font-semibold text-amber-400/90 mt-1">
            Official Launch Early Pioneer
          </p>

          {/* Appreciation Message */}
          <div className="mt-5 p-5 bg-slate-800/70 border border-amber-500/20 rounded-2xl text-xs text-slate-300 leading-relaxed text-center backdrop-blur-xs">
            <p className="text-slate-200 font-medium">
              Hello <strong className="text-amber-300 font-bold">{userName || 'Engineer'}</strong>!
            </p>
            <p className="mt-2">
              You are officially one of our first <span className="text-amber-400 font-bold underline decoration-amber-500/40 underline-offset-4">50 Founding Pioneers</span> starting the journey with <strong className="text-white">TARV MEP Engine</strong>! Your early trust and leadership power the future of our engineering platform. We are thrilled to have you lead the way!
            </p>
          </div>

          {/* Highlight Cards */}
          <div className="grid grid-cols-3 gap-3 w-full mt-5 text-left text-[11px]">
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <div className="text-amber-400 font-bold flex items-center gap-1 mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Fast Sizing
              </div>
              <span className="text-slate-400">Duct, Chilled Water, Busbar & Pipes</span>
            </div>
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <div className="text-blue-400 font-bold flex items-center gap-1 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Org Backup
              </div>
              <span className="text-slate-400">Cloud & Local Server Auto-Sync</span>
            </div>
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <div className="text-emerald-400 font-bold flex items-center gap-1 mb-1">
                <CheckCircle className="w-3.5 h-3.5" /> PDF Reports
              </div>
              <span className="text-slate-400">Branded Exports with 1 Click</span>
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 py-3.5 px-6 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
          >
            <Rocket className="w-4 h-4" />
            Start Journey with TARV
          </button>

        </div>
      </div>
    </div>
  );
}
