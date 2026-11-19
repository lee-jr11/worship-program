'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  Mail,
  Smartphone,
} from 'lucide-react';

interface ProgramResult {
  filename: string;
  docxBase64: string;
  deliveryMethod?: 'device' | 'email';
  recipientEmail?: string;
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
  const [day, setDay] = useState<string>('');
  const [week, setWeek] = useState<string>('');
  const [theme, setTheme] = useState<string>('');
  const [verseReference, setVerseReference] = useState<string>('');
  const [verseText, setVerseText] = useState<string>('');
  const [translation, setTranslation] = useState<string>('NIV');
  const [deliveryMethod, setDeliveryMethod] = useState<'device' | 'email'>('device');
  const [email, setEmail] = useState<string>('');

  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProgramResult | null>(null);

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
      setError('please provide a day of worship (e.g. wednesday, sunday).');
      return;
    }
    if (!week.trim() || Number(week) < 1 || Number(week) > 52) {
      setError('please enter a valid week number between 1 and 52.');
      return;
    }
    if (!theme.trim()) {
      setError('please provide a sermon / program theme.');
      return;
    }
    if (!verseReference.trim()) {
      setError('please provide a scripture reference (e.g. genesis 12:1-4a).');
      return;
    }
    if (deliveryMethod === 'email' && (!email.trim() || !email.includes('@'))) {
      setError('please enter a valid recipient email address.');
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
          day: day.trim(),
          week: Number(week),
          theme: theme.trim(),
          verseReference: verseReference.trim(),
          verseText: verseText.trim() || undefined,
          translation: translation.trim(),
          deliveryMethod,
          email: deliveryMethod === 'email' ? email.trim() : undefined,
        }),
      });

      let data: { success?: boolean; error?: string; [key: string]: unknown };
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          response.status === 504 || responseText.includes('FUNCTION_INVOCATION_TIMEOUT')
            ? 'Request timed out on the server. Please try again.'
            : responseText || `Server error (${response.status})`
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'failed to generate worship program.');
      }

      setResult(data as unknown as ProgramResult);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'an unexpected error occurred. please check your credentials and try again.';
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
    setVerseText('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-800 antialiased py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 lowercase">
            worship program generator
          </h1>
        </header>

        {/* Success Screen (The Green Tick) */}
        {result && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-6 sm:p-8 text-center card-in lowercase">
            <div className="tick-in inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4 ring-8 ring-emerald-50">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            {result.deliveryMethod === 'email' ? (
              <>
                <h2 className="text-2xl font-bold text-slate-900">
                  {result.emailSent ? 'program sent!' : 'program ready!'}
                </h2>
                {result.emailSent ? (
                  <p className="mt-2 text-sm text-slate-600">
                    email with <span className="font-semibold text-slate-800">{result.filename}</span> has been dispatched to{' '}
                    <span className="font-semibold text-emerald-700">{result.recipientEmail}</span>.
                  </p>
                ) : (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-left text-xs text-amber-800">
                    <span className="font-semibold">note:</span> {result.emailError || 'email could not be dispatched.'} you can still download the document directly below.
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-900">program ready!</h2>
                <p className="mt-2 text-sm text-slate-600">
                  your formatted word document <span className="font-semibold text-slate-800">{result.filename}</span> is ready to download.
                </p>
              </>
            )}

            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-left space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">day & week:</span>
                <span className="font-medium text-slate-800">{result.program.day || 'Wednesday'} — Week {result.program.week_number}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">theme:</span>
                <span className="font-medium text-slate-800">{result.program.theme}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">lesson takeaway:</span>
                <p className="font-medium text-slate-700 italic">&ldquo;{result.program.lesson}&rdquo;</p>
              </div>
            </div>

            {/* Decision-Based Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {result.deliveryMethod === 'device' || !result.emailSent ? (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadDocx}
                    className="pressable flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 text-white font-medium shadow-md shadow-emerald-600/20 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  >
                    <Download className="w-4 h-4" />
                    download word (.docx)
                  </button>
                  <button
                    type="button"
                    onClick={handleResetForNext}
                    className="pressable inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    prepare another week
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleResetForNext}
                    className="pressable flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    prepare another week
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadDocx}
                    className="pressable inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    download copy
                  </button>
                </>
              )}
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
                  <p className="font-semibold">creation error</p>
                  <p className="mt-0.5 text-xs text-rose-700 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Row 1: Day, Week, and Theme */}
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="day" className="block text-xs font-semibold text-slate-700 lowercase tracking-wider mb-1.5">
                    day
                  </label>
                  <input
                    id="day"
                    type="text"
                    placeholder="e.g. wednesday"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    disabled={isLoading}
                    required
                    className="field w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label htmlFor="week" className="block text-xs font-semibold text-slate-700 lowercase tracking-wider mb-1.5">
                    week
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
                    className="field w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-600 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-center"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="theme" className="block text-xs font-semibold text-slate-700 lowercase tracking-wider mb-1.5">
                    theme / sermon topic
                  </label>
                  <input
                    id="theme"
                    type="text"
                    placeholder="e.g. the purpose driven life"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    disabled={isLoading}
                    required
                    className="field w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white lowercase"
                  />
                </div>
              </div>

              {/* Row 2: Bible Verse Reference & Translation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="reference" className="block text-xs font-semibold text-slate-700 lowercase tracking-wider mb-1.5">
                    memory verse
                  </label>
                  <input
                    id="reference"
                    type="text"
                    placeholder="e.g. genesis 12:1-4a"
                    value={verseReference}
                    onChange={(e) => setVerseReference(e.target.value)}
                    disabled={isLoading}
                    required
                    className="field w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label htmlFor="translation" className="block text-xs font-semibold text-slate-700 lowercase tracking-wider mb-1.5">
                    translation
                  </label>
                  <select
                    id="translation"
                    value={translation}
                    onChange={(e) => setTranslation(e.target.value)}
                    disabled={isLoading}
                    className="field w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="NIV">niv</option>
                    <option value="ESV">esv</option>
                    <option value="KJV">kjv</option>
                    <option value="NKJV">nkjv</option>
                    <option value="NLT">nlt</option>
                    <option value="Paraphrased">paraphrased</option>
                    <option value="Other">other</option>
                  </select>
                </div>
              </div>

              {/* Row 2b: Optional pasted scripture text */}
              <div>
                <label htmlFor="verseText" className="block text-xs font-semibold text-slate-700 lowercase tracking-wider mb-1.5">
                  verse text (optional)
                </label>
                <textarea
                  id="verseText"
                  rows={4}
                  placeholder="paste the exact verse wording here so the document uses the real scripture, e.g. the lord had said to abram..."
                  value={verseText}
                  onChange={(e) => setVerseText(e.target.value)}
                  disabled={isLoading}
                  className="field w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-y"
                />
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  recommended: without this, the verse text is written by the ai and may not match your translation word-for-word.
                </p>
              </div>

              {/* Row 3: Destination Radio Choice */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 lowercase tracking-wider mb-2">
                  where should it be sent?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`pressable flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer ${
                      deliveryMethod === 'device'
                        ? 'bg-blue-50/70 border-blue-500 text-blue-950 ring-1 ring-blue-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value="device"
                      checked={deliveryMethod === 'device'}
                      onChange={() => setDeliveryMethod('device')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-slate-600 shrink-0" />
                      <span className="text-sm font-medium">this phone / device</span>
                    </div>
                  </label>

                  <label
                    className={`pressable flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer ${
                      deliveryMethod === 'email'
                        ? 'bg-blue-50/70 border-blue-500 text-blue-950 ring-1 ring-blue-500'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value="email"
                      checked={deliveryMethod === 'email'}
                      onChange={() => setDeliveryMethod('email')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-600 shrink-0" />
                      <span className="text-sm font-medium">send to email</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Row 4: Conditional Recipient Email (only if 'email' selected) */}
              {deliveryMethod === 'email' && (
                <div className="card-in">
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-700 lowercase tracking-wider mb-1.5">
                    recipient email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required={deliveryMethod === 'email'}
                      className="field w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="pressable w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lowercase"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      generating content & building document...
                    </>
                  ) : deliveryMethod === 'device' ? (
                    <>
                      <Download className="w-4 h-4" />
                      create & download worship program
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      create & send to email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-600 space-y-1">
          <p>worship program generator • free stack edition</p>
          <p>powered by next.js, ai, and nodemailer</p>
        </footer>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="overlay-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="dialog-in bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2 lowercase">
              {deliveryMethod === 'device' ? 'confirm program download' : 'confirm program dispatch'}
            </h3>
            <p className="text-sm text-slate-600 mb-4 lowercase">
              please verify the details below before creating the document:
            </p>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs mb-6 lowercase">
              <div>
                <span className="text-slate-500">day & week:</span>
                <p className="font-semibold text-slate-800">
                  {day} — Week {week}
                </p>
              </div>
              <div>
                <span className="text-slate-500">theme:</span>
                <p className="font-semibold text-slate-800">
                  {theme.toLowerCase()}
                </p>
              </div>
              <div>
                <span className="text-slate-500">scripture:</span>
                <p className="font-medium text-slate-800">
                  {verseReference} ({translation})
                </p>
              </div>
              <div>
                <span className="text-slate-500">destination:</span>
                <p className="font-semibold text-blue-600">
                  {deliveryMethod === 'device' ? 'on this device (direct download)' : email}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="pressable flex-1 py-2.5 px-4 rounded-xl border border-slate-300 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 lowercase"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                className="pressable flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lowercase"
              >
                {deliveryMethod === 'device' ? (
                  <>
                    <Download className="w-4 h-4" />
                    confirm & create
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    confirm & send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
