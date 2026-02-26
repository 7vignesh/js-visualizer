import { motion } from 'framer-motion';

const phases = {
  sync: { label: 'Synchronous', color: '#818cf8', bg: 'rgba(129,140,248,0.15)' },
  webapi: { label: 'Web API', color: '#22d3ee', bg: 'rgba(34,211,238,0.15)' },
  taskqueue: { label: 'Task Queue', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  microtask: { label: 'Microtask', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  eventloop: { label: 'Event Loop', color: '#f472b6', bg: 'rgba(244,114,182,0.15)' },
  done: { label: 'Complete', color: '#a3e635', bg: 'rgba(163,230,53,0.15)' },
};

export function EventLoopDiagram({ phase = 'sync', description = '' }) {
  const current = phases[phase] || phases.sync;

  return (
    <div className="eventloop-container">
      <div className="eventloop-label">Event Loop</div>

      {/* Animated ring */}
      <div className="eventloop-ring-wrap">
        <svg viewBox="0 0 120 120" className="eventloop-svg">
          {/* background ring */}
          <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          {/* animated progress ring */}
          <motion.circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke={current.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="314"
            animate={{
              strokeDashoffset: [314, 0],
              opacity: [0.6, 1],
            }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            style={{ transformOrigin: '60px 60px', transform: 'rotate(-90deg)' }}
          />
          {/* Arrow head indicator */}
          <motion.circle
            cx="60"
            cy="10"
            r="5"
            fill={current.color}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </svg>

        {/* Center label */}
        <motion.div
          className="eventloop-center"
          animate={{ backgroundColor: current.bg }}
          transition={{ duration: 0.4 }}
          style={{ color: current.color }}
        >
          <motion.span
            key={phase}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="eventloop-phase-text"
          >
            {current.label}
          </motion.span>
        </motion.div>
      </div>

      {/* Description */}
      <motion.div
        key={description}
        className="eventloop-desc"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ borderColor: current.color + '50' }}
      >
        {description || 'Waiting...'}
      </motion.div>
    </div>
  );
}
