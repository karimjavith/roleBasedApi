import { Application } from "express";
import {
  getUpcomingMatchDetails,
  getUnreadMatchCount,
  patchUserStatus
} from "./controller";
import { isAuthenticated } from "../auth/authenticated";
import { isAuthorized, Roles } from "../auth/authorized";

export function routesConfig(app: Application) {
  // get match with :id for user
  app.get("/home/matches/upcoming/:uid", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.User, Roles.Admin], allowSameUser: true }),
    getUpcomingMatchDetails
  ]);
  // get unreadcount for :id user
  app.get("/home/matches/unreadCount/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin, Roles.User], allowSameUser: true }),
    getUnreadMatchCount
  ]);
  // updates match user status by :uid user, admin
  app.patch("/home/matches/update/status/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin, Roles.User], allowSameUser: true }),
    patchUserStatus
  ]);
}
