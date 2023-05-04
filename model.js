const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
mongoose.connect("mongodb+srv://web4200:ueyhkPbe961dBpLF@cluster0.zlfey.mongodb.net/materialize?retryWrites=true&w=majority");
// mongoose.connect("mongodb+srv://web4200:ueyhkPbe961dBpLF@cluster0.zlfey.mongodb.net/materialize?retryWrites=true&w=majority")

const Material = mongoose.model("Material", {
    name: {
        type: String,
        required: true
    },
    resolution: {
        type: String,
        required: true
    },
    tags: [String],
    workflow: {
        type: String,
        required: true
    },
    maps: {
        thumbnail: String,
        diffuse: String,
        metallic: String,
        specular: String,
        roughness: String,
        normal: String,
        bump: String,
        displacement: String,
    },
});

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    encryptedPassword: {
        type: String,
        required: true
    },
})

userSchema.methods.setEncryptedPassword = function(plain_pass) { 
    let promise = new Promise((resolve, reject) => {
        bcrypt.hash(plain_pass, 12).then((hash) => {
            this.encryptedPassword = hash;
            // resolve promise here
            resolve();
        });
    });
    
    return promise;
}

userSchema.methods.verifyPassword = function(plain_pass) { 
    let promise = new Promise((resolve, reject) => {
        bcrypt.compare(plain_pass, this.encryptedPassword).then((result) => {
            resolve(result);
        });
    });
    
    return promise;
}

const User = mongoose.model("User", userSchema);

module.exports = {
    Material: Material,
    User: User
};