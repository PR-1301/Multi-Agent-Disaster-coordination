const EventEmitter = require('events');
const EventLog = require('../models/EventLog');
const config = require('../config/adminAgentConfig');

class AgentBus extends EventEmitter {
  constructor() {
    super();
    this.io = null;
    this.logBuffer = [];
    this.flushInterval = setInterval(() => this.flushLogs(), config.EVENT_LOG_BATCH_INTERVAL_MS || 2000);
  }

  setIO(io) {
    this.io = io;
  }

  attachIO(io) {
    this.io = io;
  }

  async flushLogs() {
    if (this.logBuffer.length === 0) return;
    const batch = [...this.logBuffer];
    this.logBuffer = [];
    try {
      const start = Date.now();
      await EventLog.insertMany(batch);
      this.lastDbLatency = Date.now() - start;
    } catch (e) {
      console.error('[agentBus] Failed to insert EventLog batch:', e);
    }
  }

  emitEvent(eventName, caseId, payload) {
    try {
      this.emit(eventName, { case_id: caseId, payload });
      
      const criticalEvents = ['case.created', 'assignment.confirmed', 'assignment.failed', 'escalation.raised'];
      
      if (criticalEvents.includes(eventName)) {
        EventLog.create({
          case_id: caseId,
          event: eventName,
          payload
        }).catch(err => console.error('Failed to log event', err));
      } else {
        this.logBuffer.push({
          case_id: caseId,
          event: eventName,
          payload,
          timestamp: new Date()
        });
        if (this.logBuffer.length >= (config.EVENT_LOG_BATCH_SIZE || 100)) {
          this.flushLogs();
        }
      }

      if (this.io) {
        if (eventName === 'incident.severity_raised' || eventName === 'capacity.risk_raised' || eventName === 'circuit.state_changed') {
          this.io.emit('admin-alert', { event: eventName, case_id: caseId, payload });
        } else {
          this.io.emit('case-update', { event: eventName, case_id: caseId });
        }
      }
    } catch (error) {
      console.error(`[agentBus] Error emitting event ${eventName}`, error);
    }
  }
}

module.exports = new AgentBus();
