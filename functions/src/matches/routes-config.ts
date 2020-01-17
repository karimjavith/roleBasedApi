import { Application } from "express";
import {
  create,
  all,
  get,
  getMatchDetailsForUser,
  getUnreadMatchCount,
  patch,
  remove,
  patchUserStatus
} from "./controller";
import { isAuthenticated } from "../auth/authenticated";
import { isAuthorized, Roles } from "../auth/authorized";

export function routesConfig(app: Application) {
  app.post(
    "/matches/create",
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin] }),
    create
  );
  // lists all matches
  app.get("/matches/all/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin, Roles.User] }),
    all
  ]);
  // get match with :id for admin
  app.get("/matches/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin], allowSameUser: true }),
    get
  ]);
  // get match with :id for user
  app.get("/matches/details/user/:id/:uid", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.User], allowSameUser: true }),
    getMatchDetailsForUser
  ]);
  // get unreadcount for :id user
  app.get("/matches/unreadCount/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin, Roles.User], allowSameUser: true }),
    getUnreadMatchCount
  ]);
  // updates match details by :id user admin
  app.patch("/matches/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin], allowSameUser: true }),
    patch
  ]);
  // updates match user status by :id user, admin
  app.patch("/matches/details/update/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin, Roles.User], allowSameUser: true }),
    patchUserStatus
  ]);
  // deletes :id user
  app.delete("/matches/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin] }),
    remove
  ]);
}
