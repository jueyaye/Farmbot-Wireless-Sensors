var express = require('express');
var router = express.Router();
var jwt = require('express-jwt');
var auth = jwt({
  secret: 'MY_SECRET',
  userProperty: 'payload'
});

var ctrlProfile = require('../controllers/profile');
var ctrlAuth = require('../controllers/authentication');
var ctrlLiveData = require('../controllers/accessdata');

// profile
router.get('/profile', auth, ctrlProfile.profileRead);

// authentication
router.post('/register', ctrlAuth.register);
router.post('/login', ctrlAuth.login);

// sensor data
router.post('/deposit/:src', ctrlLiveData.writeNewData);

// --- ui/ux ---

// pull latest (includes ml derived state)
router.get('/withdraw/prediction', auth, ctrlLiveData.getPrediction);

// pull latest (includes ml derived state)
router.get('/withdraw/data', auth, ctrlLiveData.readData);

// pull latest (includes ml derived state)
router.get('/withdraw/forecast', auth, ctrlLiveData.readForecast);

// add new device details
router.post('/add/devicedata', auth, ctrlLiveData.addDeviceData);


// check
router.get('/check', (req, res) => {
	res.status(200).json({
      "status" : "OK",
      "timestamp": Date.now()
    });
});

module.exports = router;
