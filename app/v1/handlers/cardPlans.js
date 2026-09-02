// handlers/cardPlans.js
const CardPlan = require('../models/CardPlan');
const CardActivation = require('../models/CardActivation');
const CoinWallet = require('../models/CoinWallet');
const User = require('../models/user');

// Response helpers
const sendSuccess = (res, message, data) => {
  res.status(200).json({ success: true, message, data: data || null });
};

const sendError = (res, status, message) => {
  res.status(status).json({ success: false, error: message });
};

/*
|--------------------------------------------------------------------------
| GET ALL CARD PLANS
|--------------------------------------------------------------------------
*/
const getCardPlans = async (req, res) => {
  try {
    const plans = await CardPlan.find({ isActive: true }).lean();

    if (!plans || plans.length === 0) {
      return sendError(res, 404, 'No card plans available');
    }

    sendSuccess(res, 'Card plans retrieved successfully', { plans });
  } catch (error) {
    console.error('Get card plans error:', error);
    sendError(res, 500, 'Failed to retrieve card plans');
  }
};

/*
|--------------------------------------------------------------------------
| GET SINGLE CARD PLAN
|--------------------------------------------------------------------------
*/
const getCardPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await CardPlan.findById(planId).lean();

    if (!plan) {
      return sendError(res, 404, 'Card plan not found');
    }

    sendSuccess(res, 'Card plan retrieved successfully', { plan });
  } catch (error) {
    console.error('Get card plan error:', error);
    sendError(res, 500, 'Failed to retrieve card plan');
  }
};

/*
|--------------------------------------------------------------------------
| CREATE CARD PLAN (Admin only)
|--------------------------------------------------------------------------
*/
const createCardPlan = async (req, res) => {
  try {
    const { name, displayName, fee, benefits, features, color } = req.body;

    // Validation
    if (!name || !displayName || !fee) {
      return sendError(res, 400, 'Name, displayName and fee are required');
    }

    const existingPlan = await CardPlan.findOne({ name });
    if (existingPlan) {
      return sendError(res, 409, 'Card plan with this name already exists');
    }

    const plan = await CardPlan.create({
      name,
      displayName,
      fee,
      benefits: benefits || [],
      features: features || {},
      color: color || {}
    });

    sendSuccess(res, 'Card plan created successfully', { plan });
  } catch (error) {
    console.error('Create card plan error:', error);
    sendError(res, 500, 'Failed to create card plan');
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE CARD PLAN (Admin only)
|--------------------------------------------------------------------------
*/
const updateCardPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const updates = req.body;

    const plan = await CardPlan.findById(planId);
    if (!plan) {
      return sendError(res, 404, 'Card plan not found');
    }

    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== '__v') {
        plan[key] = updates[key];
      }
    });

    await plan.save();

    sendSuccess(res, 'Card plan updated successfully', { plan });
  } catch (error) {
    console.error('Update card plan error:', error);
    sendError(res, 500, 'Failed to update card plan');
  }
};

/*
|--------------------------------------------------------------------------
| DELETE CARD PLAN (Admin only)
|--------------------------------------------------------------------------
*/
const deleteCardPlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await CardPlan.findById(planId);
    if (!plan) {
      return sendError(res, 404, 'Card plan not found');
    }

    // Soft delete
    plan.isActive = false;
    await plan.save();

    sendSuccess(res, 'Card plan deleted successfully', null);
  } catch (error) {
    console.error('Delete card plan error:', error);
    sendError(res, 500, 'Failed to delete card plan');
  }
};

module.exports = {
  getCardPlans,
  getCardPlan,
  createCardPlan,
  updateCardPlan,
  deleteCardPlan
};