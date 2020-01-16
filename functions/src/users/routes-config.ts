import { Application } from "express";
import { create, all, get, patch, remove, verifyIdToken } from "./controller";
import { isAuthenticated } from "../auth/authenticated";
import { isAuthorized, Roles } from "../auth/authorized";

export function routesConfig(app: Application) {
  app.get("/users/verifyIdToken", [verifyIdToken]);
  app.post(
    "/users/create",
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin, Roles.User] }),
    create
  );
  app.post("/users/signup", [create]);
  // lists all users
  app.get("/users", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin] }),
    all
  ]);
  // get :id user
  app.get("/users/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin, Roles.User], allowSameUser: true }),
    get
  ]);
  // updates :id user
  app.patch("/users/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin], allowSameUser: true }),
    patch
  ]);
  // deletes :id user
  app.delete("/users/:id", [
    isAuthenticated,
    isAuthorized({ hasRole: [Roles.Admin] }),
    remove
  ]);
}
