import { Request, Response } from "express";
import * as admin from "firebase-admin";

enum Availability {
  YES = 1 << 0,
  NO = 1 << 1,
  NOTRESPONDED = 1 << 2
}
export async function getUpcomingMatchDetails(req: Request, res: Response) {
  try {
    const { uid } = req.params;

    const db = await admin.firestore();
    const upcomingMatch = await db
      .collection("matches")
      .where(
        "date",
        ">",
        admin.firestore.Timestamp.now()
          .toDate()
          .toISOString()
      )
      .orderBy("date", "asc")
      .limit(1)
      .get();
    if (upcomingMatch.empty) {
      return res.status(200).send({ count: 0 });
    }
    const allMatches: { [key: string]: any } = {};
    upcomingMatch.forEach(doc => {
      const data = doc.data();
      allMatches[doc.id] = {
        status: data.status,
        postCode: data.address,
        time: data.time,
        date: data.date,
        id: data.id,
        venue: data.venue,
        opponent: data.opponent,
        myStatus: data.squad[uid] ? data.squad[uid].status : 1 << 2
      };
    });
    return res.status(200).send({
      match: allMatches,
      count: 1
    });
  } catch (err) {
    return handleError(res, err);
  }
}
export async function getUnreadMatchCount(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = await admin.firestore();
    const listMatches = await db.collection("matches").get();

    if (listMatches.empty) {
      return res.status(200).send({ count: 0 });
    }
    let count = 0;
    listMatches.forEach(doc => {
      const data = doc.data();
      data.squad[id].status === Availability.NOTRESPONDED && count++;
    });
    return res.status(200).send({ count });
  } catch (err) {
    return handleError(res, err);
  }
}
export async function patchUserStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, uid } = req.body;

    if (!id) {
      return res.status(400).send({ message: "Missing fields" });
    }

    const db = await admin.firestore();
    const matchDoc = await db.collection("matches").doc(id);

    const matchDetails = await (await matchDoc.get()).data();
    const updateResult = await matchDoc.update({
      squad: {
        ...matchDetails?.squad,
        [uid]: {
          ...matchDetails?.squad[uid],
          status
        }
      }
    });
    console.log(updateResult.writeTime);
    return res.status(204).send({ message: `Updated match details` });
  } catch (err) {
    return handleError(res, err);
  }
}

function handleError(res: Response, err: any) {
  return res.status(500).send({ message: `${err.code} - ${err.message}` });
}
