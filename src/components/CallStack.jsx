import { AnimatePresence, motion } from 'framer-motion';
import { Layers } from 'lucide-react';

const typeColors = {
  global: 'from-violet-600/30 to-violet-800/20 border-violet-500/50',
  function: 'from-blue-600/30 to-blue-800/20 border-blue-500/50',
  task: 'from-amber-600/30 to-amber-800/20 border-amber-500/50',
  microtask: 'from-green-600/30 to-green-800/20 border-green-500/50',
};

const typeBadge = {
  global: 'bg-violet-500/30 text-violet-300',
  function: 'bg-blue-500/30 text-blue-300',
  task: 'bg-amber-500/30 text-amber-300',
  microtask: 'bg-green-500/30 text-green-300',
};

export function CallStack({ frames = [] }) {
  const reversed = [...frames].reverse();

  return (
    <div className="panel">
      <div className="panel-header">
        <Layers size={16} className="text-blue-400" />
        <span>Call Stack</span>
        <span className="badge">{frames.length}</span>
      </div>
      <div className="panel-body stack-body">
        <AnimatePresence mode="sync">
          {reversed.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-state"
            >
              empty
            </motion.div>
          ) : (
            reversed.map((frame, i) => (
              <motion.div
                key={frame.id}
                layout
                initial={{ opacity: 0, x: -30, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 30, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`stack-frame bg-gradient-to-r border ${typeColors[frame.type] || typeColors.function} ${i === 0 ? 'ring-1 ring-blue-400/60' : ''}`}
              >
                <div className="frame-top">
                  <span className="frame-name">{frame.name}</span>
                  <span className={`type-badge ${typeBadge[frame.type] || typeBadge.function}`}>
                    {frame.type}
                  </span>
                </div>
                {frame.variables?.length > 0 && (
                  <div className="frame-vars">
                    {frame.variables.map(v => (
                      <span key={v.name} className="frame-var">
                        <span className="var-name">{v.name}</span>
                        <span className="var-sep">:</span>
                        <span className="var-value">{v.value}</span>
                      </span>
                    ))}
                  </div>
                )}
                {i === 0 && (
                  <div className="active-indicator">
                    <span className="dot" />
                    <span className="active-label">executing</span>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
