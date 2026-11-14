'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  Mail,
  Sparkles,
} from 'lucide-react';

interface ProgramResult {
  filename: string;
  docxBase64: string;
  recipientEmail: string;
  emailSent: boolean;
  emailError?: string;
  program: {
    day?: string;
    week_number: number;
    theme: string;
    focus: string;
    lesson: string;
  };
}

export default function WorshipProgramApp() {
  const [day, setDay] = useState<string>('Wednesday');
  const [week, setWeek] = useState<string>('');
  const [theme, setTheme] = useState<string>('');
  const [verseReference, setVerseReference] = useState<string>('');
  const [translation, setTranslation] = useState<string>('NIV');
  const [email, setEmail] = useState<string>('');

  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProgramResult | null>(null);

  // Restore draft from localStorage on load asynchronously
  useEffect(() => {
    try {
      const saved = localStorage.getItem('worship_program_draft');
      if (saved) {
        const data = JSON.parse(saved);
        setTimeout(() => {
          if (data.day) setDay(data.day);
          if (data.week !== undefined && data.week !== null) setWeek(String(data.week));
          if (data.theme) setTheme(data.theme);
          if (data.verseReference) setVerseReference(data.verseReference);
          if (data.translation) setTranslation(data.translation);
          if (data.email) setEmail(data.email);
        }, 0);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save draft to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'worship_program_draft',
        JSON.stringify({ day, week, theme, verseReference, translation, email })
      );
    } catch {
      // Ignore storage errors
    }
  }, [day, week, theme, verseReference, translation, email]);

  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty string or numbers only
    if (val === '' || /^\d+$/.test(val)) {
      setWeek(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!day.trim()) {
      setError('Please provide a day of worship (e.g. Wednesday, Sunday).');
      return;
    }
    if (!week.trim() || Number(week) < 1 || Number(week) > 52) {
      setError('Please enter a valid week number between 1 and 52.');
      return;
    }
    if (!theme.trim()) {
      setError('Please provide a sermon / program theme.');
      return;
    }
    if (!verseReference.trim()) {
      setError('Please provide a scripture reference (e.g. Genesis 12:1-4a).');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid recipient email address.');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: day.trim() || 'Wednesday',
          week: Number(week),
          theme: theme.trim(),
          verseReference: verseReference.trim(),
          translation: translation.trim(),
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate worship program.');
      }

      setResult(data);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred. Please check your credentials and try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadDocx = () => {
    if (!result?.docxBase64) return;
    const link = document.createElement('a');
    link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${result.docxBase64}`;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetForNext = () => {
    setResult(null);
    setError(null);
    const nextNum = Number(week) ? Math.min(Number(week) + 1, 52) : '';
    setWeek(nextNum ? String(nextNum) : '');
    setTheme('');
    setVerseReference('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-800 antialiased py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Worship Program Generator
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Generate and dispatch your perfectly formatted church study bulletin in one click.
          </p>
        </header>

        {/* Success Screen (The Green Tick) */}
        {result && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-6 sm:p-8 text-center animate-in fade-in duration-300">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4 ring-8 ring-emerald-50">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900">Program Ready!</h2>
            
            {result.emailSent ? (
              <p className="mt-2 text-sm text-slate-600">
                Email with <span className="font-semibold text-slate-800">{result.filename}</span> has been dispatched to{' '}
                <span className="font-semibold text-emerald-700">{result.recipientEmail}</span>.
              </p>
            ) : (
              <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-left text-xs text-amber-800">
                <span className="font-semibold">Note:</span> {result.emailError || 'Email could not be dispatched (check SMTP settings).'} You can still download the document directly below.
              </div>
            )}

            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-left space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Day & Week:</span>
                <span className="font-medium text-slate-800">{result.program.day || 'Wednesday'} — Week {result.program.week_number}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Theme:</span>
                <span className="font-medium text-slate-800">{result.program.theme}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Lesson Takeaway:</span>
                <p className="font-medium text-slate-700 italic">&ldquo;{result.program.lesson}&rdquo;</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleDownloadDocx}
                className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 text-white font-medium shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition"
              >
                <Download className="w-4 h-4" />
                Download Word (.docx)
              </button>
              <button
                type="button"
                onClick={handleResetForNext}
                className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
              >
                <RefreshCw className="w-4 h-4" />
                Prepare Another Week
              </button>
            </div>
          </div>
        )}

        {/* Main Creation Form */}
        {!result && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-6 sm:p-8">
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-sm text-rose-800">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Creation Error</p>
                  <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Row 1: Day, Week, and Theme */}
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="day" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Day
                  </label>
                  <input
                    id="day"
                    type="text"
                    placeholder="e.g. Wednesday"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    disabled={isLoading}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label htmlFor="week" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Week
                  </label>
                  <input
                    id="week"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="e.g. 8"
                    value={week}
                    onChange={handleWeekChange}
                    disabled={isLoading}
                    required
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-center"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="theme" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Theme / Sermon Topic
                  </label>
                  <input
                    id="theme"
                    type="text"
                    placeholder="e.g. THE PURPOSE DRIVEN LIFE"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    disabled={isLoading}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition uppercase"
                  />
                </div>
              </div>

              {/* Row 2: Bible Verse Reference & Translation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="reference" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Memory Verse Reference
                  </label>
                  <input
                    id="reference"
                    type="text"
                    placeholder="e.g. Genesis 12:1-4a"
                    value={verseReference}
                    onChange={(e) => setVerseReference(e.target.value)}
                    disabled={isLoading}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label htmlFor="translation" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Translation
                  </label>
                  <select
                    id="translation"
                    value={translation}
                    onChange={(e) => setTranslation(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  >
                    <option value="NIV">NIV</option>
                    <option value="ESV">ESV</option>
                    <option value="KJV">KJV</option>
                    <option value="NKJV">NKJV</option>
                    <option value="NLT">NLT</option>
                    <option value="Paraphrased">Paraphrased</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Recipient Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Recipient Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    id="email"
                    type="email"
                    placeholder="yourchurch.pastor@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating content & building document...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Create & Send Worship Program
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-400 space-y-1">
          <p>Worship Program Generator • Free Stack Edition</p>
          <p>Powered by Next.js, AI, and Nodemailer</p>
        </footer>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Program Dispatch</h3>
            <p className="text-sm text-slate-600 mb-4">
              Please verify the details below before creating the document:
            </p>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs mb-6">
              <div>
                <span className="text-slate-500">Day & Week:</span>
                <p className="font-semibold text-slate-800">
                  {day} — Week {week}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Theme:</span>
                <p className="font-semibold text-slate-800">
                  {theme.toUpperCase()}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Scripture:</span>
                <p className="font-medium text-slate-800">
                  {verseReference} ({translation})
                </p>
              </div>
              <div>
                <span className="text-slate-500">Delivery Email:</span>
                <p className="font-semibold text-blue-600">{email}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                Confirm & Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
