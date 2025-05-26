import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    return null
  }

  try {
    // First check by clerkUserId
    let loggedInUser = await db.user.findUnique({
      where: {
        clerkUserId: user.id,
      },
    });

    if (loggedInUser) {
      return loggedInUser;
    }

    // If not found by clerkUserId, check by email
    const userEmail = user.emailAddresses[0]?.emailAddress;
    
    if (!userEmail) {
      console.error("No email found for user");
      return null;
    }

    loggedInUser = await db.user.findUnique({
      where: {
        email: userEmail,
      },
    });

    // If user exists with same email but different clerkUserId, update the clerkUserId
    if (loggedInUser) {
      const updatedUser = await db.user.update({
        where: {
          email: userEmail,
        },
        data: {
          clerkUserId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          imageUrl: user.imageUrl,
        },
      });
      return updatedUser;
    }

    // If no user exists, create a new one
    const name = `${user.firstName} ${user.lastName}`;

    const newUser = await db.user.create({
      data: {
        clerkUserId: user.id,
        name,
        imageUrl: user.imageUrl,
        email: userEmail,
      },
    });

    return newUser;
  } catch (error) {
    console.error("Error in checkUser:", error);
    return null;
  }
};