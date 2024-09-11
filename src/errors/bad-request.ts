import { CustomError } from "./custom-error";

export class BadRequest extends CustomError{
    statusCode = 400;
    message = "Bad request";

    constructor(message: string,statusCode?: number){
        super(message);
        this.message = message;
        this.statusCode = statusCode || 400;
    }

    serializeErrors(){
        return [{ message: this.message }]
    }
}