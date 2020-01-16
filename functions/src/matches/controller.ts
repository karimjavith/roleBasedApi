import { Request, Response } from "express";
import * as admin from "firebase-admin";

type TMessage = {
  notification: {
    title: string;
    body: string;
  };
  tokens: Array<string>;
};

async function sendPushNotification(message: TMessage) {
  const pushNotifyResult = await admin.messaging().sendMulticast(message);
  console.log(
    pushNotifyResult.successCount + " messages were sent successfully"
  );
  if (pushNotifyResult.failureCount > 0) {
    const failedTokens: Array<string> = [];
    let messageId: any = "";
    pushNotifyResult.responses.forEach((resp, idx) => {
      messageId = resp.messageId;
      if (!resp.success) {
        failedTokens.push(message.tokens[idx]);
      }
    });
    const db = await admin.firestore();
    const date = admin.firestore.Timestamp.now().toDate();
    const docId = `${date.getDate()}${date.getMonth() +
      1}${date.getFullYear()}${date.getUTCHours()}${date.getUTCMinutes()}`;
    const pushLogs = await db
      .collection("pushLogs")
      .doc(docId)
      .set({
        failedTokens: failedTokens,
        messageId: messageId || "not available"
      });
    console.log(pushLogs.writeTime);
    console.log("List of tokens that caused failures: " + failedTokens);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const { venue, date, address, time, status, squad, opponent } = req.body;

    if (!venue || !date || !time) {
      return res.status(400).send({ message: "Insufficient fields" });
    }
    const data = {
      venue,
      date,
      address,
      time,
      status,
      squad, // {player: {token: xxxxx, status: yes = 1 | no = 2 | snoozed = 8 | notResponded* = 4 | notPlayed}}
      opponent,
      createdTime: admin.firestore.Timestamp.now()
        .toDate()
        .toUTCString()
    };
    const db = await admin.firestore();
    try {
      const setDoc = await db
        .collection("matches")
        .doc(date)
        .set(data);
      console.log(setDoc.writeTime);
      const tokens = Object.values(squad).map(
        (result: any) => result.pushToken
      );

      // Create a list containing up to 500 registration tokens.
      // These registration tokens come from the client FCM SDKs.
      const registrationTokens = tokens;

      const message = {
        notification: {
          title: `Camels vs. ${opponent}`,
          body: "Set your availability."
        },
        tokens: registrationTokens
      };

      await sendPushNotification(message);
    } catch (e) {
      return handleError(res, e);
    }

    return res
      .status(201)
      .send({ message: `Created match details for ${date} at ${venue}` });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function all(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = await admin.firestore();
    const listMatches = await db
      .collection("matches")
      .orderBy("createdTime")
      .get();
    if (listMatches.empty) {
      return res.status(200).send({ count: 0 });
    }
    const allMatches: { [key: string]: any } = {};
    listMatches.forEach(doc => {
      const data = doc.data();
      allMatches[doc.id] = {
        status: data.status,
        time: data.time,
        date: data.date,
        venue: data.venue,
        opponent: data.opponent,
        myStatus: data.squad[id].status
      };
    });
    return res.status(200).send({
      data: allMatches,
      count: listMatches.docs.length
    });
  } catch (err) {
    return handleError(res, err);
  }
}
export async function get(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = await admin.firestore();
    const matchDoc = await db.collection("matches").doc(id);
    const matchDetails = await (await matchDoc.get()).data();
    return res.status(200).send({ data: matchDetails });
  } catch (err) {
    return handleError(res, err);
  }
}
export async function getMatchDetailsForUser(req: Request, res: Response) {
  try {
    const { id, uid } = req.params;
    const db = await admin.firestore();
    const matchDoc = await db.collection("matches").doc(id);
    const matchDetails = await (await matchDoc.get()).data();
    return res.status(200).send({
      data: {
        ...matchDetails,
        myStatus: matchDetails?.squad[uid].status,
        squad: null
      }
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
      data.squad[id].status === 4 && count++;
    });
    return res.status(200).send({ count });
  } catch (err) {
    return handleError(res, err);
  }
}
export async function patch(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { venue, date, address, time, status, squad, opponent } = req.body;

    if (!id) {
      return res.status(400).send({ message: "Missing fields" });
    }

    const db = await admin.firestore();
    const matchDetails = await db.collection("matches").doc(id);
    const updateResult = await matchDetails.update({
      venue,
      date,
      address,
      time,
      status,
      squad,
      opponent
    });
    console.log(updateResult.writeTime);
    const tokens = Object.values(squad).map((result: any) => result.pushToken);
    const message = {
      notification: {
        title: `Camels vs. ${opponent}`,
        body: "Set your availability."
      },
      tokens
    };

    await sendPushNotification(message);
    return res.status(204).send({ message: `Update match details ${date}` });
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

export async function remove(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = await admin.firestore();
    const deleteResult = await db
      .collection("matches")
      .doc(id)
      .delete();
    console.log(deleteResult.writeTime);
    return res.status(204).send({});
  } catch (err) {
    return handleError(res, err);
  }
}

function handleError(res: Response, err: any) {
  return res.status(500).send({ message: `${err.code} - ${err.message}` });
}