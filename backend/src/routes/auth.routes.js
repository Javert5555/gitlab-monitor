const router = require('express').Router();
const auth = require('../controllers/auth.controller');

router.post('/login', auth.login);
router.post('/register', auth.register);

module.exports = router;