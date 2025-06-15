// api for saving shippings
//api for saving bookings


const express = require('express');
const axios = require('axios');// or native fetch in newer Node versions
const router = express.Router();
const multer = require('multer'); // For handling file uploads

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

      return res.json({ message: "Purchase request submitted!" });
    }

    return res.status(400).json({ error: "Invalid request type." });

  } catch (error) {
    console.error("Server submission error:", error.response?.data || error.message || error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

module.exports = router;