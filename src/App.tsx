/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Volume2, 
  Download, 
  Play, 
  Loader2, 
  Type, 
  Settings2,
  AlertCircle,
  Radio,
  Mic2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';

// Voice options available in Gemini TTS
const VOICES = [
  { id: 'Charon', name: 'হুজুর (শান্ত ও আধ্যাত্মিক)', description: 'হাদিস বা ধর্মীয় আলোচনার জন্য অত্যন্ত উপযুক্ত', category: 'ধর্মীয়' },
  { id: 'Puck', name: 'সংবাদ পাঠক (গম্ভীর)', description: 'খবর বা সংবাদ পড়ার জন্য অত্যন্ত উপযুক্ত', category: 'সংবাদ' },
  { id: 'Zephyr', name: 'জেফির (মিষ্টি কণ্ঠ)', description: 'সুন্দর এবং উজ্জ্বল নারী কণ্ঠ', category: 'মেয়ে' },
  { id: 'Kore', name: 'কোরে (পেশাদার)', description: 'পরিষ্কার এবং উষ্ণ নারী কণ্ঠ', category: 'মেয়ে' },
  { id: 'Fenrir', name: 'ফেনরির (সাহসী)', description: 'গতিশীল এবং জোরালো পুরুষ কণ্ঠ', category: 'পুরুষ' },
];

