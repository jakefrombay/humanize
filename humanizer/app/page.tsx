'use client';

import { useState, useEffect } from 'react';
import { useUser, SignInButton, SignedIn, UserButton } from '@clerk/nextjs';
import { Analytics } from "@vercel/analytics/react";
import Image from "next/image";
import './pages.css';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [text, setText] = useState('');
  const [humanizedText, setHumanizedText] = useState('');
  const [toggleCopy, setToggleCopy] = useState(false);
  const { isSignedIn } = useUser();

  useEffect(() => {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(text.trim() === '' ? 0 : words.length);
  }, [text]);

  const humanaizeAiText = async (aiText: string) => {
    console.log('Sending POST request /api/humanaize');
    try {
      const response = await fetch('/api/humanaize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ aiText }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while fetching the reply.');
      return 'No response available';
    } finally {
      console.log('POST request /api/humanaize completed');
    }
  };

  const handleHumanize = () => {
    console.log('Humanizing...');
    setLoading(true);
    humanaizeAiText(text)
      .then((humanized) => {
        setHumanizedText(humanized);
      })
      .catch((error) => {
        console.error('Error:', error);
      })
      .finally(() => {
        setLoading(false);
      });
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

  return (
    <div className="flex flex-col items-center min-h-screen pb-28 gap-8 p-4 font-[family-name:var(--font-geist-sans)]">
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
      <div className="flex gap-2 items-start flex-row w-full max-w-6xl mt-12">
        <div className="bg-white p-4 flex-1">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-[500px] p-4 pb-12 border border-solid border-gray-600 rounded-lg focus:outline-none resize-none focus:ring-2 focus:ring-[#333] focus:border-transparent overflow-y-auto"
              placeholder="Paste your AI-generated text here"
            ></textarea>
            <div className="absolute bottom-4 left-4 bg-foreground px-2 py-1 rounded-md text-sm text-gray-100 shadow">
              {wordCount} words
            </div>
            <button
              className={`absolute bottom-4 right-4 rounded-md shadow border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-gray-100 gap-2 hover:bg-[#aeaeae] dark:hover:bg-[#aeaeae] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5
                ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
              onClick={handleHumanize}
              disabled={loading}
            >
              {loading ? loader() : 'Humanize'}
            </button>
          </div>
        </div>
        <div className="bg-white p-4 flex-1">
          <div className="relative">
            <textarea
              disabled={true}
              value={humanizedText}
              className="bg-white p-4 w-full h-[500px] border border-solid border-gray-600 rounded-lg focus:outline-none outline-none resize-none overflow-y-auto"
              placeholder="Humanized text will appear here"
            ></textarea>
            <button
              disabled={(!loading && humanizedText.length > 0) ? false : true}
              className={`absolute bottom-4 right-4 flex flex-row gap-1 items-center bg-foreground px-2 py-1 rounded-md text-sm text-gray-100 shadow
                ${(loading || humanizedText.length < 1) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
              `}
              onClick={() => {
                if (!loading && humanizedText.length > 0) {
                  navigator.clipboard.writeText(humanizedText);
                  setToggleCopy(true);
                  setTimeout(() => {
                    setToggleCopy(false);
                  }, 1000);
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
          </div>
        </div>
      </div>
    </div>
  );
}
