import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { Roles } from "../auth/authorized";

export async function verifyIdToken(req: Request, res: Response) {
  try {
    const { authorization } = req.headers;
    const split = authorization?.split("Bearer ");
    if (split?.length !== 2)
      return res.status(401).send({ message: "Unauthorized" });

    const token = split[1];
    const user = await admin.auth().verifyIdToken(token, true);
    return res.status(200).send({
      verified: true,
      user: {
        uid: user.uid,
        role: user.role
      }
    });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const { displayName, password, email, role, pushToken } = req.body;

    if (!displayName || !password || !email || !role) {
      return res.status(400).send({ message: "Insufficient fields" });
    }
    const db = await admin.firestore();
    const doc = await db
      .collection("invites")
      .doc(email)
      .get();

    if (!doc.exists) {
      return res
        .status(400)
        .send({ message: "Your email address is not invited" });
    }

    const { uid } = await admin.auth().createUser({
      displayName,
      password,
      email
    });
    await admin.auth().setCustomUserClaims(uid, { role, pushToken });

    return res.status(201).send({ uid });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function all(req: Request, res: Response) {
  try {
    const listUsers = await admin.auth().listUsers();
    const users = listUsers.users.map(user => {
      const customClaims = (user.customClaims || { role: 0 }) as {
        role?: Roles;
      };
      const role = customClaims.role;
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role,
        lastSignInTime: user.metadata.lastSignInTime,
        creationTime: user.metadata.creationTime
      };
    });

    return res.status(200).send({ users });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function get(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = await admin.auth().getUser(id);
    return res.status(200).send({ user });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function patch(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { displayName, role } = req.body;

    if (!id || !displayName || !role) {
      return res.status(400).send({ message: "Missing fields" });
    }

    const user = await admin.auth().updateUser(id, { displayName });
    const customClaims = (user.customClaims || { role: 0, pushToken: "" }) as {
      role?: Roles;
      pushToken?: String;
    };
    await admin.auth().setCustomUserClaims(id, {
      role,
      pushToken: customClaims.pushToken
    });
    return res.status(204).send({ user });
  } catch (err) {
    return handleError(res, err);
  }
}
export async function patchPushToken(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).send({ message: "Missing fields" });
    }
    const user = await admin.auth().getUser(id);
    const customClaims = (user.customClaims || { role: 0, pushToken: "" }) as {
      role?: Roles;
      pushToken?: String;
    };
    await admin
      .auth()
      .setCustomUserClaims(id, { pushToken, role: customClaims.role });
    return res.status(204).send({ message: "Updated the push token" });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await admin.auth().deleteUser(id);
    return res.status(204).send({});
  } catch (err) {
    return handleError(res, err);
  }
}

function handleError(res: Response, err: any) {
  return res.status(500).send({ message: `${err.code} - ${err.message}` });
}