export default function App() {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<'Checking' | 'Set' | 'Missing'>('Checking');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    const key = process.env.GEMINI_API_KEY || "AIzaSyBUIWkL7Wygfz54NG2VZ9qhsVcoY3qtapQ";
    if (key && key.length > 10 && !key.includes('MY_GEMINI_API_KEY')) {
      setApiKeyStatus('Set');
    } else {
      setApiKeyStatus('Missing');
    }
  }, []);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const createWavHeader = (dataLength: number, sampleRate: number) => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    return header;
  };

  const generateSpeech = async () => {
    if (!text.trim()) {
      setError('অনুগ্রহ করে কিছু লেখা লিখুন।');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);

    try {
      let apiKey = process.env.GEMINI_API_KEY;
      
      // Robust check for API key
      if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
        apiKey = "AIzaSyBUIWkL7Wygfz54NG2VZ9qhsVcoY3qtapQ";
      }
      
      if (!apiKey || apiKey.length < 10) {
        throw new Error('API Key পাওয়া যায়নি বা এটি সঠিক নয়। অনুগ্রহ করে একটি সঠিক API Key প্রদান করুন।');
      }

      console.log('Using API Key starting with:', apiKey.substring(0, 7) + '...');
      const ai = new GoogleGenAI({ apiKey });
      console.log('Generating speech for text:', text.trim().substring(0, 50) + '...');
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text.trim() }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      console.log('Response received:', response);

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
        try {
          const binaryString = atob(base64Audio);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const wavHeader = createWavHeader(len, 24000);
          const wavBlob = new Blob([wavHeader, bytes], { type: 'audio/wav' });
          const url = URL.createObjectURL(wavBlob);
          setAudioUrl(url);
          console.log('Audio generated successfully');
        } catch (atobErr) {
          console.error('Base64 decoding error:', atobErr);
          throw new Error('অডিও ডাটা ডিকোড করতে সমস্যা হয়েছে।');
        }
      } else {
        console.error('No audio data in response:', response);
        throw new Error('AI থেকে কোনো অডিও ডাটা পাওয়া যায়নি।');
      }
    } catch (err: any) {
      console.error('TTS Error Details:', err);
      let errorMessage = 'ভয়েস তৈরি করতে সমস্যা হয়েছে।';
      
      if (err.message?.includes('API key not valid')) {
        errorMessage = 'আপনার API Key সঠিক নয়। অনুগ্রহ করে সেটিংস চেক করুন।';
      } else if (err.message?.includes('Quota exceeded')) {
        errorMessage = 'আপনার ফ্রি লিমিট শেষ হয়ে গেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `vocalize-ai-${Date.now()}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-[#5A5A40] selection:text-white">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#5A5A40] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#5A5A40]/20">
              <Mic2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight serif">Vocalize AI</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Professional Voice Studio</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs font-semibold opacity-40">
            <span className={`px-2 py-0.5 rounded uppercase text-[9px] font-bold ${apiKeyStatus === 'Set' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              API: {apiKeyStatus}
            </span>
            <span className="flex items-center gap-1"><Radio size={12} className="text-red-500 animate-pulse" /> LIVE</span>
            <span className="w-1 h-1 bg-black/20 rounded-full" />
            <span>GEMINI 2.5 TTS</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Editor */}
          <div className="lg:col-span-7 space-y-8">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold opacity-50 uppercase tracking-widest">
                  <Type size={14} />
                  <span>আপনার সংবাদ বা লেখা</span>
                </div>
                <span className="text-[10px] font-mono opacity-30 bg-black/5 px-2 py-1 rounded-md">
                  {text.length} CHARS
                </span>
              </div>
              <div className="relative group">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="এখানে আপনার সংবাদ বা যেকোনো লেখা লিখুন..."
                  className="w-full h-80 p-8 bg-white rounded-[2rem] border border-black/5 shadow-xl shadow-black/[0.02] focus:ring-4 focus:ring-[#5A5A40]/10 focus:border-[#5A5A40]/30 outline-none transition-all resize-none text-xl leading-relaxed serif"
                />
                <div className="absolute top-6 right-6 opacity-10">
                  <Mic2 size={40} />
                </div>
              </div>
            </section>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-600 text-sm font-medium"
                >
                  <AlertCircle size={20} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={generateSpeech}
                disabled={isGenerating || !text.trim()}
                className={`
                  flex-1 h-16 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                  ${isGenerating || !text.trim() 
                    ? 'bg-black/5 text-black/20 cursor-not-allowed' 
                    : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30] shadow-xl shadow-[#5A5A40]/30 active:scale-[0.98]'}
                `}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    ভয়েস তৈরি হচ্ছে...
                  </>
                ) : (
                  <>
                    <Play size={24} fill="currentColor" />
                    ভয়েস তৈরি করুন
                  </>
                )}
              </button>

              {audioUrl && (
                <button
                  onClick={downloadAudio}
                  className="h-16 px-10 rounded-2xl border-2 border-[#5A5A40] text-[#5A5A40] font-bold text-lg flex items-center justify-center gap-3 hover:bg-[#5A5A40]/5 transition-all active:scale-[0.98]"
                >
                  <Download size={24} />
                  ডাউনলোড
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Voice Selection */}
          <div className="lg:col-span-5 space-y-8">
            <section className="space-y-6">
              <div className="flex items-center gap-2 text-sm font-bold opacity-50 uppercase tracking-widest">
                <Settings2 size={14} />
                <span>ভয়েস নির্বাচন করুন</span>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {VOICES.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`
                      relative w-full p-5 rounded-[1.5rem] text-left transition-all border-2 group
                      ${selectedVoice === voice.id 
                        ? 'bg-white border-[#5A5A40] shadow-xl shadow-black/5' 
                        : 'bg-white/50 border-transparent hover:border-black/10'}
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`
                          px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                          ${voice.category === 'মেয়ে' ? 'bg-pink-100 text-pink-600' : 
                            voice.category === 'ধর্মীয়' || voice.category === 'ধর্মীয়' ? 'bg-emerald-100 text-emerald-600' : 
                            voice.category === 'সংবাদ' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
                        `}>
                          {voice.category}
                        </span>
                        <span className={`font-bold text-lg ${selectedVoice === voice.id ? 'text-[#5A5A40]' : 'text-black/70'}`}>
                          {voice.name}
                        </span>
                      </div>
                      {selectedVoice === voice.id && (
                        <div className="w-3 h-3 bg-[#5A5A40] rounded-full ring-4 ring-[#5A5A40]/10" />
                      )}
                    </div>
                    <p className="text-sm opacity-50 leading-relaxed">
                      {voice.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* Audio Player Card */}
            <AnimatePresence>
              {audioUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-8 bg-white rounded-[2.5rem] border border-black/5 shadow-2xl space-y-6 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#5A5A40]" />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 block mb-1">প্রিভিউ প্লেয়ার</span>
                      <h3 className="font-bold text-[#5A5A40]">অডিও প্রস্তুত</h3>
                    </div>
                    <Volume2 size={24} className="text-[#5A5A40] opacity-30" />
                  </div>
                  <audio 
                    ref={audioRef}
                    src={audioUrl} 
                    controls 
                    className="w-full h-12"
                    autoPlay
                  />
                  <div className="flex justify-between items-center text-[10px] font-mono opacity-30">
                    <span>24KHZ PCM</span>
                    <span>WAV FORMAT</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-16 border-t border-black/5 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2 opacity-30">
            <Mic2 size={16} />
            <span className="font-bold tracking-tighter">VOCALIZE AI</span>
          </div>
          <div className="flex gap-10 text-xs font-bold uppercase tracking-widest opacity-30">
            <a href="#" className="hover:text-[#5A5A40] transition-colors">প্রাইভেসি</a>
            <a href="#" className="hover:text-[#5A5A40] transition-colors">শর্তাবলী</a>
            <a href="#" className="hover:text-[#5A5A40] transition-colors">সহায়তা</a>
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        .serif {
          font-family: 'Cormorant Garamond', serif;
        }
        
        body {
          font-family: 'Inter', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* Custom Audio Player Styling */
        audio::-webkit-media-controls-panel {
          background-color: #F8F9FA;
        }
        audio::-webkit-media-controls-play-button {
          background-color: #5A5A40;
          border-radius: 50%;
        }
        
        textarea::placeholder {
          opacity: 0.2;
          font-style: italic;
        }
      `}} />
      <Analytics />
    </div>
  );
}
