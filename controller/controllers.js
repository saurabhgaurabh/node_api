const db = require('../model/connection');
const nodemailer = require("nodemailer");
const otpGenerator = require('otp-generator');
const bcrypt = require('bcrypt')
const speakeasy = require('speakeasy')
const jwt = require('jsonwebtoken');
const fs = require('fs');
const MY_SECRET_KEY = process.env.SECRET_KEY


//login user api
exports.login_user = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email) return res.status(400).json({ status: false, message: "Email is required." });
        if (!password) return res.status(400).json({ status: false, message: "Password is required." });

        db.query(`SELECT * FROM register_user WHERE email = '${email}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data. Please try again." });
                return;
            }

            if (result.length === 0) return res.status(200).json({ status: false, message: "Incorrect email or password." });

            const hashedPassword = result[0].password;
            bcrypt.compare(password, hashedPassword, (error, passwordMatch) => {
                if (error) {
                    res.status(500).json({ status: false, message: "Failed to compare passwords. Please try again." });
                    return;
                }

                if (!passwordMatch) {
                    res.status(200).json({ status: false, message: "Incorrect password." });
                    return;
                };

                const token = jwt.sign({ email: email }, MY_SECRET_KEY, { expiresIn: '5h' });
                const newData = result[0];
                return res.status(200).json({ status: true, message: "Login successful.", token: token, email, newData }); // newData adding extra data 
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
                    return res.status(400).json({ status: false, message: "User already registered and verified." });
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
                    `INSERT INTO register_user (name, mobile, email, secret, password, otp) VALUES (?, ?, ?, ?, ?, ?)`, [name, mobile, email, secret, hashedPassword, otp],
                    (insertError) => {
                        if (insertError) {
                            return res.status(500).json({ status: false, message: `Database error while insert: ${insertError}` });
                        }
                        sendOtpToEmail(email, otp);  // Send OTP to the user's email
                        return res.status(200).json({ status: true, message: "User registered. Please verify your email.", name: name, mobile: mobile, email: email });
                    }
                );
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: `Internal Server Error 4: ${error}` });
    }
}

/// this is send email function for register user api
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
                            window: 60,
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

// forget password api...
exports.forget_password = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(404).json({ status: false, message: "Email is required." });

        var secret = speakeasy.generateSecret().base32; // New user, generate OTP and insert into database
        console.log(secret, "secret")
        var otp = speakeasy.totp({
            secret: secret,
            encoding: 'base32'
        });

        db.query(`select email from register_user where email = '${email}'`, (error, result) => {
            if (error) {
                res.status(404).json({ status: false, message: "Failed to fetch data, please try again." });
            } else {
                db.query(`update register_user set otp = ?, secret = ? where email = ?`, [otp, secret, email], (error, result) => {
                    if (error) {
                        res.status(404).json({ status: false, message: "Failed to update OTP, please try again." });
                    } else {
                        sendOtpToForgetPassword(email, otp)
                        res.status(200).json({ status: true, message: "confirm email send successfully.", res: result });
                    }
                })
            }
        })

    } catch (error) {
        res.status(500).json({ status: false, message: `Internal Server Error. '${error}}'` });
    }
}

// send email for forget password api...
async function sendOtpToForgetPassword(email, otp) {
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
            text: `Hello user, your OTP for forget password is ${otp}`,
            html: `<b>This is your OTP for forget password: ${otp}</b>`,
        });
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

// verify opt for forget password api
exports.verify_otp_forget_password = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ status: false, message: "Email and OTP are required." });
        }

        db.query(`SELECT secret FROM register_user WHERE email = ? AND otp = ?`, [email, otp], (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data, please try again." });
            } else {
                if (result && result.length > 0) {
                    const isValidOTP = speakeasy.totp.verify({
                        encoding: 'base32',
                        secret: result[0].secret,
                        window: 6,
                        token: otp
                    })
                    if (isValidOTP) {
                        res.status(200).json({ status: true, message: "OTP is valid." });
                    }
                } else {
                    res.status(400).json({ status: false, message: "Invalid OTP." });
                }
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: `Internal Server Error. '${error}'` });
    }
};

// update password api 
exports.update_password = async (req, res) => {
    try {
        const { email, otp, password } = req.body;
        console.log(req.body, "req.body")
        if (!email || !otp || !password) return res.status(400).json({ status: false, message: "Email, OTP, and password are required." });

        db.query(`SELECT * FROM register_user WHERE email = ?`, [email], (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data, please try again." });
            } else {
                if (result && result.length > 0) {
                    const isValidOTP = speakeasy.totp.verify({
                        secret: result[0].secret,
                        encoding: 'base32',
                        window: 60,
                        token: otp
                    });
                    if (isValidOTP) {
                        const salt = bcrypt.genSaltSync(10);
                        const hashedPassword = bcrypt.hashSync(password, salt);
                        // OTP is valid, update the password
                        db.query(`UPDATE register_user SET password = ? WHERE email = ?`, [hashedPassword, email], (error, result) => {
                            if (error) {
                                res.status(500).json({ status: false, message: `Failed to update password, please try again.'${error}'` });
                            } else {
                                res.status(200).json({ status: true, message: "Password updated successfully.", res: result });
                            }
                        });
                    } else {
                        res.status(200).json({ status: true, message: "Invalid OTP." });
                    }
                } else {
                    res.status(400).json({ status: false, message: "Not verified OTP." });                  // OTP is invalid
                }
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: `Internal Server Error. '${error}'` });
    }
};

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

// add category_product api
exports.category_product = async (req, res) => {
    try {
        const { cat_id, cat_name, cat_discription, cat_price } = req.body;
        if (!cat_name) return res.status({ status: false, message: "Catemogy Name is Required." })
        if (!cat_discription) return res.status({ status: false, message: "Catemogy Discription is Required." })
        if (!cat_price) return res.status({ status: false, message: "Catemogy Price is Required." })

        db.query(`select * from product_category where cat_name = '${cat_name}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: `Failed to fetch data, Please Try again. ${error}` });
            } else if (result.length > 0) {
                res.status(409).json({ status: false, message: "Item already exist." })
            } else {
                db.query(`insert into product_category set ? `, { cat_name, cat_discription, cat_price }, (error, result) => {
                    if (error) {
                        res.status(404).json({ status: false, message: "item can not insert." });
                    } else {
                        res.status(200).json({ status: false, message: "Inserted Successfully.", res: result });
                    }
                });
            }
        });

    } catch (error) {
        res.status(500).json({ status: false, message: `Internal Server Error.${error}` })
    }
}

