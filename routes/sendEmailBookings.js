// api for saving shippings
//api for saving bookings


const express = require('express');
const axios = require('axios');// or native fetch in newer Node versions
const router = express.Router();
const multer = require('multer'); // For handling file uploads
const nodemailer = require("nodemailer")
const airtableBaseId = process.env.AIRTABLE_BASE_ID ;
const airtableToken = process.env.AIRTABLE_API_KEY
const upload = multer({ storage: multer.memoryStorage() }); // keep file in memory

// const headers = {
//   Authorization: `Bearer ${airtableToken}`,
//   'Content-Type': 'application/json'
// };

// You need to implement these helper functions on server too:
function generateShippingRequestID() {
  // Simple example: timestamp + random number
  return 'SHIP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

function generateTrackingStatus() {
  // Example: random tracking code
  return 'TRACK-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// API route: POST /api/submitForm
router.post('/submitForm', upload.single('attachedFile'), async (req, res) => {
  try {
   const {
  fullName,
  email,
  type,
  message,
  productLink,
  size,
  quantity,
  notes,
  requestedDate,
} = req.body;

const quantityNumber = Number(quantity)

    if (!fullName || !email || !type) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const shippingID = generateShippingRequestID();
    const trackingID = generateTrackingStatus();
    const submissionDate = new Date().toISOString().split("T")[0];

    // req.file contains the uploaded file buffer if any
    const productImage = req.file;

    // Note: Upload file to external storage here and get public URL if needed

    if (type === 'Shipping') {
      const fields = {
        "Customer Name": fullName,
        "Shipping Request ID": shippingID,
        "Submission Date": submissionDate,
        "Shipping Address": message || '',
        "Contact Email": email,
        "Shipping Status": "Pending",
        "Tracking Status": trackingID,
      };

      if (requestedDate) fields["Requested Delivery Date"] = requestedDate;

      const response = await axios.post(
        `https://api.airtable.com/v0/${airtableBaseId}/tbllEI3IPKLAqGV5G`,
        { records: [{ fields }] },
        {
          headers: {
            Authorization: `Bearer ${airtableToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.records?.length) {
        return res.status(500).json({ error: "Shipping record failed." });
      }
await sendBookingConfirmation(fullName, email);
return res.json({ message: "Shipping request submitted!" });

    }

    if (type === 'Purchase') {
      if (!productLink) {
        return res.status(400).json({ error: "Product link is required for purchase." });
      }

      // Create shipping record first
      const shippingResponse = await axios.post(
        `https://api.airtable.com/v0/${airtableBaseId}/tbllEI3IPKLAqGV5G`,
        {
          records: [{
            fields: {
              "Customer Name": fullName,
              "Shipping Request ID": shippingID,
              "Submission Date": submissionDate,
              "Shipping Address": '',
              "Contact Email": email,
              "Shipping Status": "Pending",
              "Tracking Status": trackingID,
              "Help Me Buy Requests": productLink,
            },
          }],
        },
        {
          headers: {
            Authorization: `Bearer ${airtableToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!shippingResponse.data.records?.length) {
        return res.status(500).json({ error: "Failed to create shipping for purchase." });
      }

      // Create purchase request record
      const purchaseResponse = await axios.post(
        `https://api.airtable.com/v0/${airtableBaseId}/tblV0mgsltDrPUedg`,
        {
          records: [{
            fields: {
              "Product Link": productLink,
              "Quantity": quantityNumber,
              "Additional Notes": notes || '',
              "Size": size || '',
              "Shipping Request": fullName,
            },
          }],
        },
        {
          headers: {
            Authorization: `Bearer ${airtableToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!purchaseResponse.data.records?.length) {
        return res.status(500).json({ error: "Purchase record failed." });
      }
await sendBookingConfirmation(fullName, email);
      return res.json({ message: "Purchase request submitted!" });
    }

    return res.status(400).json({ error: "Invalid request type." });

  } catch (error) {
    console.error("Server submission error:", error.response?.data || error.message || error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

module.exports = router;

// AFTER successful Airtable booking creation, send booking confirmation email

async function sendBookingConfirmation(fullName, email) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "guche9@gmail.com",
      pass: "vfoyifdoahaggsms",
    },
  });

  const mailOptions = {
    from: '"Transvanta" <guche9@gmail.com>',
    to: email,
    subject: "Booking Received - Transvanta",
    html: `
      <body style="margin:0; padding:0; font-family:'Helvetica Neue',Arial,sans-serif; background-color:#f0f0f0;">
        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="max-width:600px; margin:40px auto; background:#ffffff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1); overflow:hidden;">
          <tr>
            <td style="background: rgba(30, 58, 138, 0.95); padding:30px; text-align:center;">
              <img src="https://my-gocardless-pages.onrender.com/IMG-20250616-WA0010.jpg" alt="Transvanta Logo" style="max-height:80px; margin-bottom:20px;">
              <h1 style="color:#ffffff; margin:0; font-size:24px;">Booking Acknowledged</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:30px; text-align:center;">
              <h2 style="color:#1f2937;">Hello ${fullName},</h2>
              <p style="color:#4b5563; font-size:16px; line-height:1.6;">
                We have successfully received your booking request.
              </p>
              <p style="color:#4b5563; font-size:16px; line-height:1.6;">
                Our team is currently reviewing your request, and we will be sending you a detailed quote for pricing shortly.
              </p>
              <p style="color:#4b5563; font-size:16px; line-height:1.6;">
                Thank you for choosing <strong>Transvanta</strong> — We look forward to serving you.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb; padding:20px; text-align:center; font-size:12px; color:#9ca3af;">
              &copy; ${new Date().getFullYear()} Transvanta. All rights reserved.
            </td>
          </tr>
        </table>
      </body>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Booking confirmation email sent to:", email);
  } catch (err) {
    console.error("Error sending booking confirmation email:", err);
  }
}
