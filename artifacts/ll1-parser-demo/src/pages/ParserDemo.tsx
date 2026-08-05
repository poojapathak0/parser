import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- DATA STRUCTURES ---

const ORIGINAL_GRAMMAR = [
  { rule: "S → ABC",      badge: null },
  { rule: "A → abA | ab", badge: "left-factor" },
  { rule: "B → b | BC",   badge: "left-recursive" },
  { rule: "C → c | cC",   badge: "left-factor" },
];

const TRANSFORMED_GRAMMAR = [
  "S  → A B C",
  "A  → ab A'",
  "A' → ab A' | ε",
  "B  → b B'",
  "B' → C B' | ε",
  "C  → c C'",
  "C' → c C' | ε"
];

const FIRST_SETS = [
  { nt: "S", set: "{ a }" },
  { nt: "A", set: "{ a }" },
  { nt: "A'", set: "{ a, ε }" },
  { nt: "B", set: "{ b }" },
  { nt: "B'", set: "{ c, ε }" },
  { nt: "C", set: "{ c }" },
  { nt: "C'", set: "{ c, ε }" }
];

const FOLLOW_SETS = [
  { nt: "S", set: "{ $ }" },
  { nt: "A", set: "{ b }" },
  { nt: "A'", set: "{ b }" },
  { nt: "B", set: "{ c }" },
  { nt: "B'", set: "{ c }" },
  { nt: "C", set: "{ $, c }" },
  { nt: "C'", set: "{ $, c }" }
];

const PARSING_TABLE = [
  { nt: "S", a: "S→ABC", b: "—", c: "—", $: "—" },
  { nt: "A", a: "A→abA'", b: "—", c: "—", $: "—" },
  { nt: "A'", a: "A'→abA'", b: "A'→ε", c: "—", $: "—" },
  { nt: "B", a: "—", b: "B→bB'", c: "—", $: "—" },
  { nt: "B'", a: "—", b: "—", c: "B'→ε ⚠", $: "—", isConflict: true },
  { nt: "C", a: "—", b: "—", c: "C→cC'", $: "—" },
  { nt: "C'", a: "—", b: "—", c: "C'→cC'", $: "C'→ε" }
];

const PARSE_STEPS = [
  { step: 1, stack: ['S', '$'], input: ['a', 'b', 'b', 'c', 'c', '$'], action: "Expand — S → A B C" },
  { step: 2, stack: ['A', 'B', 'C', '$'], input: ['a', 'b', 'b', 'c', 'c', '$'], action: "Expand — A → ab A'" },
  { step: 3, stack: ['a', 'b', "A'", 'B', 'C', '$'], input: ['a', 'b', 'b', 'c', 'c', '$'], action: "Match 'a'" },
  { step: 4, stack: ['b', "A'", 'B', 'C', '$'], input: ['b', 'b', 'c', 'c', '$'], action: "Match 'b'" },
  { step: 5, stack: ["A'", 'B', 'C', '$'], input: ['b', 'c', 'c', '$'], action: "Expand — A' → ε  (FOLLOW: b)" },
  { step: 6, stack: ['B', 'C', '$'], input: ['b', 'c', 'c', '$'], action: "Expand — B → b B'" },
  { step: 7, stack: ['b', "B'", 'C', '$'], input: ['b', 'c', 'c', '$'], action: "Match 'b'" },
  { step: 8, stack: ["B'", 'C', '$'], input: ['c', 'c', '$'], action: "Expand — B' → ε  ⚠ (conflict resolved)", isWarning: true },
  { step: 9, stack: ['C', '$'], input: ['c', 'c', '$'], action: "Expand — C → c C'" },
  { step: 10, stack: ['c', "C'", '$'], input: ['c', 'c', '$'], action: "Match 'c'" },
  { step: 11, stack: ["C'", '$'], input: ['c', '$'], action: "Expand — C' → c C'" },
  { step: 12, stack: ['c', "C'", '$'], input: ['c', '$'], action: "Match 'c'" },
  { step: 13, stack: ["C'", '$'], input: ['$'], action: "Expand — C' → ε  (FOLLOW: $)" },
  { step: 14, stack: ['$'], input: ['$'], action: "✅ ACCEPT", isSuccess: true },
];

