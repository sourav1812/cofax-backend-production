import { CustomError } from "./custom-error";

export class NotFound extends CustomError{
    statusCode = 404;

    constructor(){
        super("Not found");
    }

    serializeErrors() { 
        return [{ message: "Not found" }]
    }
}