// track teacher management api
exports.track_teacher_management = async (req, res) => {
    try {
        const {
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
            img_highschool,
            adhar_card,
            pan_Card,
            teacher_img,
        } = req.body;

        if (!teacher_name) return res.status(404).json({ status: false, message: "Teacher Name required." });
        if (!email) return res.status(404).json({ status: false, message: "Email is required" });
        if (!mobile) return res.status(404).json({ status: false, message: "Mobile required" });
        if (!previous_organization) return res.status(404).json({ status: false, message: "Previous Organization is Required" });
        if (!experience) return res.status(404).json({ status: false, message: "experience is required" });
        if (!qualification) return res.status(404).json({ status: false, message: "qualification is required" });
        if (!no_of_degree) return res.status(404).json({ status: false, message: "no_of_degree is required" });
        if (!permanent_residence) return res.status(404).json({ status: false, message: "permanent_residence is required" });
        if (!current_residence) return res.status(404).json({ status: false, message: "current_residence is required" });
        if (!previous_position) return res.status(404).json({ status: false, message: "previous_position is required" });
        if (!current_position) return res.status(404).json({ status: false, message: "current_position is required" });


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
        };

        if (img_highschool) {
            const highschoolImgData = img_highschool.split(';base64,').pop();
            const highschoolImgPath = `uploads/${Date.now()}_highschool.jpg`;

            fs.writeFile(highschoolImgPath, highschoolImgData, { encoding: 'base64' }, (err) => {
                if (err) {
                    console.error(err, "error of file");
                    res.status(500).json({ status: false, message: "Failed to save high school image." });
                    return;
                }
            });

            trackTeacherData.img_highschool = highschoolImgPath;
        }
        if (adhar_card) {
            const adharCardImgData = adhar_card.split(';base64,').pop();
            const adharCardImgPath = `uploads/${Date.now()}_highschool.jpg`;

            fs.writeFile(adharCardImgPath, adharCardImgData, { encoding: 'base64' }, (err) => {
                if (err) {
                    console.error(err, "error of file");
                    res.status(500).json({ status: false, message: "Failed to save high school image." });
                    return;
                }
            });

            trackTeacherData.adhar_card = adharCardImgPath;
        }
        if (pan_Card) {
            const panCardImgData = pan_Card.split(';base64,').pop();
            const panCardImgPath = `uploads/${Date.now()}_highschool.jpg`;

            fs.writeFile(panCardImgPath, panCardImgData, { encoding: 'base64' }, (err) => {
                if (err) {
                    console.error(err, "error of file");
                    res.status(500).json({ status: false, message: "Failed to save high school image." });
                    return;
                }
            });

            trackTeacherData.pan_Card = panCardImgPath;
        }
        if (teacher_img) {
            const teacherImgData = teacher_img.split(';base64,').pop();
            const teacherImgPath = `uploads/${Date.now()}_highschool.jpg`;

            fs.writeFile(teacherImgPath, teacherImgData, { encoding: 'base64' }, (err) => {
                if (err) {
                    console.error(err, "error of file");
                    res.status(500).json({ status: false, message: "Failed to save high school image." });
                    return;
                }
            });

            trackTeacherData.teacher_img = teacherImgPath;
        }


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
        res.status(500).json({ status: false, messaage: `Internal server error '${error}'` })
    }
};