// --- COMPONENTS ---

const SectionCard = ({ title, subtitle, children, className = "" }: any) => (
  <section className={`bg-card rounded-xl border shadow-sm overflow-hidden flex flex-col ${className}`}>
    <div className="px-6 py-4 border-b bg-slate-50/50">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    <div className="p-6 flex-grow">{children}</div>
  </section>
);

const SymbolChip = ({ symbol, isTop, isLookahead }: { symbol: string, isTop?: boolean, isLookahead?: boolean }) => {
  const isTerminal = ['a', 'b', 'c', '$'].includes(symbol);
  
  let baseColor = isTerminal 
    ? "bg-slate-100 text-slate-700 border-slate-200" 
    : "bg-indigo-50 text-indigo-700 border-indigo-200";
    
  if (isTop || isLookahead) {
    baseColor = isTerminal
      ? "bg-slate-800 text-slate-50 border-slate-900 ring-2 ring-slate-400 ring-offset-1"
      : "bg-indigo-600 text-indigo-50 border-indigo-700 ring-2 ring-indigo-400 ring-offset-1";
  }

  return (
    <motion.span 
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`inline-flex items-center justify-center font-mono text-[15px] font-medium min-w-[28px] px-2 py-1 rounded-md border ${baseColor} shadow-sm z-10`}
    >
      {symbol}
    </motion.span>
  );
};

