import bcrypt from 'bcrypt';

export class Password{
    static async toHash(password: string){
        const hashedPassword = await bcrypt.hashSync(password, Number(process.env.PASSWORD_SALT))
        return hashedPassword;
    }

    static async compare(storedPassword: string,suppliedPassword: string){
        const isValidePassword = await bcrypt.compareSync(suppliedPassword, storedPassword)
        return isValidePassword;
    }
}