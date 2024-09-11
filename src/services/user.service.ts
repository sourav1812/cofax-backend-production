import User, { IUser } from "../schema/user.schema"

const UserService = {

    // get user details
    getInfo: async(email: String) => {
        return await User.findOne({email})
    },

    // is user exists
    isExist: async (email: String) => {
        return await User.findOne({email}); 
    },

    // create new user
    createNew: async(userDetail: IUser) => {
        return await User.create(userDetail)
    }

}

export default UserService