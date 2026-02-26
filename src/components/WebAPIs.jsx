import { AnimatePresence, motion } from 'framer-motion';
import { Globe } from 'lucide-react';

export function WebAPIs({ apis = [] }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <Globe size={16} className="text-cyan-400" />
        <span>Web APIs</span>
        <span className="badge">{apis.length}</span>
      </div>
      <div className="panel-body">
        <AnimatePresence>
          {apis.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state">
              idle
            </motion.div>
          ) : (
            apis.map(api => (
              <motion.div
                key={api.id}
                layout
                initial={{ opacity: 0, scale: 0.8, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="api-item"
              >
                <div className="api-icon">⏱</div>
                <div className="api-info">
                  <span className="api-name">{api.name}</span>
                  <span className="api-delay">{api.delay}ms</span>
                </div>
                <div className="api-pulse" />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
