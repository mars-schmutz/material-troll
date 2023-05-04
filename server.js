const express = require("express");
const { Material, User } = require("./model");
const cors = require("cors");
const util = require("util");
const dotenv = require("dotenv");
const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
const bcrypt = require("bcrypt");
const session = require("express-session");
const passport = require("passport");
const passportLocal = require("passport-local");

const app = express();
const port = process.env.PORT || 8080;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(session({ secret: "09u[q0wrigjq[03row", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
dotenv.config();

passport.use(new passportLocal.Strategy({
    username: "username", // user & pwd from req.body form
    password: "password"
}, function(username, password, done) {
    User.findOne({
        username: username
    }).then(function(user) {
        if (user) {
            user.verifyPassword(password).then(function(result) {
                if (result) {
                    done(null, user);
                } else {
                    done(null, false);
                }
            })
        } else {
            done(null, false);
        }
    }).catch(function(err) {
        done(err);
    });
}));

passport.serializeUser(function(user, done) {
    done(null, user._id);
});

passport.deserializeUser(function(userId, done) {
    User.findOne({ _id: userId }).then(function(user) {
        done(null, user);
    }).catch(function(err) {
        done(err);
    });
});

aws.config.update({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: "us-west-1",
});

const s3 = new aws.S3();
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: "materialize-bucket",
        acl: "public-read",
        key: function(req, file, cb) {
            let path = `img/${req.body.name}/${file.originalname}`;
            cb(null, path);
        }
    })
});

// image field names for multer.fields()
const imgFields = [
    {name: "thumbnail", maxCount: 1},
    {name: "diffuse", maxCount: 1},
    {name: "metallic", maxCount: 1},
    {name: "specular", maxCount: 1},
    {name: "roughness", maxCount: 1},
    {name: "normal", maxCount: 1},
    {name: "bump", maxCount: 1},
    {name: "displacement", maxCount: 1},
]
const uploadImgs = upload.fields(imgFields);

function setImgLoc(file) {
    try {
        let parsedURL = file[0].location.split("/");
        return parsedURL.slice(3).join("/");
    } catch (error) {
        return null;
    }
}

function formatTags(tags) {
    return tags.split(",").map(tag => tag.trim());
}

function createMaterial(req, res) {
    let material = new Material({
        name: req.body["name"],
        resolution: req.body["resolution"],
        tags: formatTags(req.body["tags"]),
        workflow: req.body["workflow"],
        maps: {
            thumbnail: req.files[imgFields[0].name][0].location,
            diffuse: setImgLoc(req.files[imgFields[1].name]),
            metallic: setImgLoc(req.files[imgFields[2].name]),
            specular: setImgLoc(req.files[imgFields[3].name]),
            roughness: setImgLoc(req.files[imgFields[4].name]),
            normal: setImgLoc(req.files[imgFields[5].name]),
            bump: setImgLoc(req.files[imgFields[6].name]),
            displacement: setImgLoc(req.files[imgFields[7].name]),
        },
    });
    material.save().then(() => {
        res.status(201).send("Material added");
    }).catch((error) => {
        console.error(`Error: ${error}`);

        if (error.errors) {
            let errs = {}
            for (let e in error.errors) {
                errs[e] = error.errors[e].message;
            }
            res.status(422).json()
        } else {
            res.status(500).send("Server error")
        }
    });
}

function deleteS3(keyDict) {
    console.log(`material: ${JSON.stringify(keyDict)}`);
    for (const key in keyDict) {
        if (keyDict[key] !== null && typeof keyDict[key] === "string") {
            if (key == "thumbnail") {
                s3.deleteObject({
                    Bucket: 'materialize-bucket',
                    Key: keyDict[key].split("/").slice(3).join("/")
                }, (err, data) => {
                    if (err) {
                        console.error(`Error deleting thumbnail: ${err}`);
                        console.error(keyDict[key].split("/").slice(3).join("/"));
                    }
                })
            } else {
                s3.deleteObject({
                    Bucket: 'materialize-bucket',
                    Key: keyDict[key]
                }, (err, data) => {
                    if (err) {
                        console.error(`Error deleting ${key}: ${err}`);
                        console.log(`Typeof key: ${typeof key}`);
                        console.log(`Typeof keyDict[key]: ${typeof keyDict[key]}`);
                    } else {
                        console.log(data);
                    }
                });
            }
        }
    }
}

