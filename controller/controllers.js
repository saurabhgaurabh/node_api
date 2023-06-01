const db = require('../model/connection');
const nodemailer = require("nodemailer");
const otpGenerator = require('otp-generator');
const bcrypt = require('bcrypt')
const speakeasy = require('speakeasy')
const jwt = require('jsonwebtoken');



//login user api
// exports.login_user = async (req, res) => {
//     try {
//         const { email, password } = req.body;

//         if (email) {
//             if (password) {
//                 db.query(`insert into register_user set ?`, { email, password }, (error, result) => {
//                     if (error) {
//                         res.status(200).json({ status: true, message: "incorrect" })
//                     } else {
//                         var tokenValidates = speakeasy.totp.verify({
//                             secret: result[0].secret,
//                             encoding: 'base32',
//                             token: params.otp,
//                             window: 600,
//                         });
//                         if (tokenValidates) {
//                             const token = jwt.sign({ email: email },);
//                             res.status(200).json({ status: true, message: "Login Successfully", res: result, token: token })
//                         }
//                     }
//                 })
//             } else {
//                 res.status(200).json({ status: true, message: "Password Required" })
//             }
//         } else {
//             res.status(200).json({ status: true, message: "Email Required" })
//         }
//     } catch (error) {
//         res.status(200).json({ status: true, message: "Error" })
//     }
// }

