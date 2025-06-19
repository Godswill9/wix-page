const express = require('express');
const router = express.Router();
const axios = require('axios');
const gocardless = require('gocardless-nodejs');
const nodemailer = require('nodemailer');

// Setup GoCardless client
const client = gocardless(process.env.GOCARDLESS_ACCESS_TOKEN, { environment: 'sandbox' });

// Constants
const ADMIN_EMAIL = "guche9@gmail.com";
const EXCHANGE_RATE = 1500;  // Example: 1 USD = 1500 NGN

// Paystack for Nigeria (convert dollars to naira)
router.post('/paystack', async (req, res) => {
  const { email, amount } = req.body;
  const amountInNaira = amount * EXCHANGE_RATE;

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(amountInNaira * 100),
        currency: 'NGN'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const paymentLink = response.data.data.authorization_url;
    await sendPaymentEmail(email, amount, 'Paystack', paymentLink);
    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// GoCardless for UK (no conversion)
router.post('/gocardless', async (req, res) => {
  const { name, email, sess_tok, amount } = req.body;
  const [firstName, ...rest] = name.trim().split(' ');
  const lastName = rest.join(' ') || 'Unknown';
  const session_token = sess_tok;

  try {
    const redirectFlow = await client.redirectFlows.create({
      description: `Direct Debit for $${amount} USD`,
      session_token,
      success_redirect_url: 'https://my-gocardless-pages.onrender.com/loading.html',
      prefilled_customer: {
        given_name: firstName,
        family_name: lastName,
        email
      }
    });

    const paymentLink = redirectFlow.redirect_url;
    await sendPaymentEmail(email, amount, 'GoCardless', paymentLink);
    res.json({
      redirect_url: paymentLink,
      redirect_flow_id: redirectFlow.id,
      session_token
    });
  } catch (err) {
    console.error('GoCardless error:', err);
    res.status(500).json({ error: 'Failed to create redirect flow' });
  }
});


router.post('/paymentCompleted', async (req, res) => {
  const { paymentId, name, email, amount, method } = req.body;

  console.log("Payment completed:", req.body);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "guche9@gmail.com",
      pass: "vfoyifdoahaggsms",  // Secure this properly!
    },
  });

  const emailBody = `
    <body style="font-family: Arial, sans-serif; background: #f7f7f7; padding: 20px;">
      <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2 style="color:#1e3a8a;">New Payment Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Amount:</strong> $${amount} USD</p>
        <p><strong>Payment Platform:</strong> ${method}</p>
        <p><strong>Payment ID:</strong> ${paymentId}</p>
      </div>
    </body>
  `;

  try {
    await transporter.sendMail({
      from: `"Transvanta" <${ADMIN_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: "Payment Completed - Transvanta",
      html: emailBody
    });

    res.json({ message: "Admin notified successfully" });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: "Failed to notify admin" });
  }
});


// Send email to both admin and customer
async function sendPaymentEmail(customerEmail, amount, method, paymentLink) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "guche9@gmail.com",
      pass: "vfoyifdoahaggsms", // Securely store this in env file!
    },
  });

  const emailTemplate = (recipientType) => `
  <body style="margin:0; padding:0; font-family: 'Arial', sans-serif; background-color:#f6f9fc;">
    <table width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding: 40px 0;">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            <tr>
              <td style="background: #1e3a8a; padding: 30px; text-align:center; color:white; border-top-left-radius:8px; border-top-right-radius:8px;">
                <h1>Transvanta</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <h2 style="color:#333;">${recipientType === 'customer' ? 'Your Payment Link is Ready' : 'New Payment Link Created'}</h2>
                <p style="font-size:16px; color:#555;">
                  ${recipientType === 'customer'
                    ? `Dear Customer, your payment link has been generated. Please proceed to complete your payment.`
                    : `A new payment link has been generated by admin.`}
                </p>
                <p><strong>Amount:</strong> $${amount} USD</p>
                <p><strong>Platform:</strong> ${method}</p>
                <div style="margin: 20px 0;">
                  <a href="${paymentLink}" target="_blank" 
                    style="display:inline-block; padding: 12px 20px; background:#1e3a8a; color:white; text-decoration:none; border-radius:4px;">
                    Pay Now
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#f1f1f1; padding:20px; text-align:center; color:#888; font-size:12px;">
                &copy; ${new Date().getFullYear()} Transvanta. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>`;

  try {
    await transporter.sendMail({
      from: `"Transvanta" <${ADMIN_EMAIL}>`,
      to: customerEmail,
      subject: "Your Payment Link - Transvanta",
      html: emailTemplate('customer')
    });

    await transporter.sendMail({
      from: `"Transvanta" <${ADMIN_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: "New Payment Link Created (Admin Notification)",
      html: emailTemplate('admin')
    });

    console.log("Emails successfully sent to both customer and admin.");
  } catch (err) {
    console.error("Error sending emails:", err);
  }
}

module.exports = router;
