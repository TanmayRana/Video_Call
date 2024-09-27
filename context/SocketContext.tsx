// "use client";

// import { OngoingCall, Participants, PeerData, SocketUser } from "@/types";
// import { useUser } from "@clerk/nextjs";
// import {
//   createContext,
//   useCallback,
//   useContext,
//   useEffect,
//   useState,
//   ReactNode,
// } from "react";
// import { io, Socket } from "socket.io-client";
// import Peer, { SignalData } from "simple-peer";

// // Defining interface for SocketContext
// interface iSocketContext {
//   onlineUsers: SocketUser[] | null;
//   ongoingCall: OngoingCall | null;
//   handleCall: (user: SocketUser) => void;
//   localStream: MediaStream | null;
//   handleJoinCall: (ongoingCall: OngoingCall) => void;
//   peer: PeerData | null;
//   handleHangup: (data: {
//     ongoingCall?: OngoingCall | null;
//     isEmitHangup?: boolean;
//   }) => void;
//   isCallEnded: boolean;
// }

// // Providing default context value as null
// const SocketContext = createContext<iSocketContext | null>(null);

// export const SocketContextProvider = ({
//   children,
// }: {
//   children: ReactNode;
// }) => {
//   const { user } = useUser();

//   const [socket, setSocket] = useState<Socket | null>(null);
//   const [isSocketConnected, setIsSocketConnected] = useState(false);
//   const [onlineUsers, setOnlineUsers] = useState<SocketUser[] | null>(null);
//   const [ongoingCall, setOngoingCall] = useState<OngoingCall | null>(null);
//   const [localStream, setLocalStream] = useState<MediaStream | null>(null);
//   const [peer, setPeer] = useState<PeerData | null>(null);
//   const [isCallEnded, setIsCallEnded] = useState(false);

//   // Find the current socket user based on their user ID
//   const currentSocketUser = onlineUsers?.find(
//     (onlineUser) => onlineUser.userId === user?.id
//   );

//   const getMediaStream = useCallback(
//     async (faceMode: string) => {
//       if (localStream) return localStream;

//       try {
//         const devices = await navigator.mediaDevices.enumerateDevices();
//         const videoDevices = devices.filter(
//           (device) => device.kind === "videoinput"
//         );
//         const stream = await navigator.mediaDevices.getUserMedia({
//           audio: true,
//           video: {
//             width: { min: 640, ideal: 1280, max: 1920 },
//             height: { min: 360, ideal: 720, max: 1080 },
//             frameRate: { min: 16, ideal: 30, max: 60 },
//             facingMode: videoDevices.length > 0 ? faceMode : undefined,
//           },
//         });
//         setLocalStream(stream);
//         return stream;
//       } catch (error) {
//         console.error("Error accessing media devices:", error);
//         setLocalStream(null);
//         return null;
//       }
//     },
//     [localStream]
//   );

//   // Handler for initiating a call
//   const handleCall = useCallback(
//     async (user: SocketUser) => {
//       setIsCallEnded(false);
//       if (!currentSocketUser || !socket) return;

//       const stream = await getMediaStream();

//       if (!stream) {
//         console.log("No stream in handleCall");
//         return;
//       }

//       const participants = { caller: currentSocketUser, receiver: user };
//       setOngoingCall({ participants, isRinging: false });

//       socket?.emit("call", participants);
//     },
//     [currentSocketUser, getMediaStream, socket]
//   );

//   const handleHangup = useCallback(
//     (data: { ongoingCall?: OngoingCall | null; isEmitHangup?: boolean }) => {
//       if (socket && user && data?.ongoingCall && data?.isEmitHangup) {
//         socket.emit("hangup", {
//           ongoingCall: data.ongoingCall,
//           userHangingupId: user.id,
//         });
//       }

//       setOngoingCall(null);
//       setPeer(null);
//       if (localStream) {
//         localStream.getTracks().forEach((track) => track.stop());
//         setLocalStream(null);
//       }
//       setIsCallEnded(true);
//     },
//     [localStream, socket, user]
//   );

//   const createPeer = useCallback(
//     (stream: MediaStream, initiator: boolean) => {
//       const iceServers: RTCIceServer[] = [
//         {
//           urls: [
//             "stun:stun.l.google.com:19302",
//             "stun:stun1.l.google.com:19302",
//             "stun:stun2.l.google.com:19302",
//             "stun:stun3.l.google.com:19302",
//           ],
//         },
//       ];
//       const peer = new Peer({
//         stream,
//         initiator,
//         trickle: true,
//         config: { iceServers },
//       });

