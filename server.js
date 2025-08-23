const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// In-memory OTP store: { email: { otp: '123456', expiresAt: 1692800000 } }
const otpStore = {};

// Generate and send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiry = Date.now() + 5 * 60 * 1000; // OTP valid for 5 minutes
  otpStore[email] = { otp, expiresAt: expiry };

  // Configure nodemailer (use environment variables in production)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'muralisai2004@gmail.com', // Your email
      pass: process.env.EMAIL_PASS || 'vggc wjtq arxd jins'       // Your app password
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER || 'muralisai2004@gmail.com',
    to: email,
    subject: 'Your Wallet Verification OTP',
    text: `Your OTP for wallet creation is: ${otp}\n\nThis code will expire in 5 minutes.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}: ${otp}`);
    res.json({ status: 'success', message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  const record = otpStore[email];
  if (!record) return res.status(404).json({ verified: false, message: 'No OTP found for this email' });

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(410).json({ verified: false, message: 'OTP expired' });
  }

  if (record.otp === otp) {
    delete otpStore[email]; // Clear OTP after verification
    res.json({ verified: true, message: 'OTP verified successfully' });
  } else {
    res.status(401).json({ verified: false, message: 'Invalid OTP' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
