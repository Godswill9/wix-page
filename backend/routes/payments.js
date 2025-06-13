const express = require('express');
const router = express.Router();
const axios = require('axios');
const gocardless = require('gocardless-nodejs');


const client = gocardless(
  process.env.GC_ACCESS_TOKEN,
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
      params: {
        description: 'Set up Direct Debit for payment',
        session_token,
        success_redirect_url: 'https://yourdomain.com/gocardless/success',
        prefilled_customer: {
          given_name: firstName,
          family_name: lastName,
          email
        }
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
  const { redirect_flow_id } = req.query;
    const {sess_tok} = req.body;


  if (!redirect_flow_id) {
    return res.status(400).json({ error: 'Missing redirect_flow_id' });
  }

  try {
    // Complete the redirect flow
    const result = await client.redirectFlows.complete(redirect_flow_id, {
      data: {
        session_token: sess_tok // Must match what you used when creating the redirect flow
      }
    });

    const customer = result.redirect_flows.customer;
    const mandate = result.redirect_flows.mandate;

    // 🔐 You can now save the customer ID and mandate ID to your database
    // and use the mandate to create payments

    // Optional: redirect to a success page or return JSON
    // res.redirect(`/payment-success?customer_id=${customer}&mandate_id=${mandate}`);
    // // OR
    res.json({ customer, mandate });

  } catch (err) {
    console.error('Redirect flow completion failed:', err.body || err.message);
    res.status(500).json({ error: 'Failed to complete redirect flow' });
  }
});



module.exports = router;