//       peer.on("stream", (stream) => {
//         setPeer((prevPeer) => {
//           if (prevPeer) {
//             return { ...prevPeer, stream };
//           }
//           return prevPeer;
//         });
//       });
//       peer.on("error", console.error);
//       peer.on("close", () => handleHangup({}));
//       const rtcPeerConnection: RTCPeerConnection = (peer as any)._pc;

//       rtcPeerConnection.onconnectionstatechange = async () => {
//         if (
//           rtcPeerConnection.iceConnectionState === "disconnected" ||
//           rtcPeerConnection.iceConnectionState === "failed"
//         ) {
//           handleHangup({});
//         }
//       };

//       return peer;
//     },
//     [ongoingCall, setPeer]
//   );

//   const onIncomingCall = useCallback(
//     (participants: Participants) => {
//       setOngoingCall({
//         participants,
//         isRinging: true,
//       });
//     },
//     [socket, user, ongoingCall]
//   );

//   const completePeerConnection = useCallback(
//     async (connectionData: {
//       sdp: SignalData;
//       ongoingCall: OngoingCall;
//       isCaller: boolean;
//     }) => {
//       if (!localStream) {
//         console.log("Missing the localStream");
//         return;
//       }

//       if (peer) {
//         peer.peerConnection?.signal(connectionData.sdp);
//         return;
//       }
//       const newPeer = createPeer(localStream, true);

//       setPeer({
//         peerConnection: newPeer,
//         participantUser: connectionData.ongoingCall.participants.receiver,
//         stream: undefined,
//       });

//       newPeer.on("signal", async (data: SignalData) => {
//         if (socket) {
//           // emit offrt

//           socket.emit("webrtcSignal", {
//             sdp: data,
//             ongoingCall,
//             isCaller: true,
//           });
//         }
//       });
//     },
//     [localStream, peer, createPeer, socket, ongoingCall]
//   );

//   const handleJoinCall = useCallback(
//     async (ongoingCall: OngoingCall) => {
//       setIsCallEnded(false);

//       // join call
//       setOngoingCall((prev) => {
//         if (prev) {
//           return { ...prev, isRinging: false };
//         }
//         return prev;
//       });
//       const stream = await getMediaStream();
//       if (!stream) {
//         console.log("No stream in handleJoinCall");
//         handleHangup({
//           ongoingCall: ongoingCall ? ongoingCall : undefined,
//           isEmitHangup: true,
//         });
//         return;
//       }

//       const newPeer = createPeer(stream, true);

//       setPeer({
//         peerConnection: newPeer,
//         participantUser: ongoingCall.participants.caller,
//         stream: undefined,
//       });

//       newPeer.on("signal", async (data: SignalData) => {
//         if (socket) {
//           // emit offrt

//           socket.emit("webrtcSignal", {
//             sdp: data,
//             ongoingCall,
//             isCaller: false,
//           });
//         }
//       });
//     },
//     [createPeer, getMediaStream, socket]
//   );

//   // Initializing socket connection
//   useEffect(() => {
//     const newSocket = io(); // Assuming the backend connection URL is already handled in socket.io settings
//     setSocket(newSocket);

//     return () => {
//       newSocket.disconnect();
//     };
//   }, [user]);

//   // Handling socket connection and disconnection
//   useEffect(() => {
//     if (!socket) return;

//     const onConnect = () => setIsSocketConnected(true);
//     const onDisconnect = () => setIsSocketConnected(false);

//     socket.on("connect", onConnect);
//     socket.on("disconnect", onDisconnect);

//     return () => {
//       socket.off("connect", onConnect);
//       socket.off("disconnect", onDisconnect);
//     };
//   }, [socket]);

//   // Emit and listen to events for online users
//   useEffect(() => {
//     if (!socket || !isSocketConnected) return;

//     socket.emit("addNewUser", user);
//     socket.on("getUsers", (res: SocketUser[]) => setOnlineUsers(res));

//     return () => {
//       socket.off("getUsers");
//     };
//   }, [socket, isSocketConnected, user]);

//   // calls

//   useEffect(() => {
//     if (!socket || !isSocketConnected) return;

