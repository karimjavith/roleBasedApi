import { Request, Response } from "express";
import * as admin from "firebase-admin";

export async function get(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = admin.firestore();
    const profileDoc = db.collection("profile").doc(id);
    const profile = (await profileDoc.get()).data();
    return res.status(200).send({ profile });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function patch(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { type } = req.body;

    if (!id || !type) {
      return res.status(400).send({ message: "Missing fields" });
    }

    const db = admin.firestore();
    const profileDetails = db.collection("profile").doc(id);
    await profileDetails.update({
      type: { ...type },
    });
    return res.status(204).send({ type });
  } catch (err) {
    return handleError(res, err);
  }
}

function handleError(res: Response, err: any) {
  return res.status(500).send({ message: `${err.code} - ${err.message}` });
}
