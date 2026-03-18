const DEFAULTS = {
  username: "admin",
  email: "admin@polly.local",
  password: "Admin123!",
};

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || DEFAULTS.username;
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || DEFAULTS.email;
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULTS.password;
