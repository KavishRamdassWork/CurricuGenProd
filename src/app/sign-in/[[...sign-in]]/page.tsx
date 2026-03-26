import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-2xl shadow-blue-900/40">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">CurricuGen Pro</h1>
          <p className="text-slate-400 mt-2">AI-powered lesson planning for teachers</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-2xl border border-white/10 bg-white/5 backdrop-blur-xl',
              headerTitle: 'text-white',
              headerSubtitle: 'text-slate-400',
              socialButtonsBlockButton: 'bg-white/10 border-white/10 text-white hover:bg-white/20',
              dividerLine: 'bg-white/10',
              dividerText: 'text-slate-400',
              formFieldLabel: 'text-slate-300',
              formFieldInput: 'bg-white/10 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500',
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/30',
              footerActionText: 'text-slate-400',
              footerActionLink: 'text-blue-400 hover:text-blue-300',
            },
          }}
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
