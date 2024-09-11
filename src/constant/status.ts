export const STATUS = {
  FAILURE: "failure",
  SUCCESS: "success",
};

export const STATUS_CODE = {
  CREATED: 201,
  SUCCESS: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UN_AUTHENTICATED: 401,
  NO_ACCESS: 403,
  NOT_FOUND: 404,
  CUSTOM_CODE: 441, //This code is sent when user is not loggedIn
  SERVER_ERROR: 500,
};

export const MESSAGES = {
  NOT_FOUND: "Not found",
  NOTE_ERROR: "Can't create note. Something went wrong",
  USER_NOT_EXIST: "user not exists",
  EMAIL_ALREADY_EXISTS: "Email is already in use",
  TOKEN_NOT_FOUND: "You don't have any token",
  NOT_LOGGED_IN: "You are not logged in! Please log in to get access.",
  BLOCKED: "successfully blocked",
  PERMISSION_DENIED:
    "Request was denied because you do not have the necessary permissions or credentials to access this API.",
  SOMETHING_WENT_WRONG: "Something went wrong",
};
