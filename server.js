require("dotenv").config();
const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const sharp = require("sharp");

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

// ——— Nodemailer + SMTP setup ————————————————————
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

transporter.verify((err) => {
  if (err) console.error("❌ SMTP setup error:", err);
  else console.log("✅ SMTP is ready");
});

// Path to your watermark logo (PNG with transparency)
const logoPath = path.join(__dirname, "Paramlogo.png");

// ——— /send-art route —————————————————————————
app.post("/send-art", async (req, res) => {
  const { email, image } = req.body;
  console.log(email);
  if (!email || !image) {
    return res.status(400).send("Missing email or image data");
  }

  try {
    
    // 1️⃣ decode the base64 client image
    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    const userBuffer = Buffer.from(base64Data, "base64");

    // 2️⃣ composite watermark via sharp
    const [imgMeta, logoMeta] = await Promise.all([
      sharp(userBuffer).metadata(),
      sharp(logoPath).metadata(),
    ]);

    const M = 20; // margin

    const maxLogoWidth = imgMeta.width * 0.25;

    const resizedLogoBuffer = await sharp(logoPath)
      .resize({ width: Math.round(maxLogoWidth) }) // preserve aspect ratio
      .toBuffer();

    // Get new logo size
    const resizedLogoMeta = await sharp(resizedLogoBuffer).metadata();

    // const M = 20;
    const left = imgMeta.width - resizedLogoMeta.width - M;
    const top = imgMeta.height - resizedLogoMeta.height - M;

    const compositedBuffer = await sharp(userBuffer)
      .composite([
        {
          input: resizedLogoBuffer,
          left,
          top,
        },
      ])
      .png()
      .toBuffer();

    // 3️⃣ send email with the composited PNG
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Thanks for Visiting Science Snap Lab! Your AI Avatar Awaits",
      html: `
  <div style="font-family:sans-serif; line-height:1.6; color:#333">
    <p>Hello Science Adventurer!</p>
    <p>Thanks for stepping into the <strong>Science Snap Lab</strong> and unleashing your inner persona.</p>
    <p>We hope you had a blast transforming your selfie into a <strong>one-of-a-kind avatar</strong>.</p>
    <p>Your custom AI-generated avatar is attached and ready to download or share with friends and family. Flaunt your new look and spark curiosity everywhere you go!</p>
    <p>Stay tuned for the latest updates, upcoming events, and fresh ways to keep exploring science with us.</p>
    <p style="margin-top: 1.5em;">Best regards,<br><strong>Team PARSEC</strong></p>
  </div>
`,
      attachments: [
        {
          filename: "snaplab.png",
          content: compositedBuffer,
          contentType: "image/png",
        },
      ],
    });

    res.status(200).json({
      status: "success",
      message: "Avatar sent successfully via email.",
    });
  } catch (err) {
    console.error("❌ /send-art error:", err);

    // Handle known image format issue
    if (
      err.message.includes("Input buffer contains unsupported image format")
    ) {
      return res.status(400).json({
        status: "error",
        message: "Unsupported image format",
        error: err.message,
        hint: "Please upload a valid PNG image.",
      });
    }
    // Default error response
    res.status(500).json({
      status: "error",
      message: "Failed to process and send the avatar image.",
      error: err.message || "Unknown error",
      hint: "Please ensure the image is a valid base64 PNG and try again. If the issue persists, contact support.",
    });
  }
});

// ——— start the server —————————————————————————
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Email API listening on port ${PORT}`));
