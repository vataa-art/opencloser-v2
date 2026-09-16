// ============================================================
// WelcomeScreen — post-onboarding confirmation overlay.
// ============================================================

interface WelcomeScreenProps {
  onHome: () => void;
  onPipeline: () => void;
}

export function WelcomeScreen({ onHome, onPipeline }: WelcomeScreenProps) {
  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 animate-fade-in">
      <div className="text-center max-w-lg px-8">
        <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto mb-8 animate-breathe">
          <span className="text-5xl">🚀</span>
        </div>
        <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">Your AI Sales Engine is Ready</h1>
        <p className="text-lg text-gray-400 mb-3 leading-relaxed">
          We've analyzed your market, built your ICP, and deployed your AI sales persona.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/20 font-bold">✅ ICP Generated</span>
          <span className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-xl border border-blue-500/20 font-bold">🎯 Pipeline Seeded</span>
          <span className="text-xs bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded-xl border border-purple-500/20 font-bold">🤖 AI Caller Ready</span>
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onHome}
            className="px-10 py-4 bg-white text-black hover:bg-gray-200 rounded-2xl font-bold text-lg transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95"
          >
            View Dashboard
          </button>
          <button
            onClick={onPipeline}
            className="px-10 py-4 bg-white/10 text-white hover:bg-white/20 rounded-2xl font-bold text-lg transition-all border border-white/20"
          >
            Go to Pipeline
          </button>
        </div>
      </div>
    </div>
  );
}
