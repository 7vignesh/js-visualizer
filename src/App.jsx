import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Pause, RotateCcw, Code2, Sparkles, Moon, Sun
} from 'lucide-react';
import { interpret } from './interpreter/interpreter';
import { CallStack } from './components/CallStack';
import { WebAPIs } from './components/WebAPIs';
import { TaskQueue, MicroTaskQueue } from './components/Queues';
import { EventLoopDiagram } from './components/EventLoop';
import { CodeViewer } from './components/CodeViewer';
import { ConsoleOutput } from './components/Console';
import { SAMPLES } from './samples';

const DEFAULT_CODE = SAMPLES[2].code;

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [steps, setSteps] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(800);
  const [showEditor, setShowEditor] = useState(true);
  const [selectedSample, setSelectedSample] = useState(2);
  const autoRef = useRef(null);
  const [hasRun, setHasRun] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('visualizer-theme');
    return saved || 'dark';
  });

  const currentStep = steps[stepIndex] ?? null;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  const handleRun = useCallback(() => {
    const result = interpret(code);
    setSteps(result);
    setStepIndex(0);
    setIsRunning(true);
    setHasRun(true);
    setAutoPlay(false);
  }, [code]);

  const handleReset = useCallback(() => {
    setSteps([]);
    setStepIndex(0);
    setIsRunning(false);
    setAutoPlay(false);
    setHasRun(false);
    if (autoRef.current) clearInterval(autoRef.current);
  }, []);

  const goNext = useCallback(() => {
    setStepIndex(i => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const goPrev = useCallback(() => {
    setStepIndex(i => Math.max(i - 1, 0));
  }, []);

  const goFirst = useCallback(() => setStepIndex(0), []);
  const goLast = useCallback(() => setStepIndex(steps.length - 1), [steps.length]);

  useEffect(() => {
    if (autoPlay && isRunning) {
      autoRef.current = setInterval(() => {
        setStepIndex(i => {
          if (i >= steps.length - 1) {
            setAutoPlay(false);
            clearInterval(autoRef.current);
            return i;
          }
          return i + 1;
        });
      }, autoSpeed);
    } else {
      clearInterval(autoRef.current);
    }
    return () => clearInterval(autoRef.current);
  }, [autoPlay, isRunning, steps.length, autoSpeed]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('visualizer-theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
      if (e.key === ' ') { e.preventDefault(); setAutoPlay(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  const loadSample = (index) => {
    setSelectedSample(index);
    setCode(SAMPLES[index].code);
    handleReset();
  };

  const progress = steps.length > 1 ? (stepIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <Sparkles size={20} className="logo-icon" />
            <span className="logo-text">JS / TS Visualizer</span>
            <span className="logo-badge">v2</span>
          </div>
          <div className="sample-pills">
            {SAMPLES.map((s, i) => (
              <button
                key={i}
                onClick={() => loadSample(i)}
                className={`sample-pill ${selectedSample === i ? 'active' : ''} ${s.lang === 'ts' ? 'ts-pill' : ''}`}
              >
                {s.lang === 'ts' && <span className="ts-label">TS</span>}
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="header-right">
          <span className="shortcut-hint">← → navigate · Space play/pause</span>
          <button
            className="toggle-theme-btn"
            onClick={toggleTheme}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className={`toggle-editor-btn ${showEditor ? 'active' : ''}`}
            onClick={() => setShowEditor(p => !p)}
            title="Toggle editor"
          >
            <Code2 size={16} />
          </button>
        </div>
      </header>

      <main className={`main-layout ${showEditor ? 'with-editor' : 'no-editor'}`}>
        <AnimatePresence>
          {showEditor && (
            <motion.aside
              className="editor-pane"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="editor-header">
                <span>Editor</span>
                <button className="run-btn" onClick={handleRun}>
                  <Play size={14} />
                  Run
                </button>
              </div>
              <textarea
                className="code-textarea"
                value={code}
                onChange={e => { setCode(e.target.value); handleReset(); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); handleRun(); }
                }}
                spellCheck={false}
                placeholder="Paste your JavaScript here... (Shift+Enter to run)"
              />
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="visualizer-area">
          {!hasRun ? (
            <div className="splash">
              <motion.div
                className="splash-content"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                <div className="splash-icon">
                  <Sparkles size={48} />
                </div>
                <h1>JavaScript &amp; TypeScript Visualizer</h1>
                <p>
                  Paste any <strong>JavaScript</strong> or <strong>TypeScript</strong> code in the editor,
                  pick a sample, then click <strong>Run</strong> to watch the Call Stack, Web APIs,
                  Task Queue, Microtask Queue and Event Loop animate step by step.
                  TypeScript types, interfaces and enums are fully supported.
                </p>
                <button className="splash-run-btn" onClick={handleRun}>
                  <Play size={18} />
                  Run Sample Code
                </button>
                <div className="shortcut-grid">
                  <span>← → Arrow Keys</span><span>Step through execution</span>
                  <span>Space</span><span>Auto-play / pause</span>
                </div>
              </motion.div>
            </div>
          ) : (
            <>
              <div className="progress-bar-wrap">
                <motion.div
                  className="progress-bar"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
                <span className="progress-label">Step {stepIndex + 1} / {steps.length}</span>
              </div>

              {/* Step description banner */}
              <motion.div
                key={currentStep?.description}
                className={`step-banner phase-${currentStep?.phase ?? 'sync'}`}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <span className="step-phase-dot" />
                <span className="step-desc">{currentStep?.description ?? '...'}</span>
                <span className="step-phase-tag">{currentStep?.phase ?? 'sync'}</span>
              </motion.div>

              <div className="viz-grid">
                <div className="viz-code">
                  <CodeViewer
                    code={code}
                    highlightLines={currentStep?.highlightLines ?? []}
                    currentLine={currentStep?.currentLine ?? null}
                  />
                </div>
                <div className="viz-callstack">
                  <CallStack frames={currentStep?.callStack ?? []} />
                </div>
                <div className="viz-eventloop">
                  <EventLoopDiagram
                    phase={currentStep?.phase ?? 'sync'}
                    description={currentStep?.description ?? ''}
                  />
                </div>
                <div className="viz-webapis">
                  <WebAPIs apis={currentStep?.webAPIs ?? []} />
                </div>
                <div className="viz-taskqueue">
                  <TaskQueue tasks={currentStep?.taskQueue ?? []} />
                </div>
                <div className="viz-microtask">
                  <MicroTaskQueue tasks={currentStep?.microtaskQueue ?? []} />
                </div>
                <div className="viz-console">
                  <ConsoleOutput output={currentStep?.consoleOutput ?? []} />
                </div>
              </div>

              <div className="controls">
                <button className="ctrl-btn" onClick={handleReset} title="Reset">
                  <RotateCcw size={16} />
                </button>
                <div className="ctrl-divider" />
                <button className="ctrl-btn" onClick={goFirst} disabled={isFirstStep} title="First step">
                  <SkipBack size={16} />
                </button>
                <button className="ctrl-btn" onClick={goPrev} disabled={isFirstStep} title="Previous">
                  <ChevronLeft size={16} />
                </button>
                <button
                  className={`ctrl-btn play-btn ${autoPlay ? 'playing' : ''}`}
                  onClick={() => setAutoPlay(p => !p)}
                >
                  {autoPlay ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button className="ctrl-btn" onClick={goNext} disabled={isLastStep} title="Next">
                  <ChevronRight size={16} />
                </button>
                <button className="ctrl-btn" onClick={goLast} disabled={isLastStep} title="Last step">
                  <SkipForward size={16} />
                </button>
                <div className="ctrl-divider" />
                <div className="speed-control">
                  <span>Speed</span>
                  <input
                    type="range" min={200} max={2000} step={100}
                    value={autoSpeed}
                    onChange={e => setAutoSpeed(Number(e.target.value))}
                  />
                  <span>{autoSpeed}ms</span>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
