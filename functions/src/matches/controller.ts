import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { UserRecord } from "firebase-functions/lib/providers/auth";

type TMessage = {
  notification: {
    title: string;
    body: string;
  };
  tokens: Array<string>;
};

enum Availability {
  YES = 1 << 0,
  NO = 1 << 1,
  NOTRESPONDED = 1 << 2,
}

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
    const docId = `${date.getDate()}${
      date.getMonth() + 1
    }${date.getFullYear()}${date.getUTCHours()}${date.getUTCMinutes()}`;
    const pushLogs = await db
      .collection("pushLogs")
      .doc(docId)
      .set({
        failedTokens: failedTokens,
        messageId: messageId || "not available",
      });
    console.log(pushLogs.writeTime);
    console.log("List of tokens that caused failures: " + failedTokens);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const { venue, date, address, time, status, opponent } = req.body;

    if (!venue || !date || !time || !opponent) {
      return res.status(400).send({ message: "Insufficient fields" });
    }
    const matchDateWithFormat = new Date(
      date.split("/")[0],
      date.split("/")[1],
      date.split("/")[2]
    );
    const data = {
      id: `${new Date(date)
        .toLocaleDateString()
        .replace(/-/g, "")}${time.replace(/:/g, "")}${opponent.replace(
        /\s/g,
        ""
      )}`,
      venue,
      date,
      matchDateWithFormat,
      address,
      time,
      status,
      opponent,
      createdTime: admin.firestore.Timestamp.now().toDate().toUTCString(),
      updatedTime: admin.firestore.Timestamp.now().toDate().toUTCString(),
    };

    // getUsersToken
    const listUsers = await admin.auth().listUsers();
    let squad = {};
    listUsers.users.forEach((user) => {
      const customClaims = (user.customClaims || { pushToken: "" }) as {
        pushToken?: string;
      };
      const pushToken = customClaims.pushToken;
      squad = {
        ...squad,
        [user.uid]: {
          pushToken,
          status: Availability.NOTRESPONDED,
          displayName: user.displayName,
        },
      };
    });

    const db = await admin.firestore();
    try {
      const setDoc = await db
        .collection("matches")
        .doc(data.id)
        .set({ ...data, squad });
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
          body: "Set your availability.",
        },
        tokens: registrationTokens,
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
    if (!id) {
      return res
        .status(400)
        .send({ message: `Missing field id --- value ${id}` });
    }
    const db = await admin.firestore();
    const listMatches = await db
      .collection("matches")
      .orderBy("matchDateWithFormat", "desc")
      .get();
    if (listMatches.empty) {
      return res.status(200).send({ count: 0 });
    }
    const allMatches: { [key: string]: any } = {};
    listMatches.forEach((doc) => {
      const data = doc.data();
      allMatches[doc.id] = {
        status: data.status,
        postCode: data.address,
        time: data.time,
        date: data.date,
        id: data.id,
        venue: data.venue,
        opponent: data.opponent,
        myStatus: data.squad[id] ? data.squad[id].status : 1 << 2,
        totalSquad: data.squad,
      };
    });
    return res.status(200).send({
      data: allMatches,
      count: listMatches.docs.length,
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
        myStatus: matchDetails?.squad[uid]
          ? matchDetails?.squad[uid].status
          : 1 << 2,
        squad: null,
      },
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
    listMatches.forEach((doc) => {
      const data = doc.data();
      data.squad[id].status === Availability.NOTRESPONDED && count++;
    });
    return res.status(200).send({ count });
  } catch (err) {
    return handleError(res, err);
  }
}
export async function patch(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { venue, date, address, time, status, opponent } = req.body;

    if (!id) {
      return res.status(400).send({ message: "Missing fields" });
    }

    const db = await admin.firestore();
    const matchDetails = await db.collection("matches").doc(id);
    await matchDetails.update({
      venue,
      date,
      address,
      time,
      status,
      opponent,
      updatedTime: admin.firestore.Timestamp.now().toDate().toUTCString(),
    });
    // getUsersToken
    const listUsers = await admin.auth().listUsers();
    let squad = {};
    listUsers.users.forEach((user: UserRecord) => {
      const customClaims = (user.customClaims || { pushToken: "" }) as {
        pushToken?: string;
      };
      const pushToken = customClaims.pushToken;
      squad = { ...squad, [user.uid]: { pushToken } };
    });
    const tokens = Object.values(squad).map((result: any) => result.pushToken);
    const message = {
      notification: {
        title: `Camels vs. ${opponent}`,
        body: "Updated! Set your availability.",
      },
      tokens,
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
          ...matchDetails?.squad[uid],
          status,
        },
      },
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
    const deleteResult = await db.collection("matches").doc(id).delete();
    console.log(deleteResult.writeTime);
    return res.status(204).send({});
  } catch (err) {
    return handleError(res, err);
  }
}

function handleError(res: Response, err: any) {
  return res.status(500).send({ message: `${err.code} - ${err.message}` });
}
