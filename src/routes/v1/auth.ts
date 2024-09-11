import express from 'express';
import AuthController from '../../controllers/auth.controller';
import { RequestValidator } from '../../middlewares/requestValidator.middleware';
import { Protect } from '../../middlewares/authenticate.middleware';
import { validateEmail, validateLoginBody, validatePassword, validateRegisterBody } from '../../utils/bodyValidators/user';

let auth = express();

// routes /auth/
auth.post('/register',validateRegisterBody,RequestValidator, AuthController.register)
auth.post('/signin',validateLoginBody,RequestValidator, AuthController.signIn)
auth.post('/signout', AuthController.signOut)

auth.post('/refresh', AuthController.refreshToken)
auth.post('/forgot-password', validateEmail, AuthController.forgotPassword);
auth.post('/reset-password/:token',validatePassword, RequestValidator, AuthController.resetPassword);

// Protect all routes after this middleware
auth.use(Protect);

auth.put('/update-password', validatePassword, AuthController.updatePassword);
auth.get('/currentUser', AuthController.profile)

export default auth;