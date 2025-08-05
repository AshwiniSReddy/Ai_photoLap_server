require("dotenv").config();
const path        = require("path");
const express     = require("express");
const nodemailer  = require("nodemailer");
const cors        = require("cors");
const sharp       = require("sharp");

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

// ——— Nodemailer + SMTP setup ————————————————————
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  },
  pool:           true,
  maxConnections: 5,
  maxMessages:    100
});

transporter.verify(err => {
  if (err) console.error("❌ SMTP setup error:", err);
  else      console.log("✅ SMTP is ready");
});
// ————————————————————————————————————————————

// Path to your watermark logo (PNG with transparency)
const logoPath = path.join(__dirname, "Paramlogo.png");

// ——— /send-art route —————————————————————————
app.post("/send-art", async (req, res) => {
  const { email, image } = req.body;
  console.log(email)
  if (!email || !image) {
    return res.status(400).send("Missing email or image data");
  }

  try {
    console.log(image)
    // 1️⃣ decode the base64 client image
    const base64Data = image.replace(/^data:image\/png;base64,/, "");
    const userBuffer = Buffer.from(base64Data, "base64");

    // 2️⃣ composite watermark via sharp
    const [imgMeta, logoMeta] = await Promise.all([
      sharp(userBuffer).metadata(),
      sharp(logoPath).metadata()
    ]);

    const M = 20;  // margin
    // const left = imgMeta.width  - logoMeta.width  - M;
    // const top  = imgMeta.height - logoMeta.height - M;

    // const compositedBuffer = await sharp(userBuffer)
    //   .composite([{
    //     input: logoPath,
    //     left,
    //     top
    //   }])
    //   .png()
    //   .toBuffer();
    // Resize logo to fit within 25% of user image width
const maxLogoWidth = imgMeta.width * 0.25;

const resizedLogoBuffer = await sharp(logoPath)
  .resize({ width: Math.round(maxLogoWidth) }) // preserve aspect ratio
  .toBuffer();

// const compositedBuffer = await sharp(userBuffer)
//   .composite([{
//     input: resizedLogoBuffer,
//     gravity: "southeast",
//     blend: "over"
//   }])
//   .png()
//   .toBuffer();

// Get new logo size
const resizedLogoMeta = await sharp(resizedLogoBuffer).metadata();

// const M = 20;
const left = imgMeta.width  - resizedLogoMeta.width  - M;
const top  = imgMeta.height - resizedLogoMeta.height - M;

const compositedBuffer = await sharp(userBuffer)
  .composite([{
    input: resizedLogoBuffer,
    left,
    top
  }])
  .png()
  .toBuffer();



    // 3️⃣ send email with the composited PNG
    // await transporter.sendMail({
    //   from:       process.env.GMAIL_USER,
    //   to:         email,
    //   subject:    "Your Rangolify Art 🎨",
    //   html:       `
    //     <div style="font-family:sans-serif; line-height:1.4; color:#333">
    //       <p>Hey Artist!</p>
    //       <p>Thanks for visiting the <strong>Param Science Experience Centre</strong>.<br>
    //          Attached here is your own unique Rangoli! 😊
    //       </p>
    //       <p><a href="https://paraminnovation.org"
    //             style="color:#007aff; text-decoration:none">
    //          Visit our website
    //       </a></p>
    //     </div>
    //   `,
    //   attachments: [{
    //     filename:    "rangoli.png",
    //     content:     compositedBuffer,
    //     contentType: "image/png"
    //   }]
    // });
    // 3️⃣ send email with the composited PNG
await transporter.sendMail({
  from:       process.env.GMAIL_USER,
  to:         email,
  subject:    "Thanks for Visiting Science Snap Lab! Your AI Avatar Awaits",
  html:       `
    <div style="font-family:sans-serif; line-height:1.6; color:#333">
      <p>Hello Science Adventurer!</p>
      <p>Thanks for stepping into the <strong>Science Snap Lab</strong> and unleashing your inner persona.</p>
      <p>We hope you had a blast transforming your selfie into a one-of-a-kind avatar—Explorer, Eco Hero, Tech Whiz, or Time Traveler.</p>
      <p>Your custom AI-generated avatar is attached and ready to download or share with friends and family. Flaunt your new look and spark curiosity everywhere you go!</p>
      <p>Stay tuned for the latest updates, upcoming events, and fresh ways to keep exploring science with us.</p>
      <p>Questions, feedback, or ideas? Just hit reply—we’d love to hear from you.</p>
      <p style="margin-top: 1.5em;">Best regards,<br><strong>Team PARSEC</strong></p>
    </div>
  `,
  attachments: [{
    filename:    "rangoli.png",
    content:     compositedBuffer,
    contentType: "image/png"
  }]
});


    res.send("OK");
  } catch (err) {
    console.error("❌ /send-art error:", err);
    res.status(500).send("ERROR: " + err.message);
  }
});

// ——— start the server —————————————————————————
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Email API listening on port ${PORT}`)
);
