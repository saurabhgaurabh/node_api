const db = require('../model/connection');
const nodemailer = require("nodemailer");
const otpGenerator = require('otp-generator');
const bcrypt = require('bcrypt')
const speakeasy = require('speakeasy')
const jwt = require('jsonwebtoken');

// add product api
exports.add_product = async (req, res) => {
    try {
        const { product_name, product_type, discription } = req.body;  // type script format(dstructure format)
        // const product_name = req.body.product_name  // we could try like that
        if (product_name) {
            if (product_type) {
                if (discription) {
                    db.query(`SELECT * from product where product_name = '${product_name}'`, (error, result) => {
                        if (error) {
                            res.status(200).json({ status: false, message: "error found" })
                        } else if (result.length > 0) {
                            res.status(200).json({ status: false, message: "product alredy exist!" })
                        } else {
                            db.query(`INSERT INTO product SET ?`, { product_name, product_type, discription }, (error, result) => {
                                if (error) {
                                    res.status(200).json({ status: false, message: "Product is't Inserted!" })
                                } else {
                                    res.status(200).json({ status: true, res: result })
                                }
                            })
                        }
                    });
                } else {
                    res.status(200).json({ status: false, message: "Product description required!" })
                }
            } else {
                res.status(200).json({ status: false, message: "Product type required!" })
            }
        } else {
            res.status(200).json({ status: false, message: "Product name required!" })
        }
    } catch (error) {
        res.status(200).json({ status: false, message: "Product is't register! 1" })
        console.log(error)
    }
}

// get product api
exports.get_product = async (req, res) => {
    try {
        db.query(`select * from product`, (error, result) => {
            if (error) {
                console.log(error);
                res.status(200).json({ status: false, message: "Products not found1" });
            } else {
                res.status(200).json({ status: false, resp: result });  //resp is a object key(user define)
            }
        });

    } catch (error) {
        console.log(error)
        res.status(200).json({ status: false, message: "Products not found" });
    }
}

// update product api
exports.update_produuct = async (req, res) => {
    try {
        const product_name = req.body.product_name;
        const product_type = req.body.product_type;
        const discription = req.body.discription;
        const id = req.body.id;
        console.log(product_type, "product_type");
        if (id) {
            if (product_name) {
                if (product_type) {
                    if (discription) {
                        db.query(`select product_name from product where id = '${id}' `, (error, result) => {
                            if (error) {
                                console.log(error);
                                res.status(200).json({ status: false, message: "Product not found" });
                            } else {
                                db.query(`update product set product_name=' ${product_name}', product_type= '${product_type}', discription= '${discription}' where id = '${id}'`, (error, result) => {
                                    if (error) {
                                        console.log(error);
                                        res.status(200).json({ status: false, message: "Product are not updated333" });
                                    } else {
                                        res.status(200).json({ status: true, message: "Updated Successfully", res: result });
                                    }
                                });
                            };
                        });

                    } else {
                        res.status(200).json({ status: false, message: "Product Discription Required" });
                    }
                } else {
                    res.status(200).json({ status: false, message: "Product Type Required" });
                }

            } else {
                res.status(200).json({ status: false, message: "Product Name Required" });
            }
        } else {
            res.status(200).json({ status: false, message: "Product id Required" });
        }


    } catch (error) {
        console.log(error);
        res.status(200).json({ status: false, message: "Product Not Updated" });

    }
}

// delete product api 
exports.delete_product = async (req, res) => {
    const id = req.body.id;
    try {
        if (id) {
            db.query(`select id from product where id = '${id}'`, (error, result) => {
                if (error) {
                    res.status(200).json({ status: false, message: "Can not delete this" });
                } else {
                    if (result.length > 0) {
                        db.query(`delete from product where id  = '${id}'`, (error, result) => {
                            if (error) {
                                res.status(200).json({ status: false, message: "Product can't delete" });
                            } else {
                                res.status(200).json({ status: true, message: "Deleted Successfullt" });
                            }
                        });
                    } else {
                        res.status(200).json({ status: false, message: "product not exist" });
                    }
                }
            });

        } else {
            res.status(200).json({ status: false, message: "Can not delete" });
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ status: true, message: "Internal Server Error" })
    }
};