//     socket.on("incomingCall", onIncomingCall);
//     socket.on("webrtcSignal", completePeerConnection);
//     socket.on("hangup", handleHangup);
//     return () => {
//       socket.off("incomingCall", onIncomingCall);
//       socket.off("webrtcSignal", completePeerConnection);
//       socket.off("hangup", handleHangup);
//     };
//   }, [
//     completePeerConnection,
//     handleHangup,
//     isSocketConnected,
//     onIncomingCall,
//     socket,
//   ]);

//   useEffect(() => {
//     let timeout: ReturnType<typeof setTimeout>;

//     if (isCallEnded) {
//       timeout = setTimeout(() => {
//         setIsCallEnded(false);
//       }, 2000);
//     }

//     return () => clearTimeout(timeout);
//   }, [isCallEnded]);

//   return (
//     <SocketContext.Provider
//       value={{
//         onlineUsers,
//         ongoingCall,
//         handleCall,
//         localStream,
//         handleJoinCall,
//         peer,
//         handleHangup,
//         isCallEnded,
//       }}
//     >
//       {children}
//     </SocketContext.Provider>
//   );
// };

// // Hook to use SocketContext
// export const useSocket = () => {
//   const context = useContext(SocketContext);
//   if (!context) {
//     throw new Error("useSocket must be used within a SocketContextProvider");
//   }
//   return context;
// };

"use client";

import { OngoingCall, Participants, PeerData, SocketUser } from "@/types";
import { useUser } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import Peer, { SignalData } from "simple-peer";

// Defining interface for SocketContext
interface iSocketContext {
  onlineUsers: SocketUser[] | null;
  ongoingCall: OngoingCall | null;
  handleCall: (user: SocketUser) => void;
  localStream: MediaStream | null;
  handleJoinCall: (ongoingCall: OngoingCall) => void;
  peer: PeerData | null;
  handleHangup: (data: {
    ongoingCall?: OngoingCall | null;
    isEmitHangup?: boolean;
  }) => void;
  isCallEnded: boolean;
}

// Default context value
const SocketContext = createContext<iSocketContext | null>(null);