// salary api
exports.salary_management = async (req, res) => {
    try {
        const { teacher_name, month, salary, position, performance, attendance } = req.body;
        if (!teacher_name) return res.status(404).json({ status: false, message: "teacher name is required" });
        if (!month) return res.status(404).json({ status: false, message: "month is required" });
        if (!salary) return res.status(404).json({ status: false, message: "salary is required" });
        if (!position) return res.status(404).json({ status: false, message: "position is required" });
        if (!performance) return res.status(404).json({ status: false, message: "performance is required" });
        if (!attendance) return res.status(404).json({ status: false, message: "attendance is required" });

        const salaryData = { teacher_name, month, salary, position, performance, attendance };

        db.query(`select * from salary where teacher_name = '${teacher_name}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data, Please try again" });
            } else if (result.length > 0) {
                res.status(409).json({ status: true, message: "Item already exist!" });
            } else {
                db.query(`insert into salary set ?`, salaryData, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: `Failed to insert item. Please try again. '${error}'` })
                    } else {
                        res.status(200).json({ status: true, message: "Inserted Successfully", res: result });
                    }
                });
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, messaage: `Internal server error '${error}'` })
    }
}

// add teacher_joining_management api
exports.teacher_joining_management = async (req, res) => {
    try {
        const { teacher_name, email, address, mobile, privious_salary, position, reference, communication_skills, experience_at_joiningtime, total_experience } = req.body;

        if (!teacher_name) return res.status(404).json({ status: false, message: "teacher name is required." });
        if (!email) return res.status(404).json({ status: false, message: "email is required." });
        if (!address) return res.status(404).json({ status: false, message: "address is required." });
        if (!mobile) return res.status(404).json({ status: false, message: "mobile is required." });
        if (!privious_salary) return res.status(404).json({ status: false, message: "privious salary is required." });
        if (!position) return res.status(404).json({ status: false, message: "position is required." });
        if (!reference) return res.status(404).json({ status: false, message: "reference is required." });
        if (!experience_at_joiningtime) return res.status(404).json({ status: false, message: "experience at joiningtime is required." });
        if (!total_experience) return res.status(404).json({ status: false, message: "total experience is required." });

        // Define the allowed fields in your API
        const allowedFields = ['teacher_name', 'email', 'address', 'mobile', 'joining_date', 'privious_salary', 'position', 'reference', 'communication_skills', 'experience_at_joiningtime', 'total_experience'];
        // Check for unknown fields
        const unknownFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
        if (unknownFields.length > 0) {
            return res.status(400).json({ status: false, message: `Unknown fields: ${unknownFields.join(', ')}` });
        }

        const joiningData = { teacher_name, email, address, mobile, privious_salary, position, reference, communication_skills, experience_at_joiningtime, total_experience };

        db.query(`select * from teacher_joining where teacher_name = '${teacher_name}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data, Please try again." });
            } else if (result.length > 0) {
                res.status(409).json({ status: true, message: "Item already exist." });
            } else {
                db.query(`insert into teacher_joining set ?`, joiningData, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: `Failed to insert data, Please try again. '${error}'` });
                    } else {
                        res.status(200).json({ status: true, message: "Inserted Successfully.", res: result });
                    }
                });
            }
        });

    } catch (error) {
        res.status(500).json({ status: false, messaage: `Internal server error. '${error}'` });
    }
}

