const express = require('express')
const router = express.Router()

const { show, detail } = require('../../controller/Promo/PromoController')
const Auth = require('../../middleware/Auth')

router.get('/promos', Auth, show)
router.get('/promo', Auth, detail)

module.exports = router