function updateMaterial(req, res) {
    let params = {
        name: req.body["name"],
        resolution: req.body["resolution"],
        tags: formatTags(req.body["tags"]),
        workflow: req.body["workflow"],
        maps: {}
    }

    if (Object.keys(req.files).length > 0) {
        for (let i = 0; i < imgFields.length; i++) {
            if (imgFields[i].name == "thumbnail" && req.files[imgFields[i].name]) {
                params.maps[imgFields[i].name] = req.files[imgFields[i].name][0].location;
            } else {
                params.maps[imgFields[i].name] = setImgLoc(req.files[imgFields[i].name]);
            }
        }
    }

    Material.findOne({ _id: req.params.materialID })
        .then((mat) => {
            if (Object.keys(req.files).length == 0) {
                params.maps = mat.maps;
            }
            Material.updateOne({ _id: req.params.materialID }, params, function(err, docs) {
                if (err) {
                    console.error(`Error updating material: ${err}`);
                    res.status(500).send("Server error");
                } else {
                    res.status(200).send("Material updated");
                }
            })
        })
}

// index
app.get("/", (req, res) => {
    res.send("try one of the endpoints");
})

// downloads requested image
app.get("/download/:key*", (req, res) => {
    let key = req.params["key"] + req.params[0];
    let options = {
        Bucket: "materialize-bucket",
        Key: key,
    }
    res.attachment(key);
    s3.getObject(options).createReadStream().pipe(res);
})

// sends image to client for viewing
app.get("/images/:key*", (req, res) => {
    let key = req.params["key"] + req.params[0];
    s3.getObject({
        Bucket: "materialize-bucket",
        Key: key
    }, function(err, data) {
        if (err) {
            console.error(`Error getting object ${err}`);
        }
        let bufferToBase64 = Buffer.from(data.Body).toString('base64');
        let imgType = key.split(".")[1];
        res.json({"buffer": bufferToBase64, "type": imgType});
    })
})

// GET all materials
app.get("/materials", (req, res) => {
    // add {field: "search term"} to find() to search for materials
    // regex: {field: { $regex: /search term/i }}
    if (req.user) {
        Material.find().then(materials => {
            res.json(materials);
        });
    } else {
        res.sendStatus(401);
    }
})

// GET material by id
app.get("/materials/:materialID", (req, res) => {
    if (req.user) {
        Material.findOne({
            _id: req.params.materialID
        }).then((material) => {
            if (material) {
                res.json(material);
            } else {
                res.sendStatus(404);
            }
        }).catch(err => {
            console.error(`DB query failed: ${err}`);
            res.sendStatus(400);
        })
    } else {
        res.sendStatus(401);
    }
})

// POST new material
app.post("/materials", function(req, res) {
    if (req.user) {
        uploadImgs(req, res, function(err) {
            if (err) {
                console.error(`Error occurred: ${err}`);
                return res.sendStatus(422);
            }

            // console.log(`util.inspect in post request: ${util.inspect(req.files, {showHidden: false, depth: null})}`);
            createMaterial(req, res);
        });
    } else {
        res.sendStatus(401);
    }
})

// Update material
app.put("/materials/:materialID", (req, res) => {
    if (req.user) {
        uploadImgs(req, res, function(err) {
            if (err) {
                console.error(`Error occurred: ${err}`);
            }

            updateMaterial(req, res);
        })
    } else {
        res.sendStatus(401);
    }
})

// Delete material
app.delete("/materials/:materialID", (req, res) => {
    if (req.user) {
        let matKeys = {};
        Material.findOne({
            _id: req.params.materialID
        }).then((material) => {
            if (material) {
                matKeys = material.maps;
                // deleteS3(matKeys);
                Material.deleteOne({
                    _id: req.params.materialID
                }).then(() => {
                    res.sendStatus(204);
                });
            } else {
                res.sendStatus(404);
            }
        }).catch(err => {
            console.error(`DB query failed: ${err}`);
            res.sendStatus(400);
        });
    } else {
        res.sendStatus(401);
    }
})

// Create user
app.post('/users', (req, res) => {
    User.countDocuments({ username: req.body.username }, function(err, count) {
        if (err) {
            console.err(`Error counting: ${err}`);
        } else if (count > 0) {
            console.log(`count: ${count}`);
            res.sendStatus(409);
        } else {
            var user = new User({ username: req.body.username });
            user.setEncryptedPassword(req.body.password).then(function() {
                // promise fulfilled. user processing here
                // make sure usernames are unique -> error 1100
                // TODO: send status code on error 1100
                user.save().then(function() {
                    res.sendStatus(201);
                });
            });
        }
    })
})

// Authenticate
app.post('/session', passport.authenticate('local'), function(req, res) {
    console.log("User authenticated");
    res.sendStatus(201);
})

// Authorize
app.get("/session", function(req, res) {
    // req.user can be used to access the authenticated user
    // req.user is set from deserializeUser
    if (req.user) {
        console.log("User authorized");
        res.sendStatus(200);
    } else {
        res.sendStatus(401);
    }
})

app.listen(port, () => {
    console.log("Server started on port " + port);
})
