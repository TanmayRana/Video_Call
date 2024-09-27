// import { io } from "../server.js";

// const onHangup = async (data) => {
//   let socketIdToEmitTo;

//   if (data.ongoingCall.participants.caller.userId === data.userHangingupId) {
//     socketIdToEmitTo = data.ongoingCall.participants.receiver.socketId;
//   } else {
//     socketIdToEmitTo = data.ongoingCall.participants.caller.socketId;
//   }

//   if (socketIdToEmitTo) {
//     io.to(socketIdToEmitTo).emit("hangup");
//   }
// };

// export default onHangup;

import { io } from "../server.js";

const onHangup = async (data) => {
  // Ensure there is an ongoing call and both participants exist
  if (!data?.ongoingCall?.participants || !data?.userHangingupId) {
    console.error("Invalid data: missing ongoing call or user information");
    return;
  }

  const { caller, receiver } = data.ongoingCall.participants;

  // Determine who is hanging up and set the recipient accordingly
  let socketIdToEmitTo;
  if (caller?.userId === data.userHangingupId) {
    socketIdToEmitTo = receiver?.socketId;
  } else if (receiver?.userId === data.userHangingupId) {
    socketIdToEmitTo = caller?.socketId;
  }

  // Emit the hangup event if we have a valid recipient
  if (socketIdToEmitTo) {
    io.to(socketIdToEmitTo).emit("hangup");
  } else {
    console.error("Failed to determine which socket to emit to");
  }
};

export default onHangup;
