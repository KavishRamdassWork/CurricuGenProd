'use client';

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Sparkles, Zap, Shield, Crown, Loader2, Info } from 'lucide-react';
import { LEGAL } from '@/lib/legal';
import { PRO_PRICE_DISPLAY } from '@/lib/pricing';

export default function PricingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  // PayFast requires an affirmative "click-to-accept" of the refund policy / purchase terms at checkout.
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleUpgrade = async () => {
    if (!user) {
      router.push('/sign-in?redirect_url=/pricing');
      return;
    }
    if (!acceptedTerms) return;

    setIsCheckoutLoading(true);
    try {
      const res = await fetch('/api/payfast/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptedTerms: true, termsVersion: LEGAL.version }),
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.payfastUrl && data.paymentData) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.payfastUrl;
        
        for (const key in data.paymentData) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = data.paymentData[key];
          form.appendChild(input);
        }
        
        document.body.appendChild(form);
        form.submit();
      } else {
        throw new Error('Invalid response from checkout');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Failed to start checkout. Please try again or contact support.');
      setIsCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans selection:bg-blue-500/30">
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] left-[-10%] w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative pt-24 pb-16 px-6 sm:px-12 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold tracking-wide uppercase mb-6 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]">
            <Sparkles className="w-4 h-4" /> Go Pro
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            Supercharge your teaching with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">CurricuGen Pro</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400">
            Stop spending hours strictly planning. Get fair-use access to AI curriculum generation, with up to 300 generations a day, saving you 15+ hours every week.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-20">
          
          {/* Free Tier */}
          <div className="relative bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 md:p-10 flex flex-col shadow-2xl transition-all hover:bg-slate-800/80">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Teacher Starter</h2>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-extrabold text-white">$0</span>
                <span className="text-slate-400 font-medium">/forever</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">Perfect for testing the waters and seeing the power of AI lesson planning.</p>
            </div>
            
            <ul className="space-y-4 mb-10 flex-1">
              {[
                '10 daily free generations',
                'Basic lesson plans & worksheets',
                'Save classrooms locally',
                'Standard email support',
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-1 flex-shrink-0 bg-slate-700/50 rounded-full p-1"><Check className="w-4 h-4 text-slate-300" /></div>
                  <span className="text-slate-300 font-medium">{feature}</span>
                </li>
              ))}
            </ul>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-start gap-3 mb-8">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">Your free generations reset daily. Upgrading raises your daily limit to a fair-use ceiling of up to 300 generations a day.</p>
            </div>

            <button 
              onClick={() => router.push('/dashboard')}
              className="w-full py-4 px-6 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors"
            >
              {user ? 'Return to Dashboard' : 'Get Started for Free'}
            </button>
          </div>

          {/* Pro Tier (Featured) */}
          <div className="relative bg-gradient-to-br from-blue-900/80 via-blue-800/80 to-indigo-900/80 backdrop-blur-xl border border-blue-500/30 rounded-3xl p-8 md:p-10 flex flex-col shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] transform md:-translate-y-4">
            <div className="absolute top-0 right-8 transform -translate-y-1/2">
              <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full shadow-lg shadow-orange-500/30 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> Most Popular
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                CurricuGen Pro <Zap className="w-5 h-5 text-amber-400 fill-amber-400/20" />
              </h2>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-extrabold text-white">{PRO_PRICE_DISPLAY}</span>
                <span className="text-blue-200 font-medium">/month (ZAR)</span>
              </div>
              <p className="text-blue-100/70 text-sm leading-relaxed">Everything you need to run your classroom effortlessly.</p>
            </div>
            
            <ul className="space-y-4 mb-10 flex-1">
              {[
                { text: 'Up to 300 curriculum generations a day (fair use)', highlighted: true },
                { text: 'Lesson plans & worksheets within the daily fair-use limit' },
                { text: 'Formal assessments & memos within the daily fair-use limit' },
                { text: 'Classroom performance analysis' },
                { text: 'Future updates (Slides & Games)', future: true },
                { text: 'Priority 24/7 support', future: true },
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className={`mt-1 flex-shrink-0 rounded-full p-1 ${feature.highlighted ? 'bg-amber-500/20' : 'bg-blue-500/20'}`}>
                    <Check className={`w-4 h-4 ${feature.highlighted ? 'text-amber-400' : 'text-blue-300'}`} />
                  </div>
                  <span className={`font-medium ${feature.highlighted ? 'text-white' : 'text-blue-50'} ${feature.future ? 'opacity-80' : ''}`}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>

            {/* Purchase terms are shown on the same screen as the checkout button (PayFast requirement). */}
            <div className="mb-5 rounded-xl bg-blue-950/50 border border-blue-400/20 p-4 text-xs text-blue-100/80 leading-relaxed space-y-2">
              <p>
                <strong className="text-white">What you are buying:</strong> a monthly subscription to CurricuGen Pro, an
                online AI curriculum tool, delivered digitally to your account within minutes of payment.
              </p>
              <p>
                <strong className="text-white">Price:</strong> {PRO_PRICE_DISPLAY} (ZAR) per month, charged today and then
                every month on the same date until you cancel.
              </p>
              <p>
                <strong className="text-white">Cancel any time</strong> with no penalty. <strong className="text-white">
                7-day money-back guarantee</strong>: refund in full if you ask within 7 days of subscribing.
              </p>
              <p>
                Supplier: {LEGAL.companyName}, {LEGAL.country}. Support: {LEGAL.supportEmail}.
              </p>
            </div>

            <label className="flex items-start gap-3 mb-5 cursor-pointer text-sm text-blue-50">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-5 w-5 flex-shrink-0 rounded accent-amber-400"
              />
              <span>
                I have read and accept the{' '}
                <Link href="/refund-policy" target="_blank" className="underline font-semibold text-white">Refund, Cancellation &amp; Delivery Policy</Link>{' '}
                and the{' '}
                <Link href="/terms" target="_blank" className="underline font-semibold text-white">End User Licence Agreement</Link>,
                and I authorise recurring monthly payments of {PRO_PRICE_DISPLAY} through PayFast until I cancel.
              </span>
            </label>

            <button
              onClick={handleUpgrade}
              disabled={isCheckoutLoading || !isLoaded || (!!user && !acceptedTerms)}
              className="group relative w-full py-4 px-6 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed text-blue-900 font-extrabold shadow-xl shadow-blue-900/20 transition-all hover:shadow-2xl hover:-translate-y-1 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/40 to-transparent -translate-x-[150%] animate-[shimmer_2s_infinite] group-hover:animate-none" />
              <div className="relative flex justify-center items-center gap-2">
                {isCheckoutLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Preparing Checkout...</>
                ) : (
                  <>Upgrade to Pro <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                )}
              </div>
            </button>
            <p className="text-center text-blue-200/50 text-xs mt-4 font-medium flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Secure payment via PayFast
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto text-center border-t border-slate-800 pt-16 mt-8">
          <h3 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h3>
          <div className="grid sm:grid-cols-2 gap-8 text-left">
            <div>
              <h4 className="font-bold text-slate-200 mb-2">How do the free generations work?</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Each free account gets 10 daily generation credits. Generating a 10-week curriculum blueprint counts as 1 credit. Generating an individual lesson or worksheet counts as 1 credit.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-200 mb-2">Can I cancel my subscription?</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Yes, at any time, with no penalty. Email {LEGAL.supportEmail} from your account address and we will cancel it with PayFast within 1 business day. You keep Pro until the end of the month you have paid for, and we refund in full if you ask within 7 days of subscribing.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-200 mb-2">How is Pro delivered and billed?</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Pro is a digital service: it switches on in your account within minutes of PayFast confirming payment. You are billed {PRO_PRICE_DISPLAY} (ZAR) every month until you cancel.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-200 mb-2">Where is the full small print?</h4>
              <p className="text-sm text-slate-400 leading-relaxed">Read the <Link href="/terms" className="text-blue-400 hover:text-blue-300 underline">End User Licence Agreement</Link>, the <Link href="/refund-policy" className="text-blue-400 hover:text-blue-300 underline">Refund, Cancellation &amp; Delivery Policy</Link> and the <Link href="/privacy" className="text-blue-400 hover:text-blue-300 underline">Privacy Policy</Link>.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  );
}