// register user api
exports.register = async (req, res) => {
    try {
        const { name, mobile, email, password } = req.body;
        if (!name) return res.status(400).json({ status: false, message: "Username is required" });
        if (!mobile) return res.status(400).json({ status: false, message: "Mobile number is required" });
        if (!email) return res.status(400).json({ status: false, message: "Email is required" });
        if (!password) return res.status(400).json({ status: false, message: "Password is required" });
        db.query(`SELECT * FROM register_user WHERE email = '${email}'`, (error, result) => {
            if (error) {
                return res.status(500).json({ status: false, message: `Database error while select: ${error}` });
            }
            if (result.length > 0) {
                const user = result[0];
                // Check if user is already registered and verified
                if (user.flag) {
                    return res.status(400).json({ status: false, message: "User already registered and verified" });
                }
                // User exists but is not verified, update the OTP
                const salt = bcrypt.genSaltSync(10);
                const hashedPassword = bcrypt.hashSync(password, salt);
                var secret = speakeasy.generateSecret().base32;
                var otp = speakeasy.totp({
                    secret: secret,
                    encoding: 'base32'
                });
                db.query(`UPDATE register_user SET otp = '${otp}', secret = '${secret}', password = '${hashedPassword}' WHERE email = '${email}'`, (updateError) => {
                    if (updateError) {
                        return res.status(500).json({ status: false, message: `Database error while update: ${updateError}` });
                    }
                    sendOtpToEmail(email, otp); // Send updated OTP to the user's email

                    return res.status(200).json({ status: true, message: "OTP updated. Please verify your email." });
                });
            } else {
                var secret = speakeasy.generateSecret().base32; // New user, generate OTP and insert into database
                var otp = speakeasy.totp({
                    secret: secret,
                    encoding: 'base32'
                });
                const salt = bcrypt.genSaltSync(10);
                const hashedPassword = bcrypt.hashSync(password, salt);

                db.query(
                    "INSERT INTO register_user (name, mobile, email, secret, password, otp) VALUES (?, ?, ?, ?, ?, ?)",
                    [name, mobile, email, secret, hashedPassword, otp],
                    (insertError) => {
                        if (insertError) {
                            return res.status(500).json({ status: false, message: `Database error while insert: ${insertError}` });
                        }
                        sendOtpToEmail(email, otp);  // Send OTP to the user's email
                        return res.status(200).json({ status: true, message: "User registered. Please verify your email." });
                    }
                );
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: `Internal Server Error 4: ${error}` });
    }
}

/// this is send email function for register
async function sendOtpToEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: "leadchainsaurabh7@gmail.com",
                pass: "szjfpgixdiaqhema",
            },
        });

        const info = await transporter.sendMail({
            from: '"Patiram Production 👻" <leadchainsaurabh7@gmail.com>',
            to: email,
            subject: "Patiram.in ✔",
            text: `Hello user, your OTP is ${otp}`,
            html: `<b>This is your OTP: ${otp}</b>`,
        });

        console.log("Email sent:", info.response);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

//verify otp api
exports.verify_otp = async (req, res) => {
    const params = req.body
    if (params.email) {
        if (params.otp) {
            try {
                db.query(`select secret from register_user where email = '${params.email}'`, (error, result) => {
                    if (error) {
                        res.status(404).json({ status: false, message: `Invalid Email ${error}` })
                    } else {
                        var tokenValidates = speakeasy.totp.verify({
                            secret: result[0].secret,
                            encoding: 'base32',
                            token: params.otp,
                            window: 600,
                        });
                        if (tokenValidates) {
                            db.query(`update register_user set flag = 1 where email = '${params.email}'`, (error, result) => {
                                if (error) {
                                    res.status(404).json({ status: false, message: `Token not found ${error}` })
                                } else {
                                    const token = jwt.sign({ email: params.email }, 'secretKey');
                                    res.status(200).json({ status: true, message: `Varification Sucessfully`, token: token })
                                }
                            })
                        } else {
                            res.status(500).json({ status: false, message: `token not valid ${error}` })
                        }
                    }
                })
            } catch (error) {
                res.status(500).json({ status: false, message: `Somthing went wrong ${error}` })
            }
        } else {
            res.status(200).json({ status: false, message: "OTP Required" })
        }
    } else {
        res.status(200).json({ status: false, message: "Email Required" })
    }
}

