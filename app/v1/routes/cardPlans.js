// routes/cardPlans.js
const express = require('express');
const router = express.Router();

const {
  getCardPlans,
  getCardPlan,
  createCardPlan,
  updateCardPlan,
  deleteCardPlan
} = require('../handlers/cardPlans');

const { verifyToken, adminAuth } = require('../../../middlewares/authentication');

// Public routes
router.route('/').get(getCardPlans);
router.route('/:planId').get(getCardPlan);

// Admin routes
router.route('/').post(verifyToken, adminAuth, createCardPlan);
router.route('/:planId').put(verifyToken, adminAuth, updateCardPlan);
router.route('/:planId').delete(verifyToken, adminAuth, deleteCardPlan);

module.exports = router;