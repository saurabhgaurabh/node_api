const db = require('../model/connection');
const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');


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
                    console.log(error);
                    res.status(200).json({ status: false, message: "Can not delete this" });
                } else {
                    console.log(result, "resultresult    ")
                    if (result.length > 0) {
                        db.query(`delete from product where id  = '${id}'`, (error, result) => {
                            if (error) {
                                console.log(error);
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
        res.status(200).json({ status: false, message: "Can not Delete" });
    }
};
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
// register user api
exports.register_user = async (req, res) => {
    try {
        const { name, mobile, email, password } = req.body;
        if (name) {
            if (mobile) {
                if (email) {
                    if (password) {
                        db.query(`insert into register_user set ?`, { name, mobile, email, password }, (error, result) => {
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
                    res.status(200).json({ status: true, message: "Email Required." })
                }
            } else {
                res.status(200).json({ status: true, message: "Mobile Required" })
            }
        } else {
            res.status(200).json({ status: true, message: "Username Required" })
        }
    } catch (error) {
        res.status(200).json({ status: true, message: "Error" })
    }
}
// demo email with otp 
exports.email_otp = async (req, res) => {
    try {
        // Generate OTP
        const otp = otpGenerator.generate(6, { digits: true, alphabets: false, upperCase: false, specialChars: false });

        // Send OTP to user via email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'saurabhprajapati0792@gmail.com',
                pass: 'xumeiggxkbgpahfz'
            }
        });
        const mailOptions = {
            from: 'saurabhprajapati0792@gmail.com',
            to: "leadchainsaurabh7@gmail.com",
            subject: 'Registration OTP',
            text: `Your OTP is: ${otp}`
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                res.status(500).send('Failed to send OTP');
            } else {
                console.log(`OTP sent to ${req.body.email}: ${otp}`);
                res.status(200).send('OTP sent successfully');
            }
        });
    } catch (error) {
        console.log(error)
    }
}

// add teacher management  api 
exports.add_teacher_management = async (req, res) => {
    try {
        const { teacher_name, age, email_teacher, address_teacher, username_teacher, password, confirm_password, school_id, eligibility, no_of_degree, experience, position } = req.body;
        if (teacher_name) {
            if (age) {
                if (email_teacher) {
                    if (address_teacher) {
                        if (username_teacher) {
                            if (password) {
                                if (password === confirm_password) {
                                    db.query(`select * from addteachermanagement where teacher_name = '${teacher_name}'and  email_teacher = '${email_teacher}'`, (error, result) => {
                                        if (error) {
                                            res.status(409).json({ status: true, message: "Duplicate Record Can't Accept" })
                                        } else if (result.length > 0) {
                                            res.status(422).json({ status: true, message: "Already Exist" })
                                        } else {
                                            db.query(`insert into addteachermanagement set ?`, { teacher_name, age, email_teacher, address_teacher, username_teacher, password, school_id, eligibility, no_of_degree, experience, position }, (error, result) => {
                                                if (error) {
                                                    res.status(200).json({ status: true, message: "Incorrect Details" })
                                                } else {
                                                    res.status(200).json({ status: true, res: result })
                                                }
                                            })
                                        }
                                    })
                                } else {
                                    res.status(400).json({ status: true, message: "password Mismatch" })
                                }
                            } else {
                                res.status(200).json({ status: true, message: "Password Required" })
                            }
                        } else {
                            res.status(200).json({ status: true, message: "Username Required" })
                        }
                    } else {
                        res.status(200).json({ status: true, message: "Address Required" })
                    }
                } else {
                    res.status(200).json({ status: true, message: "Email Required" })
                }
            } else {
                res.status(200).json({ status: true, message: "age Required" })
            }
        } else {
            res.status(200).json({ status: 200, message: "Teacher Name Required" })
        }        
    } catch (error) {
        res.status(500).json({ status: true, message: "Internal Server Error" })
    }
}