const express = require('express');
const router = express.Router();
const { DDBSignUp } = require('./dynamoDB');

router.get('/', (req, res) => {
    res.render('sign-up.ejs', { cookie : req.headers.cookie });
})

router.post('/', (req, res) => {
    const params = {
        id: req.headers["user-id"],
        password: req.headers["user-password"],
        nickname: req.headers["user-nickname"],
    }
    DDBSignUp(params);
})

module.exports = router;