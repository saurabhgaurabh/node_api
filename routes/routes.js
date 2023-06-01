const express = require('express');
const router = express.Router();
const controller = require('../controller/controllers');
const nodemailer = require('nodemailer');


// authorization api
router.post('/login_user', controller.login_user);
router.post('/register', controller.register);
router.post('/verify_otp', controller.verify_otp)


// all add items api 
router.post('/add_product', controller.add_product);
router.post('/add_teacher_management', controller.add_teacher_management);
router.post('/track_teacher_management',controller.track_teacher_management);

// all get api 
router.get('/get_product', controller.get_product);

// all update api
router.post('/update_product', controller.update_product);
router.post('/update_add_teacher_management', controller.update_add_teacher_management);
router.post('/update_track_teacher_management',controller.update_track_teacher_management);

// all delete api
router.post('/delete_product', controller.delete_product);
router.post('/delete_add_teacher_management', controller.delete_add_teacher_management);






module.exports = router // to access in the index.js directory