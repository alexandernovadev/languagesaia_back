import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../../db/models/User";
import logger from "../../utils/logger";

dotenv.config({ quiet: true });

export const seedAdminUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL!);

    const username = process.env.USER_NOVA;
    const password = process.env.PASSWORD_NOVA;

    if (!username || !password) {
      throw new Error("USER_NOVA and PASSWORD_NOVA environment variables are required");
    }

    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      await User.deleteOne({ role: "admin", username: existingAdmin.username });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const adminUser = new User({
      username,
      email: "admin@example.com",
      password: hashedPassword,
      role: "admin",
      firstName: "System",
      lastName: "Administrator",
      isActive: true,
    });

    logger.info("Admin user seeded successfully.", adminUser);
    return await adminUser.save();
  } catch (error) {
    logger.error("Error seeding admin user:", error);
    throw new Error("Failed to seed admin user");
  } finally {
    mongoose.connection.close();
  }
};
