/**
 * Phase 2: WebSocket Service
 * Handles real-time communication for chat, signals, market data, and notifications
 */
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> Set of socket ids
  }

  /**
   * Initialize Socket.io with the HTTP server
   */
  initialize(server) {
    const { Server } = require('socket.io');
    
    this.io = new Server(server, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:5173',
          process.env.FRONTEND_URL,
          process.env.CLIENT_URL
        ].filter(Boolean),
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingInterval: 25000,
      pingTimeout: 10000
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.id);
        
        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }

        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket service initialized');
    return this.io;
  }

  handleConnection(socket) {
    const userId = socket.user.id;
    
    // Track connected user
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId).add(socket.id);

    logger.info(`User connected: ${socket.user.email} (${this.connectedUsers.size} users online)`);

    // Join personal room for notifications
    socket.join(`user:${userId}`);

    // ─── Chat Events ───
    socket.on('chat:join', (roomId) => {
      socket.join(`chat:${roomId}`);
      logger.debug(`${socket.user.email} joined chat room ${roomId}`);
    });

    socket.on('chat:leave', (roomId) => {
      socket.leave(`chat:${roomId}`);
    });

    socket.on('chat:message', (data) => {
      // Emit to room (actual saving handled by REST API)
      this.io.to(`chat:${data.roomId}`).emit('chat:newMessage', {
        ...data,
        sender: {
          id: socket.user.id,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          role: socket.user.role
        },
        timestamp: new Date().toISOString()
      });
    });

    socket.on('chat:typing', (data) => {
      socket.to(`chat:${data.roomId}`).emit('chat:typing', {
        userId: socket.user.id,
        firstName: socket.user.firstName,
        isTyping: data.isTyping
      });
    });

    // ─── Scanner/Signal Events ───
    socket.on('scanner:subscribe', () => {
      socket.join('scanner:signals');
    });

    socket.on('scanner:unsubscribe', () => {
      socket.leave('scanner:signals');
    });

    // ─── Market Data Events ───
    socket.on('market:subscribe', (pairs) => {
      if (Array.isArray(pairs)) {
        pairs.forEach(pair => socket.join(`market:${pair}`));
      }
    });

    socket.on('market:unsubscribe', (pairs) => {
      if (Array.isArray(pairs)) {
        pairs.forEach(pair => socket.leave(`market:${pair}`));
      }
    });

    // ─── Disconnect ───
    socket.on('disconnect', () => {
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
        }
      }
      logger.debug(`User disconnected: ${socket.user.email}`);
    });
  }

  // ─── Broadcast Methods ───

  /**
   * Send signal to all subscribed users
   */
  broadcastSignal(signal) {
    if (this.io) {
      this.io.to('scanner:signals').emit('scanner:newSignal', signal);
      logger.info(`Signal broadcast: ${signal.pair} ${signal.signalType}`);
    }
  }

  /**
   * Send market data update
   */
  broadcastMarketData(pair, data) {
    if (this.io) {
      this.io.to(`market:${pair}`).emit('market:update', { pair, ...data });
    }
  }

  /**
   * Send notification to a specific user
   */
  sendNotification(userId, notification) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification', notification);
    }
  }

  /**
   * Broadcast to all connected users
   */
  broadcastAll(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  /**
   * Send economic calendar alert
   */
  broadcastCalendarAlert(alert) {
    if (this.io) {
      this.io.emit('calendar:alert', alert);
    }
  }

  /**
   * Get online user count
   */
  getOnlineCount() {
    return this.connectedUsers.size;
  }

  /**
   * Check if a specific user is online
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }
}

// Singleton instance
const wsService = new WebSocketService();
module.exports = wsService;
