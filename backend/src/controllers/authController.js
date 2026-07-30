import { authService } from '../services/authService.js';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  pin: z.string().min(4, 'PIN must be at least 4 digits'),
  deviceInfo: z.string().optional()
});

export const authController = {
  login: (req, res) => {
    try {
      const parsed = loginSchema.parse(req.body);
      const { token, user } = authService.login(parsed.username, parsed.pin, parsed.deviceInfo);
      
      return res.status(200).json({
        message: 'Login successful',
        data: { token, user }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      return res.status(401).json({ error: error.message });
    }
  },

  logout: (req, res) => {
    try {
      authService.logout(req.sessionId, req.user.userId);
      return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
  },

  getMe: (req, res) => {
    // The authenticate middleware already populated req.user
    return res.status(200).json({ data: req.user });
  },

  getUsers: (req, res) => {
    try {
      const users = authService.getActiveUsersForLogin();
      return res.status(200).json({ data: users });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to retrieve users' });
    }
  }
};
