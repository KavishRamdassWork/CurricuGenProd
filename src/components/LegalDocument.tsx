import React from 'react';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

/** Shared shell for the public legal documents (EULA, refund policy). Server component, no client JS. */
export function LegalDocument({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm mb-10">
          <Link href="/" className="text-slate-400 hover:text-white">&larr; {LEGAL.productName}</Link>
          <span className="flex-1" />
          <Link href="/terms" className="text-blue-400 hover:text-blue-300">Licence Agreement</Link>
          <Link href="/refund-policy" className="text-blue-400 hover:text-blue-300">Refund Policy</Link>
          <Link href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</Link>
          <Link href="/pricing" className="text-blue-400 hover:text-blue-300">Pricing</Link>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">{title}</h1>
        <p className="text-sm text-slate-500 mb-8">
          Version {LEGAL.version} &middot; Effective {LEGAL.effectiveDate}
        </p>
        {intro}

        <div className="space-y-10">{children}</div>

        <footer className="mt-16 pt-8 border-t border-slate-800 text-sm text-slate-500">
          <p>
            {LEGAL.companyName} trading as {LEGAL.tradingAs}, {LEGAL.country}. Questions about this document:{' '}
            {LEGAL.supportEmail}.
          </p>
        </footer>
      </div>
    </div>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={`s${n}`} className="scroll-mt-8">
      <h2 className="text-xl font-bold text-white mb-4">
        {n}. {title}
      </h2>
      <div className="space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

/** A numbered sub-clause, e.g. 4.2. */
export function Clause({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p className="flex gap-3">
      <span className="text-slate-500 tabular-nums shrink-0 w-10">{id}</span>
      <span className="flex-1">{children}</span>
    </p>
  );
}

/** Bullet list nested inside a clause. */
export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-14 space-y-1.5 marker:text-slate-600">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Highlighted box for notices the law requires to be conspicuous (e.g. CPA s49). */
export function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-slate-200">
      <p className="font-bold text-amber-300 mb-2">{title}</p>
      <div className="space-y-2 leading-relaxed">{children}</div>
    </div>
  );
}

export function Summary({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 mb-10">
      <p className="font-bold text-blue-300 mb-2">{title}</p>
      <div className="space-y-2 leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}