// myclass_management api 
exports.myclass_management = async (req, res) => {
    try {
        const { class_name_numeric, class_name_alphabate } = req.body;

        if (!class_name_numeric) return res.status(404).json({ status: false, message: "class in numeric is required." });
        if (!class_name_alphabate) return res.status(404).json({ status: false, message: "class in alphabate is required." });

        const myClassData = { class_name_numeric, class_name_alphabate };
        db.query(`select * from myclass where class_name_alphabate = '${class_name_alphabate}' || class_name_numeric = '${class_name_numeric}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: `Failed to fetch data, Please try again. '${error}'` });
            } else if (result.length > 0) {
                res.status(409).json({ status: true, message: "Item already exists!" });
            } else {
                db.query(`insert into myclass set ?`, myClassData, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: "Failed to fetch data, Please try again." });
                    } else {
                        res.status(200).json({ status: true, message: "Inserted Successfully.", res: result });
                    }
                });
            }
        });

    } catch (error) {
        res.status(500).json({ status: false, messsage: `Internal server error. '${error}'` });
    }
};


// mybooks_management api 
exports.mybooks_management = async (req, res) => {
    try {
        const { book_name, book_code, authore, edition } = req.body;

        if (!book_name) return res.status(404).json({ status: false, message: "book name is required" });
        if (!book_code) return res.status(404).json({ status: false, message: "book_code name is required" });
        if (!authore) return res.status(404).json({ status: false, message: "authore name is required" });
        if (!edition) return res.status(404).json({ status: false, message: "edition name is required" });

        const myBookData = { book_name, book_code, authore, edition };

        db.query(`select * from mybooks where book_name = '${book_name}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: `Failed to fetch data, please try again. '${error}'` })
            } else if (result.length > 0) {
                res.status(500).json({ status: false, message: "item already exists!" })
            } else {
                db.query(`insert into mybooks set ?`, myBookData, (error, result) => {
                    if (error) {
                        res.status(404).json({ status: false, message: 'Failed to insert data, Please try again.' });
                    } else {
                        res.status(200).json({ status: true, message: "Inserted Successfully.", res: result });
                    }
                });
            }
        });

    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error. '${error}'` });
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
                                res.status(409).json({ status: false, message: "Duplicate Product" });
                            } else {
                                db.query(`update product set product_name= '${product_name}', product_type= '${product_type}', discription= '${discription}' where id = '${id}'`, (error, result) => {
                                    if (error) {
                                        console.log(error);
                                        res.status(404).json({ status: false, message: "Product are not updated333" });
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
            res.status(404).json({ status: false, message: "Product ID is required." });
            return;
        }

        if (!teacher_name) {
            res.status(404).json({ status: false, message: "Teacher name is required." });
            return;
        }

        if (!age) {
            res.status(404).json({ status: false, message: "Age is required." });
            return;
        }

        if (!email_teacher) {
            res.status(404).json({ status: false, message: "Email is required." });
            return;
        }

        if (!address_teacher) {
            res.status(404).json({ status: false, message: "Address is required." });
        }

        if (!username_teacher) {
            res.status(404).json({ status: false, message: "Username is required." });
        }

        if (!password & password === confirm_password) {
            res.status(404).json({ status: false, message: "Password is required" });
        }

        if (!experience) {
            res.status(404).jsom({ status: false, message: "experience is reqiured" });
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
                username_teacher = '${username_teacher}',
                experience = '${experience}'
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

// update_track_teacher_management api
exports.update_track_teacher_management = async (req, res) => {
    try {
        const {
            trackID,
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
            img_highschool,
            adhar_card,
            pan_Card,
            teacher_img,
        } = req.body;

        if (!trackID) return res.status(409).json({ status: false, messaage: "reacher name is required" });
        if (!teacher_name) return res.status(409).json({ status: false, messaage: "reacher name is required" });
        if (!email) return res.status(409).json({ status: false, message: "email is required" });
        if (!mobile) return res.status(409).json({ status: false, message: "mobile is required" });
        if (!previous_organization) return res.status(409).json({ status: false, message: "previous organization is required" });
        if (!experience) return res.status(409).json({ status: false, message: "experience is required" });
        if (!qualification) return res.status(409).json({ status: false, message: "qualification is required" });
        if (!no_of_degree) return res.status(409).json({ status: false, message: "no of degree is required" });
        if (!permanent_residence) return res.status(409).json({ status: false, message: "permanent residence is required" });
        if (!current_residence) return res.status(409).json({ status: false, message: "current residence is required" });
        if (!previous_position) return res.status(409).json({ status: false, message: "previous position is required" });
        if (!current_position) return res.status(409).json({ status: false, message: "current position is required" });
        if (!current_position) return res.status(409).json({ status: false, message: "current position is required" });

        // Check if the track teacher exists
        db.query(`SELECT teacher_name FROM track_teacher WHERE trackID = '${trackID}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data. Please try again." });
                return;
            }

            if (result.length > 0) {
                db.query(`UPDATE track_teacher SET 
                teacher_name = '${teacher_name}',
                email = '${email}',
                mobile = '${mobile}',
                previous_organization = '${previous_organization}',
                experience = '${experience}',
                qualification = '${qualification}',
                no_of_degree = '${no_of_degree}',
                permanent_residence = '${permanent_residence}',
                current_residence = '${current_residence}',
                previous_position = '${previous_position}',
                current_position = '${current_position}'
                WHERE trackID = '${trackID}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: "Failed to update the Item. Please try again." });
                        return;
                    }
                    res.status(200).json({ status: true, message: "Product updated successfully.", res: result });
                });
            } else {
                res.status(500).json({ status: false, message: "Item not found." });
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error: ${error}` });
    }
};

