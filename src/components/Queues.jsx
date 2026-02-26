import { AnimatePresence, motion } from 'framer-motion';
import { ListTodo, Zap } from 'lucide-react';

function QueuePanel({ items, title, icon: Icon, color, glowClass }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <Icon size={16} className={color} />
        <span>{title}</span>
        <span className="badge">{items.length}</span>
      </div>
      <div className="panel-body queue-body">
        <AnimatePresence>
          {items.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state">
              empty
            </motion.div>
          ) : (
            items.map((item, i) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className={`queue-item ${glowClass} ${i === 0 ? 'queue-item-front' : ''}`}
              >
                <span className="queue-pos">{i === 0 ? '→' : i + 1}</span>
                <span className="queue-name">{item.name}</span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function TaskQueue({ tasks = [] }) {
  return (
    <QueuePanel
      items={tasks}
      title="Task Queue"
      icon={ListTodo}
      color="text-amber-400"
      glowClass="task-glow"
    />
  );
}

export function MicroTaskQueue({ tasks = [] }) {
  return (
    <QueuePanel
      items={tasks}
      title="Microtask Queue"
      icon={Zap}
      color="text-green-400"
      glowClass="microtask-glow"
    />
  );
}
