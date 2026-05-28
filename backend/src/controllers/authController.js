import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

const createToken = (id) =>
  jwt.sign({ id }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });

const tokenCookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "lax"
};

const userPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role
});

export const signup = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (!["teacher", "student"].includes(role)) {
    return res.status(400).json({ message: "Role must be teacher or student." });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(409).json({ message: "Email already registered." });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: await bcrypt.hash(password, 10),
    role
  });

  const token = createToken(user._id);
  res.cookie("token", token, tokenCookieOptions);
  res.status(201).json({ token, user: userPayload(user) });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email?.toLowerCase() });

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const isMatch = await bcrypt.compare(password || "", user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = createToken(user._id);
  res.cookie("token", token, tokenCookieOptions);
  res.json({ token, user: userPayload(user) });
};

export const getMe = async (req, res) => {
  res.json({ user: req.user });
};

export const logout = async (req, res) => {
  res.clearCookie("token", tokenCookieOptions);
  res.json({ message: "Logged out successfully." });
};
