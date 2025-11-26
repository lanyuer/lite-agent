
import React, { useState } from 'react';
import { Mail, Github, Chrome, ArrowRight, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    // Simulate network request
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 1500);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-warm-bg bg-dot-pattern bg-[length:24px_24px] p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200/60 p-8 md:p-10 relative overflow-hidden">
        
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-300 to-[#DA7756]"></div>

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-[#DA7756] rounded-xl flex items-center justify-center mb-6 shadow-md transform hover:scale-105 transition-transform duration-300">
             <div className="flex gap-2.5">
                <div className="w-2 h-2 bg-[#3E2C26] rounded-full"></div>
                <div className="w-2 h-2 bg-[#3E2C26] rounded-full"></div>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-text-main mb-2 tracking-tight">Welcome back</h1>
          <p className="text-sm text-text-sub">Sign in to continue your session</p>
        </div>

        {/* Social Buttons */}
        <div className="space-y-3 mb-8">
          <button 
            onClick={() => handleLogin()}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 text-text-main font-medium transition-all active:scale-[0.98] group"
          >
            <Github size={20} className="text-gray-700 group-hover:text-black transition-colors" />
            <span>Continue with GitHub</span>
          </button>
          <button 
            onClick={() => handleLogin()}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 text-text-main font-medium transition-all active:scale-[0.98] group"
          >
            <div className="relative flex items-center justify-center">
               <Chrome size={20} className="text-gray-700 group-hover:text-blue-600 transition-colors" />
            </div>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-400 font-medium tracking-wider">Or email</span>
          </div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-text-main ml-1">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-gray-400" size={18} />
              <input 
                id="email"
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#DA7756]/20 focus:border-[#DA7756]/50 transition-all text-sm text-text-main placeholder:text-gray-400"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#DA7756] hover:bg-[#C66545] text-white font-medium py-2.5 rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>Sign In with Email</span>
                <ArrowRight size={16} strokeWidth={2.5} className="opacity-80" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-gray-400">
          By clicking continue, you agree to our <a href="#" className="underline hover:text-gray-600">Terms of Service</a> and <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};
