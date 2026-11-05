import jwt from "jsonwebtoken";
import User from "../../db/models/User";
import { IUser } from "../../../../types/models";
import bcrypt from "bcryptjs";
import logger from "../../utils/logger";
import { JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from "../../../config/constants";

if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  throw new Error("JWT_SECRET and REFRESH_TOKEN_SECRET environment variables must be set");
}

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

export const AuthService = {
  // Generate a JWT token. Identity only: authMiddleware reads the rest from the database.
  generateToken: (user: IUser) => {
    return jwt.sign({ user: { _id: user._id } }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  },

  // Generate a refresh token (longer expiration)
  generateRefreshToken: (user: IUser) => {
    return jwt.sign({ userId: user._id }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  },

  // Verify a JWT token
  verifyToken: (token: string) => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error("Invalid token");
    }
  },

  // Verify a refresh token
  verifyRefreshToken: (refreshToken: string) => {
    try {
      return jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  },

  // Refresh access token using refresh token
  refreshAccessToken: async (refreshToken: string) => {
    try {
      const decoded = AuthService.verifyRefreshToken(refreshToken) as any;
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        throw new Error("User not found");
      }

      const newAccessToken = AuthService.generateToken(user);
      const newRefreshToken = AuthService.generateRefreshToken(user);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          image: user.image,
          language: user.language || 'en',
          explainsLanguage: user.explainsLanguage || 'es',
          isActive: user.isActive,
          address: user.address,
          phone: user.phone,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
      };
    } catch (error) {
      throw new Error("Failed to refresh token");
    }
  },

  validateUserFromDB: async (identifier: string, password: string) => {
    try {
      // Find user by username or email
      const user = await User.findOne({
        $or: [{ username: identifier }, { email: identifier }],
      });

      if (!user) {
        logger.error("User not found", identifier);
        return null;
      }

      // Compare the provided password with the hashed password in the database
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.error("UInvalid password");
        return null;
      }

      return user as IUser; // Return the user object if validation succeeds
    } catch (error) {
      logger.error(error.message || "Authentication failed");
      throw new Error(error.message || "Authentication failed");
    }
  },
};