// update_salary_management api 
exports.update_salary_management = async (req, res) => {
    try {
        const { salaryID, teacher_name, month, salary, position, performance, attendance } = req.body;

        if (!salaryID) return res.status(404).json({ status: false, message: "salaryID is required" });
        if (!teacher_name) return res.status(404).json({ status: false, message: "teacher name is required" });
        if (!month) return res.status(404).json({ status: false, message: "month name is required" });
        if (!salary) return res.status(404).json({ status: false, message: "salary is required" });
        if (!position) return res.status(404).json({ status: false, message: "position is required" });
        if (!performance) return res.status(404).json({ status: false, message: "performance is required" });
        if (!attendance) return res.status(404).json({ status: false, message: "attendance is required" });

        // Define the allowed fields in your API
        const allowedFields = ['salaryID', 'teacher_name', 'month', 'salary', 'position', 'performance', 'attendance'];
        // Check for unknown fields
        const unknownFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
        if (unknownFields.length > 0) {
            return res.status(400).json({ status: false, message: `Unknown fields: ${unknownFields.join(', ')}` });
        }
        // Check if any of the fields are not allowed for update
        const disallowedFields = ['teacher_name', 'month', 'salary', 'position', 'performance', 'attendance']; // Add the field names that are not allowed for update
        const invalidFields = Object.keys(req.body).filter(field => disallowedFields.includes(field));
        if (invalidFields.length > 0) {
            return res.status(400).json({ status: false, message: `Update not allowed for fields: ${invalidFields.join(', ')}` });
        }

        db.query(`select * from salary where salaryID = '${salaryID}'`, (error, result) => {
            if (error) return res.status(500).json({ staus: false, message: `Failed to fetch data. Please try again. '${error}'` });
            if (result.length > 0) {
                db.query(`update salary set
                 teacher_name = '${teacher_name}',
                 month = '${month}',
                 salary = '${salary}',
                 position = '${position}',
                 performance = '${performance}',
                 attendance = '${attendance}'
                where salaryID = '${salaryID}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: "Failed to update the Item. Please try again." });
                    } else {
                        res.status(200).json({ status: true, message: "Item updated Successfully.", res: result })
                    }
                });
            } else {
                res.status(500).json({ status: false, message: "Item not found." });
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error. '${error}'` });
    }
};

// update_teacher_joining_management api
exports.update_teacher_joining_management = async (req, res) => {
    try {
        const { joining_id, teacher_name, email, address, mobile, privious_salary, position, reference, communication_skills, experience_at_joiningtime, total_experience } = req.body;

        if (!joining_id) res.status(404).json({ status: false, message: "Id is required, can not update." });
        if (!teacher_name) res.status(404).json({ status: false, message: "teacher name is required, can not update." });
        if (!email) res.status(404).json({ status: false, message: "email is required, can not update." });
        if (!address) res.status(404).json({ status: false, message: "address is required, can not update." });
        if (!mobile) res.status(404).json({ status: false, message: "mobile is required, can not update." });
        if (!privious_salary) res.status(404).json({ status: false, message: "privious salary is required, can not update." });
        if (!position) res.status(404).json({ status: false, message: "position is required, can not update." });
        if (!reference) res.status(404).json({ status: false, message: "reference is required, can not update." });
        if (!communication_skills) res.status(404).json({ status: false, message: "communication skills is required, can not update." });
        if (!experience_at_joiningtime) res.status(404).json({ status: false, message: "experience at joiningtime is required, can not update." });
        if (!total_experience) res.status(404).json({ status: false, message: "total_experience is required, can not update." });

        // validate fields to update
        const allowedFields = ['joining_id', 'teacher_name', 'email', 'address', 'mobile', 'privious_salary', 'position', 'reference', 'communication_skills', 'experience_at_joiningtime', 'experience_at_joiningtime', 'total_experience'];
        const unknownFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
        if (unknownFields.length > 0) {
            return res.status(400).json({ status: false, message: `Unknown fields: ${unknownFields.join(', ')}` });
        }

        db.query(`select * from teacher_joining where joining_id = '${joining_id}'`, (error, result) => {
            if (error) return res.status({ status: false, message: `Failed to update item, Please try again. '${error}'` });
            if (result.length > 0) {
                db.query(`update teacher_joining set 
                teacher_name = '${teacher_name}',
                email = '${email}',
                address = '${address}',
                mobile = '${mobile}',
                privious_salary = '${privious_salary}',
                position = '${position}',
                reference = '${reference}',
                communication_skills = '${communication_skills}',
                experience_at_joiningtime = '${experience_at_joiningtime}',
                total_experience = '${total_experience}'
                where joining_id = '${joining_id}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, messsage: "Failed to fetch data, can't update." });
                    } else {
                        res.status(200).json({ status: true, message: "item updated successfully.", res: result });
                    }
                });
            } else {
                res.status(500).json({ status: false, message: "Item not found" });
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error. '${error}''` });
    }
}

// update_myclas_management api 
exports.update_myclas_management = async (req, res) => {
    try {
        const { classID, class_name_numeric, class_name_alphabate } = req.body;
        if (!classID) return res.status(404).json({ status: false, message: "id is required, can't delete." });
        if (!class_name_numeric) return res.status(404).json({ status: false, message: "class_name_numeric is required, can't delete." });
        if (!class_name_alphabate) return res.status(404).json({ status: false, message: "class_name_alphabate is required, can't delete." });

        db.query(`select * from myclass where classID = '${classID}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: `Failed to load data, Please try again.'${error}'` });
                return;
            }
            if (result.length > 0) {
                db.query(`update myclass set class_name_numeric = '${class_name_numeric}', class_name_alphabate = '${class_name_alphabate}'
                where classID = '${classID}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: `Failed to fetch data, Please try again. '${error}'` });
                    } else {
                        res.status(200).json({ status: true, message: "item updated successfully.", res: result });
                    }
                });
            } else {
                res.status(409).json({ status: true, message: "item alredy exists!" });
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error, '${error}'` });
    }
}


// update_mybooks_management api 
exports.update_mybooks_management = async (req, res) => {
    try {
        const { bookID, book_name, book_code, authore, edition } = req.body;
        if (!bookID) return res.status(404).json({ status: false, message: "id is reqiored," });
        if (!book_name) return res.status(404).json({ status: false, message: "book_name is reqiored," });
        if (!book_code) return res.status(404).json({ status: false, message: "book_code is reqiored," });
        if (!authore) return res.status(404).json({ status: false, message: "authore is reqiored," });
        if (!edition) return res.status(404).json({ status: false, message: "edition is reqiored," });

        const allowedFields = ['bookID', 'book_name', 'book_code', 'authore', 'edition'];
        const unknownFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
        if (unknownFields.length > 0) {
            return res.status(400).json({ status: false, message: `Unknown Fields ${unknownFields.join(', ')}` })
        }

        db.query(`select * from mybooks where bookID = '${bookID}'`, (error, result) => {
            if (error) return res.status(500).json({ status: false, message: `Failed to fetch data, Please try again.` });
            if (result.length > 0) {
                db.query(`update mybooks set 
                book_name = '${book_name}',
                book_code = '${book_code}',
                authore = '${authore}',
                edition = '${edition}'
                where bookID = '${bookID}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: `Failed to update data, please try again.` });
                    } else {
                        res.status(200).json({ status: true, message: `Item Updated Successfully.`, res: result });
                    }
                });
            } else {
                res.status(500).json({ status: false, message: "Item not found" });
            }
        })


    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error. '${error}'` });
    }
};

// delete product api 
exports.delete_product = async (req, res) => {
    const id = req.body.id;
    try {
        if (id) {
            db.query(`select id from product where id = '${id}'`, (error, result) => {
                if (error) {
                    res.status(200).json({ status: false, message: "Can not delete this." });
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

// delete_track_teacher_management api
exports.delete_track_teacher_management = async (req, res) => {
    try {
        const { trackID } = req.body;

        if (!trackID) {
            res.status(200).json({ status: true, message: "Id is required can not delete" });
            return;
        }

        db.query(`select trackID from track_teacher where trackID = '${trackID}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: "Failed to fetch data, try again" });
                return;
            }
            if (result.length > 0) {
                db.query(`delete from track_teacher where trackID = '${trackID}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: "Failed to delete the item. Please try again." });
                    } else {
                        res.status(200).json({ status: true, message: "Item deleted Successfully", res: result });
                    }
                });
            } else {
                res.status(200).json({ status: true, message: "Item does not exist" });
            }
        });

    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error '${error}'` })
    }
}

