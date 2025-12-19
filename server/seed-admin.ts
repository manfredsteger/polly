import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

const INITIAL_ADMIN = {
  username: "admin",
  email: "admin@kita-poll.local",
  password: "Admin123!",
  name: "Initial Administrator",
};

async function seedInitialAdmin() {
  try {
    const existingAdmin = await db.select().from(users).where(eq(users.username, INITIAL_ADMIN.username)).limit(1);
    
    if (existingAdmin.length > 0) {
      console.log("✓ Initial admin already exists, skipping...");
      return;
    }

    const passwordHash = await bcrypt.hash(INITIAL_ADMIN.password, 10);
    
    await db.insert(users).values({
      username: INITIAL_ADMIN.username,
      email: INITIAL_ADMIN.email,
      name: INITIAL_ADMIN.name,
      passwordHash,
      role: "admin",
      provider: "local",
      isInitialAdmin: true,
    });

    console.log("✓ Initial admin created successfully");
    console.log("  Username: " + INITIAL_ADMIN.username);
    console.log("  Password: " + INITIAL_ADMIN.password);
    console.log("  ⚠️  Please change these credentials after first login!");
    
  } catch (error) {
    console.error("Error creating initial admin:", error);
    throw error;
  }
}

seedInitialAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
