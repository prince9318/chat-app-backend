let ioInstance = null;

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => ioInstance;

export const hasIO = () => Boolean(ioInstance);

export const broadcastNewUserRegistered = (userDoc) => {
  if (!ioInstance) return;
  const safeUser = {
    _id: userDoc._id,
    email: userDoc.email,
    fullName: userDoc.fullName,
    profilePic: userDoc.profilePic || "",
    bio: userDoc.bio || "",
    authProvider: userDoc.authProvider,
    createdAt: userDoc.createdAt,
    emailVerified: userDoc.emailVerified || false,
  };
  ioInstance.emit("newUserRegistered", safeUser);
};

export const broadcastUserUpdated = (userDoc) => {
  if (!ioInstance) return;
  const safeUser = {
    _id: userDoc._id,
    email: userDoc.email,
    fullName: userDoc.fullName,
    profilePic: userDoc.profilePic || "",
    bio: userDoc.bio || "",
    authProvider: userDoc.authProvider,
    createdAt: userDoc.createdAt,
    emailVerified: userDoc.emailVerified || false,
  };
  ioInstance.emit("userUpdated", safeUser);
};
