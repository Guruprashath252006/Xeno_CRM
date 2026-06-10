import mongoose from "mongoose";

const connectDB = async ()=>{



    try {
        const conn = await mongoose.connect(process.env.MONGO_URI)
        console.log(`Database Connected Successfully ${conn.connection.host}`);
        
    } catch (error) {
        console.log(`Error Occured in server`,error);
        process.exit(0)
        
    }
}

export default connectDB