'use client';

import { useState, useEffect } from 'react';
import { useUser, SignInButton, SignedIn, UserButton } from '@clerk/nextjs';
import { Analytics } from "@vercel/analytics/react";
import Image from "next/image";
import './pages.css';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [criticLoading, setCriticLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [text, setText] = useState('');
  const [humanizedText, setHumanizedText] = useState('');
  const [toggleCopy, setToggleCopy] = useState(false);
  const [temperature, setTemperature] = useState(1.0);
  const [kIterations, setKIterations] = useState(3);
  const [score, setScore] = useState<number | null>(null);
  const { isSignedIn } = useUser();

  useEffect(() => {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(text.trim() === '' ? 0 : words.length);
  }, [text]);

  const callApi = async (body: object) => {
    const response = await fetch('/api/humanaize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('API request failed');
    return response.json();
  };

  const handleHumanize = () => {
    if (!text.trim()) return;
    setLoading(true);
    setScore(null);
    callApi({ mode: 'humanize', aiText: text, temperature })
      .then((data) => setHumanizedText(data.message))
      .catch((err) => {
        console.error('Error:', err);
        alert('An error occurred while humanizing.');
      })
      .finally(() => setLoading(false));
  };

  const handleCriticize = () => {
    if (!humanizedText.trim()) return;
    setCriticLoading(true);
    callApi({ mode: 'refine', humanizedText, kIterations })
      .then((data) => {
        setHumanizedText(data.message);
        setScore(data.score ?? null);
      })
      .catch((err) => {
        console.error('Error:', err);
        alert('An error occurred while refining.');
      })
      .finally(() => setCriticLoading(false));
  };

  const loader = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" viewBox="0 0 24 24">
      <circle cx={4} cy={12} r={3} fill="currentColor">
        <animate id="svgSpinners3DotsScale0" attributeName="r" begin="0;svgSpinners3DotsScale1.end-0.25s" dur="0.75s" values="3;.2;3" />
      </circle>
      <circle cx={12} cy={12} r={3} fill="currentColor">
        <animate attributeName="r" begin="svgSpinners3DotsScale0.end-0.6s" dur="0.75s" values="3;.2;3" />
      </circle>
      <circle cx={20} cy={12} r={3} fill="currentColor">
        <animate id="svgSpinners3DotsScale1" attributeName="r" begin="svgSpinners3DotsScale0.end-0.45s" dur="0.75s" values="3;.2;3" />
      </circle>
    </svg>
  );

  const busy = loading || criticLoading;

  return (
    <div className="flex flex-col items-center min-h-screen pb-28 gap-6 p-4 font-[family-name:var(--font-geist-sans)]">
      <Analytics />
      <div className="absolute top-4 right-8">
        {!isSignedIn ? (
          <SignInButton>
            <button className="bg-foreground text-gray-100 px-4 py-2 rounded-md">Sign In</button>
          </SignInButton>
        ) : (
          <SignedIn>
            <UserButton />
          </SignedIn>
        )}
      </div>

      {/* ── Main panels ── */}
      <div className="flex gap-2 items-start flex-row w-full max-w-6xl mt-12">

        {/* Left: input */}
        <div className="flex flex-col flex-1 gap-2">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-[500px] p-4 pb-12 border border-solid border-gray-600 rounded-lg focus:outline-none resize-none focus:ring-2 focus:ring-[#333] focus:border-transparent overflow-y-auto"
              placeholder="Paste your AI-generated text here"
            />
            <div className="absolute bottom-4 left-4 bg-foreground px-2 py-1 rounded-md text-sm text-gray-100 shadow">
              {wordCount} words
            </div>
            <button
              className={`absolute bottom-4 right-4 rounded-md shadow border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-gray-100 gap-2 hover:bg-[#aeaeae] dark:hover:bg-[#aeaeae] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5
                ${(busy || !text.trim()) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
              onClick={handleHumanize}
              disabled={busy || !text.trim()}
            >
              {loading ? loader() : 'Humanize'}
            </button>
          </div>

          {/* Temperature control */}
          <div className="border border-gray-300 rounded-lg px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600 whitespace-nowrap">temp:</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="flex-1 accent-gray-800"
              disabled={busy}
            />
            <span className="text-sm font-mono text-gray-700 w-8 text-right">{temperature.toFixed(1)}</span>
          </div>
        </div>

        {/* Right: output */}
        <div className="flex flex-col flex-1 gap-2">
          <div className="relative">
            <textarea
              disabled={true}
              value={humanizedText}
              className="bg-white p-4 w-full h-[500px] border border-solid border-gray-600 rounded-lg focus:outline-none outline-none resize-none overflow-y-auto"
              placeholder="Humanized text will appear here"
            />
            <button
              disabled={busy || humanizedText.length < 1}
              className={`absolute bottom-4 right-4 flex flex-row gap-1 items-center bg-foreground px-2 py-1 rounded-md text-sm text-gray-100 shadow
                ${(busy || humanizedText.length < 1) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
              onClick={() => {
                if (!busy && humanizedText.length > 0) {
                  navigator.clipboard.writeText(humanizedText);
                  setToggleCopy(true);
                  setTimeout(() => setToggleCopy(false), 1000);
                }
              }}
            >
              <Image
                aria-hidden
                src={!toggleCopy ? '/copy.svg' : '/check.svg'}
                alt="Copy icon"
                width={16}
                height={16}
              />
              copy
            </button>
            <button
              className={`absolute bottom-4 left-4 rounded-md shadow border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-gray-100 gap-2 hover:bg-[#aeaeae] dark:hover:bg-[#aeaeae] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5
                ${(busy || !humanizedText.trim()) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
              onClick={handleCriticize}
              disabled={busy || !humanizedText.trim()}
            >
              {criticLoading ? loader() : 'Criticize'}
            </button>
          </div>

          {/* k-iterations control */}
          <div className="border border-gray-300 rounded-lg px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600 whitespace-nowrap">k:</span>
            <input
              type="number"
              min={1}
              max={20}
              value={kIterations}
              onChange={(e) => setKIterations(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-16 border border-gray-400 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#333]"
              disabled={busy}
            />
            {score !== null && (
              <span className="ml-auto text-sm font-mono text-gray-700">
                AI detection: <span className={score <= 15 ? 'text-green-600 font-semibold' : score <= 40 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'}>{score}%</span>
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
