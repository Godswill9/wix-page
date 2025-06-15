const express = require('express');
const router = express.Router();
const axios = require('axios');
const gocardless = require('gocardless-nodejs');


const client = gocardless(
  process.env.GOCARDLESS_ACCESS_TOKEN,
  { environment: 'sandbox' }
);

//paystack for nigeria
router.post('/paystack', async (req, res) => {
    const { email, amount } = req.body;
    try {
        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            {
                email,
                amount: amount * 100 // Paystack expects amount in kobo
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

//gocardless for uk

router.post('/gocardless', async (req, res) => {
  const { name, email, sess_tok} = req.body;

  const [firstName, ...rest] = name.trim().split(' ');
  const lastName = rest.join(' ') || 'Unknown';

  const session_token = sess_tok; // Save this per user/session in a DB ideally

  try {
    const redirectFlow = await client.redirectFlows.create({
  description: 'Set up Direct Debit for payment',
  session_token,
  success_redirect_url: 'https://my-gocardless-pages.onrender.com/loading.html',
  // success_redirect_url: 'https://yourdomain.com/gocardless/success',
  prefilled_customer: {
    given_name: firstName,
    family_name: lastName,
    email
  }
});


    // You MUST save `session_token` and `redirectFlow.id` to verify later on success
    // For now, we return them as part of response
    return res.json({
      redirect_url: redirectFlow.redirect_url,
      redirect_flow_id: redirectFlow.id,
      session_token
    });
  } catch (err) {
    console.error('GoCardless error:', err);
    return res.status(500).json({ error: 'Failed to create redirect flow' });
  }
});

router.get('/gocardless/success', async (req, res) => {
  const { redirect_flow_id, session_token } = req.query;

  if (!redirect_flow_id || !session_token) {
    return res.status(400).json({ error: 'Missing redirect_flow_id or session_token' });
  }

  try {
    // Complete the redirect flow
    const result = await client.redirectFlows.complete(redirect_flow_id, {
      data: {
        session_token: session_token
      }
    });

    const customer = result.redirect_flows.customer;
    const mandate = result.redirect_flows.mandate;

    res.json({ customer, mandate });

  } catch (err) {
    console.error('Redirect flow completion failed:', err.body || err.message);
    res.status(500).json({ error: 'Failed to complete redirect flow' });
  }
});


router.post('/go_payments/create', async (req, res) => {
  const { mandate_id, amount, currency, description } = req.body;

  if (!mandate_id || !amount || !currency || !description) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const payment = await client.payments.create({
      params: {
        amount: Number(amount), // in pence (e.g., 1500 = £15.00)
        currency: currency,
        mandate: mandate_id,
        description: description,
      }
    });

    res.json({ success: true, payment_id: payment.id, payment });

  } catch (err) {
    console.error('Payment creation failed:', err?.body || err.message);
    res.status(500).json({ error: 'Payment creation failed' });
  }
});

module.exports = router;