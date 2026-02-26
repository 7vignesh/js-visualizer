import { useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function tokenizeLine(line) {
  // We'll do a simplified pass: return the line with HTML spans
  let html = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 1. Comments (highest priority)
  html = html.replace(/(\/\/.*)/g, '<span class="tok-comment">$1</span>');
  // 2. Strings
  html = html.replace(/(["'`][^"'`\n]*["'`])/g, '<span class="tok-string">$1</span>');
  // 3. TS/JS keywords (expanded for TypeScript)
  html = html.replace(/\b(const|let|var|function|return|if|else|for|while|new|async|await|typeof|class|this|true|false|null|undefined|import|export|default|break|continue|of|in|interface|type|enum|namespace|implements|extends|abstract|readonly|declare|keyof|infer|is|as|satisfies|public|private|protected|static|override|get|set|switch|case|try|catch|finally|throw|void|never|unknown|any)\b/g,
    (m) => `<span class="tok-keyword">${m}</span>`);
  // 4. Type annotations after colon (:  SomeType)
  html = html.replace(/:\s*([A-Z][a-zA-Z0-9_]*(?:&lt;[^&]*&gt;)?)/g,
    (m, type) => `: <span class="tok-type">${type}</span>`);
  // 5. Numbers
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
  // 6. Known type names at start of generic or after extends/implements
  html = html.replace(/\b(string|number|boolean|void|never|unknown|any|object|Array|Promise|Record|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|Map|Set)\b/g,
    '<span class="tok-type">$1</span>');
  // 7. Function names (before parens)
  html = html.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
    (m, name) => `<span class="tok-function">${name}</span>(`);
  // 8. Decorators
  html = html.replace(/@([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    '<span class="tok-decorator">@$1</span>');

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
        <span className="code-title">script.tsx</span>
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
