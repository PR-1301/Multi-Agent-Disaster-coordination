require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');

// Import services and agents
const agentBus = require('./services/agentBus');
require('./agents/complaintAgent');
require('./agents/adminAgent');
require('./agents/hospitalAgent');
require('./agents/ngoAgent');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Middleware
app.use(cors());
app.use(express.json());

// Attach io to agentBus
agentBus.attachIO(io);

// Routes
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/hospitals', require('./routes/hospitals'));
app.use('/api/ngos', require('./routes/ngos'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/escalations', require('./routes/escalations'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/public', require('./routes/public'));

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Database and Server Start
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/disaster-coordination';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB', err);
  });
