import { useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function tokenizeLine(line) {
  const keywords = /\b(const|let|var|function|return|if|else|for|while|new|async|await|typeof|class|this|true|false|null|undefined|import|export|default|break|continue|of|in)\b/g;
  const strings = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
  const numbers = /\b\d+(\.\d+)?\b/g;
  const comments = /\/\/.*/g;
  const functions = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;

  // Simple tokenizer: we build an array of {text, type}
  const tokens = [];
  let remaining = line;
  let pos = 0;

  // We'll do a simplified pass: just return the line with HTML
  let html = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Apply in order: comments first (highest priority)
  html = html.replace(/(\/\/.*)/g, '<span class="tok-comment">$1</span>');
  // Strings
  html = html.replace(/(["'`][^"'`\n]*["'`])/g, '<span class="tok-string">$1</span>');
  // Keywords (only outside of spans)
  html = html.replace(/\b(const|let|var|function|return|if|else|for|while|new|async|await|typeof|class|this|true|false|null|undefined|import|export|default|break|continue|of|in)\b/g,
    (m) => `<span class="tok-keyword">${m}</span>`);
  // Numbers
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
  // Function names (before parens)
  html = html.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
    (m, name) => `<span class="tok-function">${name}</span>(`);

  return html;
}

export function CodeViewer({ code = '', highlightLines = [], currentLine = null }) {
  const lines = useMemo(() => code.split('\n'), [code]);
  const activeRef = useRef(null);

  useEffect(() => { 
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentLine]);

  return (
    <div className="code-viewer">
      <div className="code-header">
        <div className="code-dots">
          <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
        </div>
        <span className="code-title">script.js</span>
      </div>
      <div className="code-body">
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const isActive = lineNum === currentLine;
          const isHighlighted = highlightLines.includes(lineNum);

          return (
            <div
              key={i}
              ref={isActive ? activeRef : null}
              className={`code-line ${isActive ? 'code-line-active' : ''} ${isHighlighted && !isActive ? 'code-line-highlight' : ''}`}
            >
              {isActive && (
                <motion.div
                  layoutId="cursor"
                  className="code-cursor"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className="line-num">{lineNum}</span>
              <span
                className="line-content"
                dangerouslySetInnerHTML={{ __html: tokenizeLine(line) || '&nbsp;' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
