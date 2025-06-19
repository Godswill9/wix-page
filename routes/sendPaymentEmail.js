const express = require('express');
const router = express.Router();
const axios = require('axios');
const gocardless = require('gocardless-nodejs');
const nodemailer = require('nodemailer');

const client = gocardless(
  process.env.GOCARDLESS_ACCESS_TOKEN,
  { environment: 'sandbox' }
);

const ADMIN_EMAIL = "guche9@gmail.com";
const EXCHANGE_RATE = 1500;  // Example: 1 USD = 1500 NGN (update accordingly)

// Paystack for Nigeria (convert dollars to naira)
router.post('/paystack', async (req, res) => {
  const { email, amount } = req.body;

  // Convert amount from dollars to naira
  const amountInNaira = amount * EXCHANGE_RATE;

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(amountInNaira * 100), // Paystack expects amount in kobo
        currency: 'NGN'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    await sendPaymentEmail(email, amount, 'Paystack');
    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// GoCardless for UK (no conversion, stay in dollars)
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

    await sendPaymentEmail(email, amount, 'GoCardless');
    res.json({
      redirect_url: redirectFlow.redirect_url,
      redirect_flow_id: redirectFlow.id,
      session_token
    });
  } catch (err) {
    console.error('GoCardless error:', err);
    res.status(500).json({ error: 'Failed to create redirect flow' });
  }
});

// Send email to both admin and customer after payment link creation
async function sendPaymentEmail(customerEmail, amount, method) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: ADMIN_EMAIL,
      pass: process.env.EMAIL_APP_PASSWORD, // NEVER hardcode, store securely!
    },
  });

  const emailBody = `
    <body style="font-family: Arial, sans-serif;">
      <h2>Payment Link Generated</h2>
      <p><strong>Payment Platform:</strong> ${method}</p>
      <p><strong>Amount:</strong> $${amount} USD</p>
      <p><strong>Customer Email:</strong> ${customerEmail}</p>
    </body>
  `;

  const mailOptionsCustomer = {
    from: `"Transvanta" <${ADMIN_EMAIL}>`,
    to: customerEmail,
    subject: "Payment Link Created - Transvanta",
    html: `
      <body style="font-family: Arial, sans-serif;">
        <h2>Hello,</h2>
        <p>Your payment link has been successfully created.</p>
        <p>Amount: $${amount} USD</p>
        <p>Payment Platform: ${method}</p>
        <p>Thank you for choosing Transvanta!</p>
      </body>
    `
  };

  const mailOptionsAdmin = {
    from: `"Transvanta" <${ADMIN_EMAIL}>`,
    to: ADMIN_EMAIL,
    subject: "Payment Link Generated (Admin Notification)",
    html: emailBody
  };

  try {
    await transporter.sendMail(mailOptionsCustomer);
    await transporter.sendMail(mailOptionsAdmin);
    console.log("Payment email sent to customer and admin.");
  } catch (err) {
    console.error("Error sending payment emails:", err);
  }
}

module.exports = router;
