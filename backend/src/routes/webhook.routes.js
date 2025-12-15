const express = require('express');
const router = express.Router();

const SECRET = process.env.GITLAB_WEBHOOK_SECRET;
/**
 * GitLab webhook endpoint
 * Можно принимать любые типы событий:
 * - Push Hook
 * - Merge Request Hook
 * - Pipeline Hook
 * - Job Hook
 * - Tag Push Hook
 * - Release Hook
 * - и т.д.
 */
router.post('/gitlab', async (req, res) => {
  const token = req.headers['x-gitlab-token'];
  if (!token || token !== SECRET) {
      return res.status(403).json({ message: "Invalid webhook token" });
  }

  const event = req.headers['x-gitlab-event']; // тип события
  const payload = req.body;                    // JSON с данными

  console.log("=== GitLab Webhook received ===");
  console.log("Event:", event);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  // ❗ здесь можно будет запускать:
  // - автоматический частичный скан
  // - обновление кеша проекта
  // - анализ изменений .gitlab-ci.yml
  // - обнаружение подозрительных действий

  res.status(200).json({ message: "Webhook received" });
});

module.exports = router;
