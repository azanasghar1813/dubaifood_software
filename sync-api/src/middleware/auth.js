import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export const requireDeviceAuth = (req, res, next) => {
  const deviceSecret = req.headers['x-device-secret'];
  if (!deviceSecret || deviceSecret !== config.deviceSecret) {
    return res.status(401).json({ error: 'Unauthorized device' });
  }
  next();
};

export const requireUserAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