//login user api
exports.login_user = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (username) {
            if (email) {
                if (password) {
                    db.query(`insert into login set ?`, { username, email, password }, (error, result) => {
                        if (error) {
                            res.status(200).json({ status: true, message: "incorrect" })
                        } else {
                            res.status(200).json({ status: true, res: result })
                        }
                    })
                } else {
                    res.status(200).json({ status: true, message: "Password Required" })
                }
            } else {
                res.status(200).json({ status: true, message: "Email Required" })
            }
        } else {
            res.status(200).json({ status: true, message: "Username Required" })
        }
    } catch (error) {
        res.status(200).json({ status: true, message: "Error" })
    }
}

// add teacher management  api 
exports.add_teacher_management = async (req, res) => {
    try {
        const {
            teacher_name,
            age,
            email_teacher,
            address_teacher,
            username_teacher,
            salary,
            password,
            confirm_password,
            school_id,
            eligibility,
            no_of_degree,
            experience,
            joining_date,
            position
        } = req.body;
        if (teacher_name) {
            if (age) {
                if (email_teacher) {
                    if (address_teacher) {
                        if (username_teacher) {
                            if (password) {
                                if (password === confirm_password) {
                                    db.query(
                                        `SELECT * FROM addteachermanagement WHERE teacher_name = '${teacher_name}' AND email_teacher = '${email_teacher}'`, (error, result) => {
                                            if (error) {
                                                res.status(409).json({ status: true, message: "Duplicate Record Can't Accept" });
                                            } else if (result.length > 0) {
                                                res.status(422).json({ status: true, message: "Already Exist" });
                                            } else {
                                                const saltRounds = 10;
                                                bcrypt.hash(password, saltRounds, (error, hashedPassword) => {
                                                    if (error) {
                                                        res.status(500).json({ status: true, message: "Internal Server Error" });
                                                    } else {
                                                        var school_id = speakeasy.totp({
                                                            // secret: secret,
                                                            encoding: 'base32'
                                                        });
                                                        db.query(`INSERT INTO addteachermanagement SET ?`, {
                                                            teacher_name,
                                                            age,
                                                            email_teacher,
                                                            address_teacher,
                                                            username_teacher,
                                                            salary,
                                                            password: hashedPassword, // Store the hashed password
                                                            confirm_password,
                                                            school_id,
                                                            eligibility,
                                                            no_of_degree,
                                                            experience,
                                                            position
                                                        }, (error, result) => {
                                                            if (error) {
                                                                res.status(200).json({ status: true, message: "Incorrect Details" });
                                                            } else {
                                                                sendPasswordToEmail(email_teacher, school_id,teacher_name); 
                                                                res.status(200).json({ status: true, res: result });
                                                            }
                                                        }
                                                        );
                                                    }
                                                });
                                            }
                                        }
                                    );
                                } else {
                                    res.status(400).json({ status: true, message: "Password Mismatch" });
                                }
                            } else {
                                res.status(200).json({ status: true, message: "Password Required" });
                            }
                        } else {
                            res.status(200).json({ status: true, message: "Username Required" });
                        }
                    } else {
                        res.status(200).json({ status: true, message: "Address Required" });
                    }
                } else {
                    res.status(200).json({ status: true, message: "Email Required" });
                }
            } else {
                res.status(200).json({ status: true, message: "Age Required" });
            }
        } else {
            res.status(200).json({ status: 200, message: "Teacher Name Required" });
        }
    } catch (error) {
        res.status(500).json({ status: true, message: "Internal Server Error" });
    }
};

/// this is send email function for add_teacher_management
async function sendPasswordToEmail(email_teacher, school_id,teacher_name) {
    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: "leadchainsaurabh7@gmail.com",
                pass: "szjfpgixdiaqhema",
            },
        });

        const info = await transporter.sendMail({
            from: '"Patiram Production Registration 👻" <leadchainsaurabh7@gmail.com>',
            to: email_teacher,
            subject: "Management Verification",
            text: `Hello user, your OTP is ${school_id}`,
            html: `<b>Dear ${teacher_name} ,You have successfully registered with our Organization and we are <br>so glad to join you with us. And  ${school_id} is your teacher id: keep this for future use.</b>`,
        });

        console.log("Email sent:", info.response);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

// delete add teacher management api
exports.delete_add_teacher_management = async (req, res) => {
    const id = req.body.id;
    try {
        if (id) {
            db.query(`select * from addteachermanagement `)
        } else {
            res.status(200).json({ status: true, message: "can not delete" })
        }
    } catch (error) {
        res.status(500).json({ status: true, message: "Internal Server Error" })
    }
}






// testing api//


