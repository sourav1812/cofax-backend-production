import { body } from 'express-validator';

export const validatePassword = [
    body('password').trim().isLength({min: 4,max: 20}).withMessage('Password must be b/w 4 to 20'),
]

export const validateEmail = [
    body('email').isEmail().withMessage('Email must be valid'),
]

export const validateLoginBody = [
    ...validatePassword,
    ...validateEmail
]

//TODO: Added more checks like on area
export const validateRegisterBody = [
    ...validateLoginBody,
    body('username').not().isEmpty().withMessage("Username is required")
]

