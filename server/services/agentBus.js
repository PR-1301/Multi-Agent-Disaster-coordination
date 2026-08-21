const EventEmitter = require('events');
const EventLog = require('../models/EventLog');

class AgentBus extends EventEmitter {
  async emitEvent(eventName, case_id, payload) {
    try {
      // 1. Audit trail
      await EventLog.create({
        case_id,
        event: eventName,
        payload
      });
      console.log(`[agentBus] Emitted: ${eventName} (case: ${case_id})`);
      
      // 2. Broadcast to other agents
      this.emit(eventName, { case_id, payload });

      // 3. Broadcast to frontend via Socket.io if attached
      if (this.io) {
        if (eventName.startsWith('escalation')) {
          this.io.emit('escalation-update', { case_id, eventName, payload });
        } else if (eventName.startsWith('hospital.availability') || eventName.startsWith('ngo.availability')) {
          this.io.emit('resource-update', { eventName, payload });
        } else {
          this.io.emit('case-update', { case_id, eventName, payload });
        }
      }
    } catch (error) {
      console.error(`[agentBus] Error emitting event ${eventName}`, error);
    }
  }

  attachIO(io) {
    this.io = io;
  }
}

const agentBus = new AgentBus();
module.exports = agentBus;
