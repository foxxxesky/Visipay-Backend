const { WalletTransaction, Wallet, User, TransactionMethod } = require('../../models')
const midtransClient = require('midtrans-client')
const jwt = require('jsonwebtoken')
const uuid = require('uuid')

const coreApi = new midtransClient.CoreApi({
  isProduction: false,
  serverKey: process.env.SERVER_KEY,
  clientKey: process.env.CLIENT_KEY
})

exports.show = async (req, res) => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]
  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN)

  const conditions = {}
  if (req.query.transaction_status) {
    conditions.transaction_status = req.query.transaction_status
  }

  if (req.query.transaction_type) {
    conditions.transaction_type = req.query.transaction_type
  }

  const transaction = await WalletTransaction.findAll({
    where: { user_id: decoded.user.id, ...conditions },
    include: [
      {
        model: User,
        attributes: {
          exclude: ['security_code', 'email_verified', 'phone_verified', 'photo', 'createdAt', 'updatedAt']
        },
        as: 'user_transaction'
      },
      {
        model: Wallet,
        attributes: {
          exclude: ['createdAt', 'updatedAt']
        },
        as: 'wallet_transaction'
      },
      {
        model: TransactionMethod,
        attributes: {
          exclude: ['createdAt', 'updatedAt']
        },
        as: 'transaction_method'
      }
    ]
  })

  res.status(200).json({
    message: 'Transaction List',
    data: transaction
  })
}

exports.charge = async (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]
  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN)

  const wallet = await Wallet.findOne({ where: { user_id: decoded.user.id } })

  // transaction
  req.body.transaction_details.order_id = uuid.v4()

  // customer
  req.body.customer_details = {
    first_name: decoded.user.name,
    phone: decoded.user.phone,
    email: decoded.user.email
  }

  // custom expiry
  req.body.custom_expiry = {
    expiry_duration: 30, // set to 30 minutes
    unit: 'minute'
  }

  coreApi.charge(req.body)
    .then(async (response) => {
      const payload = {
        id: response.transaction_id,
        user_id: decoded.user.id,
        wallet_id: wallet.id,
        transaction_method_id: null,
        amount: parseFloat(response.gross_amount),
        notes: null,
        transaction_type: 'debit',
        transaction_status: response.transaction_status
      }

      const transaction = await WalletTransaction.create(payload)

      res.status(200).json({
        midtrans: response,
        user_transaction: transaction
      })
    })
    .catch((err) => {
      console.log(err.message)
      res.status(200).json({
        data: err.message
      })
    })
}

exports.status = async (req, res) => {
  coreApi.transaction.status(req.query.transaction_id)
    .then((response) => {
      res.status(200).json({
        data: response
      })
    })
    .catch((err) => {
      res.status(200).json({
        data: err.message
      })
    })
}