export const SocketContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { user } = useUser();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<SocketUser[] | null>(null);
  const [ongoingCall, setOngoingCall] = useState<OngoingCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peer, setPeer] = useState<PeerData | null>(null);
  const [isCallEnded, setIsCallEnded] = useState(false);

  // Find the current socket user based on their user ID
  const currentSocketUser = onlineUsers?.find(
    (onlineUser) => onlineUser.userId === user?.id
  );

  // Function to get MediaStream with specific constraints
  const getMediaStream = useCallback(
    async (faceMode: string = "user") => {
      if (localStream) return localStream;

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput"
        );
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 360, ideal: 720, max: 1080 },
            frameRate: { min: 16, ideal: 30, max: 60 },
            facingMode: videoDevices.length > 0 ? faceMode : undefined,
          },
        });
        setLocalStream(stream);
        return stream;
      } catch (error) {
        console.error("Error accessing media devices:", error);
        setLocalStream(null);
        return null;
      }
    },
    [localStream]
  );

  // Handler for initiating a call
  const handleCall = useCallback(
    async (user: SocketUser) => {
      setIsCallEnded(false);
      if (!currentSocketUser || !socket) return;

      const stream = await getMediaStream();

      if (!stream) {
        console.log("No stream in handleCall");
        return;
      }

      const participants: Participants = {
        caller: currentSocketUser,
        receiver: user,
      };
      setOngoingCall({ participants, isRinging: false });

      socket.emit("call", participants);
    },
    [currentSocketUser, getMediaStream, socket]
  );

  // Handler for hanging up a call
  const handleHangup = useCallback(
    (data: { ongoingCall?: OngoingCall | null; isEmitHangup?: boolean }) => {
      if (socket && user && data?.ongoingCall && data?.isEmitHangup) {
        socket.emit("hangup", {
          ongoingCall: data.ongoingCall,
          userHangingupId: user.id,
        });
      }

      setOngoingCall(null);
      setPeer(null);
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
      setIsCallEnded(true);
    },
    [localStream, socket, user]
  );

  // Function to create a new peer connection
  const createPeer = useCallback(
    (stream: MediaStream, initiator: boolean) => {
      const iceServers: RTCIceServer[] = [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:stun3.l.google.com:19302",
          ],
        },
      ];
      const peer = new Peer({
        stream,
        initiator,
        trickle: true,
        config: { iceServers },
      });

      peer.on("stream", (stream) => {
        setPeer((prevPeer) => {
          if (prevPeer) {
            return { ...prevPeer, stream };
          }
          return prevPeer;
        });
      });
      peer.on("error", console.error);
      peer.on("close", () => handleHangup({}));

      const rtcPeerConnection: RTCPeerConnection = (peer as any)._pc;

      rtcPeerConnection.onconnectionstatechange = () => {
        if (
          rtcPeerConnection.iceConnectionState === "disconnected" ||
          rtcPeerConnection.iceConnectionState === "failed"
        ) {
          handleHangup({});
        }
      };

      return peer;
    },
    [handleHangup]
  );

  // Handler for an incoming call
  const onIncomingCall = useCallback((participants: Participants) => {
    setOngoingCall({
      participants,
      isRinging: true,
    });
  }, []);

  // Complete peer connection setup for WebRTC
  const completePeerConnection = useCallback(
    async (connectionData: {
      sdp: SignalData;
      ongoingCall: OngoingCall;
      isCaller: boolean;
    }) => {
      if (!localStream) {
        console.log("Missing the localStream");
        return;
      }

      if (peer) {
        peer.peerConnection?.signal(connectionData.sdp);
        return;
      }
      const newPeer = createPeer(localStream, connectionData.isCaller);

      setPeer({
        peerConnection: newPeer,
        participantUser: connectionData.ongoingCall.participants.receiver,
        stream: undefined,
      });

      newPeer.on("signal", (data: SignalData) => {
        socket?.emit("webrtcSignal", {
          sdp: data,
          ongoingCall: connectionData.ongoingCall,
          isCaller: connectionData.isCaller,
        });
      });
    },
    [localStream, peer, createPeer, socket]
  );

  // Handler for joining a call
  const handleJoinCall = useCallback(
    async (ongoingCall: OngoingCall) => {
      setIsCallEnded(false);

      setOngoingCall((prev) => {
        if (prev) {
          return { ...prev, isRinging: false };
        }
        return prev;
      });

      const stream = await getMediaStream();
      if (!stream) {
        handleHangup({
          ongoingCall: ongoingCall || undefined,
          isEmitHangup: true,
        });
        return;
      }

      const newPeer = createPeer(stream, false);

      setPeer({
        peerConnection: newPeer,
        participantUser: ongoingCall.participants.caller,
        stream: undefined,
      });

      newPeer.on("signal", (data: SignalData) => {
        socket?.emit("webrtcSignal", {
          sdp: data,
          ongoingCall,
          isCaller: false,
        });
      });
    },
    [createPeer, getMediaStream, handleHangup, socket]
  );

  // Initializing socket connection
  useEffect(() => {
    const newSocket = io(); // Assuming backend connection URL is handled in socket.io settings
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Handling socket connection and disconnection events
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  // Emit and listen for online users
  useEffect(() => {
    if (!socket || !isSocketConnected) return;

    socket.emit("addNewUser", user);
    socket.on("getUsers", (res: SocketUser[]) => setOnlineUsers(res));

    return () => {
      socket.off("getUsers");
    };
  }, [socket, isSocketConnected, user]);

  // Handling call-related socket events
  useEffect(() => {
    if (!socket || !isSocketConnected) return;

    socket.on("incomingCall", onIncomingCall);
    socket.on("webrtcSignal", completePeerConnection);
    socket.on("hangup", handleHangup);

    return () => {
      socket.off("incomingCall", onIncomingCall);
      socket.off("webrtcSignal", completePeerConnection);
      socket.off("hangup", handleHangup);
    };
  }, [
    completePeerConnection,
    handleHangup,
    isSocketConnected,
    onIncomingCall,
    socket,
  ]);

  // Reset call state after hangup
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (isCallEnded) {
      timeout = setTimeout(() => {
        setIsCallEnded(false);
      }, 2000);
    }

    return () => clearTimeout(timeout);
  }, [isCallEnded]);

  return (
    <SocketContext.Provider
      value={{
        onlineUsers,
        ongoingCall,
        handleCall,
        localStream,
        handleJoinCall,
        peer,
        handleHangup,
        isCallEnded,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

// Hook to use SocketContext
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketContextProvider");
  }
  return context;
};