export default function ParserDemo() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const stepData = PARSE_STEPS[currentStep];
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= PARSE_STEPS.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleNext = () => setCurrentStep(Math.min(currentStep + 1, PARSE_STEPS.length - 1));
  const handlePrev = () => setCurrentStep(Math.max(currentStep - 1, 0));
  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };
  const togglePlay = () => setIsPlaying(!isPlaying);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LL(1) Non-Recursive Predictive Parser</h1>
            <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">S → ABC</span>
              <span className="text-slate-300">|</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">A → abA | ab</span>
              <span className="text-slate-300">|</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">B → b | BC</span>
              <span className="text-slate-300">|</span>
              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">C → c | cC</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Educational Visualizer
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        
        {/* Row 1: Grammar Transformation */}
        <SectionCard 
          title="① Transformed LL(1) Grammar" 
          subtitle="(Left recursion removed · Left factored)"
        >
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Original Grammar</h3>
              <ul className="space-y-2 font-mono text-[15px] text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100">
                {ORIGINAL_GRAMMAR.map((prod, i) => (
                  <li key={i} className="flex">
                    <span className="text-slate-400 w-6 select-none">{i+1}.</span>
                    {prod.includes('BC') ? 
                      <span>B → b | BC <span className="text-amber-500 text-xs font-sans ml-2 tracking-normal bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">left-recursive</span></span> 
                      : prod}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                Transformed Grammar <CheckCircle2 className="w-4 h-4 text-indigo-500" />
              </h3>
              <ul className="space-y-1 font-mono text-[15px] text-slate-800 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                {TRANSFORMED_GRAMMAR.map((prod, i) => (
                  <li key={i} className="flex">
                    <span className="text-indigo-300 w-6 select-none">{i+1}.</span>
                    {prod}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900 leading-relaxed">
              <strong className="font-mono font-medium">M[B′,c]</strong> has a conflict: <code className="bg-blue-100 px-1 rounded text-blue-800">FIRST(CB′)={'{c}'}</code> and <code className="bg-blue-100 px-1 rounded text-blue-800">FOLLOW(B′)={'{c}'}</code> both fire. 
              Resolved to <code className="bg-blue-100 px-1 rounded text-blue-800 font-bold">B′→ε</code> so the outer C in S→ABC can consume the remaining 'c' symbols. 
              This reflects inherent ambiguity in the original B → b | BC production.
            </p>
          </div>
        </SectionCard>

        {/* Row 2: FIRST & FOLLOW */}
        <div className="grid md:grid-cols-2 gap-8">
          <SectionCard title="② FIRST Sets" className="h-full">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium w-24">NT</th>
                    <th className="px-4 py-2 font-medium">FIRST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[15px]">
                  {FIRST_SETS.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-semibold text-indigo-700 bg-slate-50/30">{row.nt}</td>
                      <td className="px-4 py-2 text-slate-700">{row.set}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
          
          <SectionCard title="③ FOLLOW Sets" className="h-full">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium w-24">NT</th>
                    <th className="px-4 py-2 font-medium">FOLLOW</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[15px]">
                  {FOLLOW_SETS.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-semibold text-indigo-700 bg-slate-50/30">{row.nt}</td>
                      <td className="px-4 py-2 text-slate-700">{row.set}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* Row 3: Parsing Table */}
        <SectionCard title="④ Parsing Table M[NT, terminal]">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-500 border-r border-slate-200 w-16 text-center">NT</th>
                      <th className="px-4 py-3 font-mono font-semibold text-slate-700 w-1/4">a</th>
                      <th className="px-4 py-3 font-mono font-semibold text-slate-700 w-1/4">b</th>
                      <th className="px-4 py-3 font-mono font-semibold text-slate-700 w-1/4">c</th>
                      <th className="px-4 py-3 font-mono font-semibold text-slate-700 w-1/4">$</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {PARSING_TABLE.map((row, i) => (
                      <tr key={i} className={row.isConflict ? "bg-amber-50/30" : "hover:bg-slate-50/50"}>
                        <td className="px-4 py-3 font-bold text-indigo-700 bg-slate-50/50 border-r border-slate-200 text-center">{row.nt}</td>
                        <td className="px-4 py-3 text-slate-600">{row.a}</td>
                        <td className="px-4 py-3 text-slate-600">{row.b}</td>
                        <td className={`px-4 py-3 ${row.isConflict ? 'text-amber-700 font-semibold' : 'text-slate-600'}`}>
                          {row.c}
                          {row.isConflict && (
                            <span className="ml-2 inline-flex items-center group relative cursor-help">
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-xs font-sans rounded shadow-lg z-10 text-center">
                                Conflict resolved: chose ε over CB' to allow outer C to match
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.$}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Row 4: Step-by-Step Parsing Trace */}
        <SectionCard 
          title="⑤ Step-by-Step Parsing Trace" 
          subtitle="Interactive execution of input string 'abbcc'"
          className="border-indigo-100 shadow-md ring-1 ring-indigo-500/5"
        >
          {/* Stepper Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <button 
                onClick={handlePrev} 
                disabled={currentStep === 0}
                className="p-2 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <button 
                onClick={togglePlay}
                className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                  isPlaying 
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200" 
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? "Pause Auto-play" : "Auto-play"}
              </button>
              
              <button 
                onClick={handleNext} 
                disabled={currentStep === PARSE_STEPS.length - 1}
                className="p-2 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-700"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <button 
                onClick={handleReset}
                className="p-2 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors ml-2"
                title="Reset to start"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="font-medium text-slate-600 bg-white px-4 py-1.5 rounded-full border shadow-sm flex items-center gap-2">
              Step <span className="font-mono text-indigo-600">{currentStep + 1}</span> of {PARSE_STEPS.length}
            </div>
          </div>

          {/* Visualization Stage */}
          <div className="grid lg:grid-cols-12 gap-6 mb-8">
            
            {/* Stack Display */}
            <div className="lg:col-span-5 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-semibold text-slate-600 text-sm flex justify-between">
                <span>Stack</span>
                <span className="text-slate-400 font-normal text-xs uppercase tracking-wider">Top → Bottom</span>
              </div>
              <div className="p-6 flex-grow flex items-center justify-center min-h-[140px]">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <AnimatePresence mode="popLayout">
                    {stepData.stack.map((sym, idx) => (
                      <SymbolChip 
                        key={`${sym}-${idx}-${stepData.stack.length}`} 
                        symbol={sym} 
                        isTop={idx === 0} 
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Input Display */}
            <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 font-semibold text-slate-600 text-sm flex justify-between">
                <span>Remaining Input</span>
                <span className="text-slate-400 font-normal text-xs uppercase tracking-wider">Lookahead</span>
              </div>
              <div className="p-6 flex-grow flex items-center justify-center min-h-[140px]">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <AnimatePresence mode="popLayout">
                    {stepData.input.map((sym, idx) => (
                      <SymbolChip 
                        key={`${sym}-${idx}-${stepData.input.length}`} 
                        symbol={sym} 
                        isLookahead={idx === 0} 
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Action Display */}
            <div className={`lg:col-span-3 rounded-xl border overflow-hidden flex flex-col transition-colors duration-300 ${
              stepData.isSuccess ? 'bg-emerald-50 border-emerald-200' :
              stepData.isWarning ? 'bg-amber-50 border-amber-200' :
              'bg-indigo-50 border-indigo-200'
            }`}>
              <div className={`px-4 py-2 border-b font-semibold text-sm transition-colors duration-300 ${
                stepData.isSuccess ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                stepData.isWarning ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}>
                Parser Action
              </div>
              <div className="p-6 flex-grow flex items-center justify-center text-center min-h-[140px]">
                <div className="space-y-3">
                  {stepData.isSuccess && <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />}
                  {stepData.isWarning && <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />}
                  <p className={`font-mono font-medium text-lg ${
                    stepData.isSuccess ? 'text-emerald-700' :
                    stepData.isWarning ? 'text-amber-700' :
                    'text-indigo-700'
                  }`}>
                    {stepData.action}
                  </p>
                </div>
              </div>
            </div>
            
          </div>

          {/* Full Trace Table */}
          <div className="mt-8 rounded-xl border border-slate-200 overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto bg-white relative">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-500 w-16 text-center">Step</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 w-[35%]">Stack</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 w-[20%] text-right">Input</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 pl-8">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[14px]">
                  {PARSE_STEPS.map((row) => (
                    <tr 
                      key={row.step} 
                      className={`transition-colors duration-200 ${
                        currentStep === row.step - 1 
                          ? 'bg-indigo-50/60 shadow-[inset_2px_0_0_0_#4f46e5]' 
                          : 'hover:bg-slate-50/50 opacity-60'
                      }`}
                    >
                      <td className="px-4 py-2.5 text-center text-slate-400 font-sans">{row.step}</td>
                      <td className={`px-4 py-2.5 ${currentStep === row.step - 1 ? 'text-indigo-900 font-medium' : 'text-slate-600'}`}>
                        {row.stack.join(' ')}
                      </td>
                      <td className={`px-4 py-2.5 text-right ${currentStep === row.step - 1 ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                        {row.input.join('')}
                      </td>
                      <td className={`px-4 py-2.5 pl-8 font-sans ${
                        row.isSuccess ? 'text-emerald-600 font-bold' :
                        row.isWarning ? 'text-amber-600 font-medium' :
                        currentStep === row.step - 1 ? 'text-indigo-700 font-medium' : 'text-slate-600'
                      }`}>
                        <span className="flex items-center gap-2">
                          {row.action}
                          {row.isWarning && currentStep === row.step - 1 && <AlertTriangle className="w-3.5 h-3.5" />}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 border-t border-slate-200 mt-12 text-center text-sm font-medium text-slate-500 flex flex-wrap items-center justify-center gap-4">
        <span className="bg-white px-3 py-1 rounded-md border shadow-sm">Input: <strong className="font-mono text-slate-800">abbcc</strong></span>
        <span className="text-slate-300">|</span>
        <span className="bg-white px-3 py-1 rounded-md border shadow-sm flex items-center gap-1.5">Result: <span className="text-emerald-600 font-bold tracking-wide">ACCEPTED</span> <CheckCircle2 className="w-4 h-4 text-emerald-500"/></span>
        <span className="text-slate-300">|</span>
        <span className="bg-white px-3 py-1 rounded-md border shadow-sm">Grammar: LL(1) with conflict resolution</span>
      </footer>
    </div>
  );
}