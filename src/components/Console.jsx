import { motion, AnimatePresence } from 'framer-motion';
import { Terminal } from 'lucide-react';

export function ConsoleOutput({ output = [] }) {
  return (
    <div className="panel console-panel">
      <div className="panel-header">
        <Terminal size={16} className="text-gray-400" />
        <span>Console Output</span>
      </div>
      <div className="panel-body console-body">
        <AnimatePresence>
          {output.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state console-empty">
              No output yet
            </motion.div>
          ) : (
            output.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="console-line"
              >
                <span className="console-chevron">›</span>
                <span>{line}</span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