// delete_salary_management api 
exports.delete_salary_management = async (req, res) => {
    try {
        const { salaryID } = req.body;
        if (!salaryID) return res.status(404).json({ status: false, message: "id is required." });

        db.query(`SELECT salaryID FROM salary WHERE salaryID = '${salaryID}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: `Failed to fetch data. Please try again. '${error}'` });
                return;
            }
            if (result.length > 0) {
                db.query(`DELETE FROM salary WHERE salaryID = '${salaryID}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: `Failed to delete item. Please try again. '${error}'` });
                    } else {
                        res.status(200).json({ status: true, message: "Item deleted successfully.", res: result });
                    }
                });
            } else {
                res.status(500).json({ status: false, message: "Item does not exist!" });
            }
        });
    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error. '${error}'` });
    }
};

// delete_teacher_joining_management api 
exports.delete_teacher_joining_management = async (req, res) => {
    try {
        const { joining_id } = req.body;
        if (!joining_id) return res.status(404).json({ status: false, message: "id required, can't delete item" });

        db.query(`select joining_id from teacher_joining where joining_id = '${joining_id}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: `Failed to fetch data, Please try again.` });
                return;
            };
            if (result.length > 0) {
                db.query(`delete from teacher_joining where joining_id = '${joining_id}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: `Failed to delete item, Please try again. '${error}'` });
                    } else {
                        res.status(200).json({ status: false, message: "Item deleted Successfully.", res: result });
                    }
                });
            } else {
                res.status(500).json({ status: false, message: "Item does't exists!" });
            }
        });

    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error. '${error}'` });
    }
};

