const router = require('express').Router();
const webhookController = require('../controllers/webhook.controller');

router.post('/', webhookController.handleGitLabWebhook);

module.exports = router;