exports.login_user = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email) {
            res.status(400).json({ status: false, message: "Email is required." });
            return;
        }

        if (!password) {
            res.status(400).json({ status: false, message: "Password is required." });
            return;
        }

        db.query(`SELECT * FROM register_user WHERE email = '${email}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data. Please try again." });
                return;
            }

            if (result.length === 0) {
                res.status(200).json({ status: false, message: "Incorrect email or password." });
                return;
            }

            const hashedPassword = result[0].password;
            bcrypt.compare(password, hashedPassword, (error, passwordMatch) => {
                if (error) {
                    res.status(500).json({ status: false, message: "Failed to compare passwords. Please try again." });
                    return;
                }

                if (!passwordMatch) {
                    res.status(200).json({ status: false, message: "Incorrect email or password." });
                    return;
                }

                const token = jwt.sign({ email: email }, 'your_secret_key_here', { expiresIn: '1h' });
                res.status(200).json({ status: true, message: "Login successful.", token: token });
            });
        });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
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
                                                                sendPasswordToEmail(email_teacher, school_id, teacher_name);
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
async function sendPasswordToEmail(email_teacher, school_id, teacher_name) {
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
                            res.status(409).json({ status: false, message: "Duplicate record" })
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

exports.track_teacher_management = async (req, res) => {
    try {
        const { teacher_name,
            email,
            mobile,
            previous_organization,
            experience,
            qualification,
            no_of_degree,
            permanent_residence,
            current_residence,
            previous_position,
            current_position,
            img_highschool,
            adhar_card,
            pan_Card,
            teacher_img,
        } = req.body;
        if (!teacher_name) {
            res.status(404).json({ status: false, message: "Teacher Name required." });
            return;
        }

        if (!email) {
            res.status(404).json({ status: false, message: "Email is required" });
            return;
        }

        if (!mobile) {
            res.status(404).json({ status: false, message: "Mobile required" });
            return;
        }

        if (!previous_organization) {
            res.status(404).json({ status: false, message: "Previous Organization is Required" });
            return;
        }

        if (!experience) {
            res.status(404).json({ status: false, message: "experience is required" });
            return;
        }

        if (!qualification) {
            res.status(404).json({ status: false, message: "qualification is required" });
            return;
        }

        if (!no_of_degree) {
            res.status(404).json({ status: false, message: "no_of_degree is required" });
            return;
        }

        if (!permanent_residence) {
            res.status(404).json({ status: false, message: "permanent_residence is required" });
            return;
        }

        if (!current_residence) {
            res.status(404).json({ status: false, message: "current_residence is required" });
            return;
        }

        if (!previous_position) {
            res.status(404).json({ status: false, message: "previous_position is required" });
            return;
        }

        if (!current_position) {
            res.status(404).json({ status: false, message: "current_position is required" });
            return;
        }


        const base64Data = img_highschool.split(';base64,').pop(); // Extract base64 data
        const imageType = img_highschool.match(/^data:image\/(.*);base64,/)[1]; // Extract image type

        const trackTeacherData = {
            teacher_name,
            email,
            mobile,
            previous_organization,
            experience,
            qualification,
            no_of_degree,
            permanent_residence,
            current_residence,
            previous_position,
            current_position,
            img_highschool: `${imageType};base64,${base64Data}`, // Set the image data with the correct format
            adhar_card,
            pan_Card,
            teacher_img,
        };

        db.query(`select * from track_teacher where email = '${email}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data. Please try again." });
            } else if (result.length > 0) {
                res.status(409).json({ status: true, message: "item already exists!" });
            } else {
                db.query(`insert into track_teacher set ?`, trackTeacherData, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: "Failed to insert item. Please try again." });
                    } else {
                        res.status(200).json({ status: true, message: "Inserted Successfully", res: result })
                    }
                });
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, messaage: "Internal server error" })
    }
};


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
exports.update_product = async (req, res) => {
    try {
        const product_name = req.body.product_name;
        const product_type = req.body.product_type;
        const discription = req.body.discription;
        const id = req.body.id;
        if (id) {
            if (product_name) {
                if (product_type) {
                    if (discription) {
                        db.query(`select product_name from product where id = '${id}' `, (error, result) => {
                            if (error) {
                                console.log(error);
                                res.status(200).json({ status: false, message: "Product not found" });
                            } else {
                                db.query(`update product set product_name= '${product_name}', product_type= '${product_type}', discription= '${discription}' where id = '${id}'`, (error, result) => {
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

// update add teacher management api
exports.update_add_teacher_management = async (req, res) => {
    try {

        const { id, teacher_name, age, email_teacher, address_teacher, username_teacher, salary, password, confirm_password, school_id, eligibility, no_of_degree, experience, joining_date, position } = req.body;

        if (!id) {
            res.status(200).json({ status: false, message: "Product ID is required." });
            return;
        }

        if (!teacher_name) {
            res.status(200).json({ status: false, message: "Teacher name is required." });
            return;
        }

        if (!age) {
            res.status(200).json({ status: false, message: "Age is required." });
            return;
        }

        if (!email_teacher) {
            res.status(200).json({ status: false, message: "Email is required." });
            return;
        }

        if (!address_teacher) {
            res.status(200).json({ status: false, message: "Address is required." });
        }

        if (!username_teacher) {
            res.status(200).json({ status: false, message: "Username is required." });
        }

        if (!password & password === confirm_password) {
            res.status(200).json({ status: false, message: "Password is required" })
        }

        db.query(`SELECT teacher_name FROM addteachermanagement WHERE id = '${id}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data. Please try again." });
                return;
            }

            if (result.length > 0) {
                db.query(`UPDATE addteachermanagement SET 
                teacher_name = '${teacher_name}', 
                age = '${age}', 
                email_teacher = '${email_teacher}',
                address_teacher = '${address_teacher}',
                username_teacher = '${username_teacher}'
                WHERE id = '${id}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: "Failed to update the product. Please try again." });
                        return;
                    }
                    res.status(200).json({ status: true, message: "Product updated successfully.", res: result });
                });
            } else {
                res.status(200).json({ status: false, message: "Product not found." });
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};

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
                                res.status(200).json({ status: true, message: "Deleted Successfully" });
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

// delete add teacher management api
exports.delete_add_teacher_management = async (req, res) => {
    const id = req.body.id;
    try {
        if (!id) {
            res.status(200).json({ status: false, message: "ID is required. Cannot delete." });
            return;
        }

        db.query(`SELECT id FROM addteachermanagement WHERE id = '${id}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data. Please try again." });
                return;
            }

            if (result.length > 0) {
                db.query(`DELETE FROM addteachermanagement WHERE id = '${id}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: "Failed to delete the item. Please try again." });
                        return;
                    }
                    res.status(200).json({ status: true, message: "Item deleted successfully." });
                });
            } else {
                res.status(200).json({ status: false, message: "The item does not exist." });
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};