// delete_myclass_management api
exports.delete_myclass_management = async (req, res) => {
    try {
        const { classID } = req.body;

        if (!classID) return res.status(404).json({ status: false, message: "id is required, can't delete." });

        db.query(`select * from myclass where classID = '${classID}'`, (error, result) => {
            if (error) {
                res.status(500).json({ status: false, message: `Failed to fetch data, Please try again. '${error}'` });
                return;
            }
            if (result.length > 0) {
                db.query(`delete from myclass where classID = '${classID}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: `Failed to delete data, Please try agian. '${error}'` });
                    } else {
                        res.status(200).json({ status: true, message: "Item deleted Successfully.", res: result });
                    }
                });
            } else {
                res.status(500).json({ status: false, message: "item does't exists!" });
            }
        });

    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error. '${error}'` });
    }
};

// delete_mybooks_managementapi 
exports.delete_mybooks_management = async (req, res) => {
    try {
        const { bookID } = req.body;

        if (!bookID) return res.status({ status: false, message: "id is required, can't delete item." });

        db.query(`select * from mybooks where bookID = '${bookID}'`, (error, result) => {
            if (error) return res.status(500).json({ status: false, message: `Failed to fetch data, please try again.` });

            if (result.length > 0) {
                db.query(`delete from mybooks where bookID = '${bookID}'`, (error, result) => {
                    if (error) {
                        res.status(500).json({ status: false, message: `Failed to delete item, Please try again. '${error}'` });
                    } else {
                        res.status(200).json({ status: true, message: `Item deleted Successfully.`, res: result });
                    }
                });
            } else {
                res.status(500).json({ status: false, message: `Item does not exists!` })
            }
        });


    } catch (error) {
        res.status(500).json({ status: false, message: `Internal server error. '${error}'` });
    }
}
