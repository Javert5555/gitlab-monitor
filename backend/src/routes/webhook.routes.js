// const express = require('express');
// const router = express.Router();

// const SECRET = process.env.GITLAB_WEBHOOK_SECRET;
// router.post('/gitlab', async (req, res) => {
//   const token = req.headers['x-gitlab-token'];
//   if (!token || token !== SECRET) {
//       return res.status(403).json({ message: "Invalid webhook token" });
//   }

//   const event = req.headers['x-gitlab-event'];
//   const payload = req.body;

//   console.log("=== GitLab Webhook received ===");
//   console.log("Event:", event);
//   console.log("Payload:", JSON.stringify(payload, null, 2));

//   res.status(200).json({ message: "Webhook received" });
// });

// module.exports = router;
