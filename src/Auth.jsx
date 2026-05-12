import { supabase } from './supabase'

const Auth = () => {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <h1 className="text-3xl font-black tracking-tight text-white">VibeFolio</h1>
            <span className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]"></span>
          </div>
          <p className="text-gray-500 text-sm font-medium">追蹤你的美股、台股與加密貨幣</p>
        </div>

        <div className="bg-[#12121a] rounded-2xl border border-[#1a1a24] p-6 mb-6">
          <div className="space-y-3 mb-6 text-xs text-gray-500 font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[#10b981]">✓</span>
              <span>即時報價同步</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#10b981]">✓</span>
              <span>美股 · 台股 · 加密貨幣</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#10b981]">✓</span>
              <span>USD / TWD 雙幣切換</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-bold py-3.5 px-4 rounded-xl transition-all active:scale-95 shadow-lg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            使用 Google 帳號登入
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-600 font-mono">
          登入即代表同意服務條款與隱私政策
        </p>
      </div>
    </div>
  )
}

export default Auth