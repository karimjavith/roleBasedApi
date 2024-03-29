import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import * as cors from "cors";
import * as bodyParser from "body-parser";
import { routesConfig as userRoutes } from "./users/routes-config";
import { routesConfig as profileRoutes } from "./profile/routes-config";
import { routesConfig as matchesRoutes } from "./matches/routes-config";
import { routesConfig as homeRoutes } from "./home/routes-config";
import { Roles } from "./auth/authorized";
const nodemailer = require("nodemailer");

admin.initializeApp();

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: true }));
userRoutes(app);
profileRoutes(app);
matchesRoutes(app);
homeRoutes(app);
export const api = functions.https.onRequest(app);
/**
 * Here we're using Gmail to send
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "karim.dev.2020@gmail.com",
    pass: "<karimdev2020/>",
  },
});
export const sendMailForFunctions = functions.https.onCall(
  async (data, context) => {
    const dest = data.email;

    const mailOptions = {
      from: "Camels <noreply@camels-dev.firebaseapp.com>",
      to: dest,
      subject: "Welcome to Camels!", // email subject
      html: `<p style="font-size: 16px;">Hello,</p>
                   <br />
                   <p>Please click on the below link to sign up for Camel 2020</p>
                   <a href="${data.link}">Sign up</a>
               `, // email content in HTML
    };

    // returning result
    return new Promise(async (resolve, reject) => {
      const decodedToken: admin.auth.DecodedIdToken = await admin
        .auth()
        .verifyIdToken(data.token);
      console.log(decodedToken);
      if (decodedToken.role === Roles.Admin) {
        transporter.sendMail(mailOptions, async (error: any, info: any) => {
          if (error) {
            reject({
              message: error,
              isError: true,
            });
          }
          resolve({
            message: "Email sent!!",
            isError: false,
          });
        });
      } else {
        console.log(`User ${decodedToken.uid} not authorised to send invite`);
        reject({
          status: 400,
          isError: true,
          message: "You are not authorised to send invite",
        });
      }
    });
  }
);
