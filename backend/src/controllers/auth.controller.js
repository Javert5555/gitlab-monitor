const { User } = require('../models/index.model');
const { signToken } = require('../utils/jwt');
const { comparePasswords, hashPassword } = require('../utils/password');

module.exports = {
  register: async (req, res) => {
    const { email, password } = req.body;

    const exist = await User.findOne({ where: { email } });
    if (exist) return res.status(400).json({ message: 'Email already used' });

    const passwordHash = await hashPassword(password);

    const user = await User.create({ email, passwordHash });

    return res.json({ message: 'User registered', userId: user.id });
  },

  login: async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await comparePasswords(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid password' });

    const token = signToken({ userId: user.id });

    return res.json({ token });
  }
};